import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { Grade, TranscriptSource, TranscriptStatus, UserRole } from "./generated/prisma/client";
import { prisma } from "./prisma";
import { authorizeTestStudents, bearerSecret, stateAfterReset, testAccountByEmail, testAdvisorByEmail, testStudentByEmail, testStudents, testAdvisors, type FrozenCourse, type TestStudent, type TestAdvisor } from "./test-students";

const frozenAt = new Date("2026-01-15T00:00:00.000Z");

export class TestStudentError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function accessFromEnv(request: Request, email?: string, requireEmail = false) {
  return authorizeTestStudents({
    vercelEnv: process.env.VERCEL_ENV,
    password: process.env.TEST_STUDENT_PASSWORD,
    expectedSecret: process.env.TEST_STUDENT_RESET_SECRET,
    providedSecret: bearerSecret(request.headers.get("authorization")),
    email,
    requireEmail,
  });
}

export function guardTestStudents(request: Request, email?: string, requireEmail = false) {
  const access = accessFromEnv(request, email, requireEmail);
  if (!access.ok) throw new TestStudentError(access.error, access.status);
  return process.env.TEST_STUDENT_PASSWORD as string;
}

async function infoCatalogYearId() {
  const year = await prisma.catalogYear.findFirst({
    where: { year: 2025, program: { shortName: "INFO" } },
    select: { id: true },
  });
  if (!year) throw new TestStudentError("Information Technology 2025 is not loaded.", 500);
  return year.id;
}

async function ensureUser(account: TestStudent | TestAdvisor, password: string, refreshPassword: boolean) {
  const hash = await hashPassword(password);
  const role = "role" in account ? account.role : UserRole.STUDENT;
  const existing = await prisma.user.findUnique({ where: { email: account.email }, include: { accounts: true } });
  if (!existing) {
    const id = randomUUID();
    await prisma.user.create({
      data: {
        id,
        name: `${account.firstName} ${account.lastName}`,
        email: account.email,
        emailVerified: true,
        firstName: account.firstName,
        lastName: account.lastName,
        role,
        accounts: { create: { id: randomUUID(), accountId: id, providerId: "credential", password: hash } },
      },
    });
    return id;
  }

  await prisma.user.update({
    where: { id: existing.id },
    data: { emailVerified: true, firstName: account.firstName, lastName: account.lastName, name: `${account.firstName} ${account.lastName}`, role },
  });
  if (refreshPassword) {
    const credential = existing.accounts.find(account => account.providerId === "credential");
    if (credential) await prisma.account.update({ where: { id: credential.id }, data: { password: hash } });
    else await prisma.account.create({ data: { id: randomUUID(), accountId: existing.id, providerId: "credential", userId: existing.id, password: hash } });
  }
  return existing.id;
}

async function writeFrozen(userId: string, student: TestStudent, catalogYearId: string) {
  const courses = stateAfterReset(student).transcript;
  await prisma.$transaction(async tx => {
    const profile = await tx.studentProfile.upsert({
      where: { userId },
      create: { userId, catalogYearId, standing: student.standing, startConfirmedAt: frozenAt },
      update: { catalogYearId, standing: student.standing, startConfirmedAt: frozenAt, advisorId: null, expectedGradTermId: null, notTakingTermId: null, bannerId: null },
    });
    await tx.transcriptEntry.deleteMany({ where: { studentId: profile.id } });
    await tx.plannedTerm.deleteMany({ where: { studentId: profile.id } });
    await tx.advisingAppointment.deleteMany({ where: { studentId: profile.id } });
    await tx.advisingNote.deleteMany({ where: { studentId: profile.id } });
    await tx.session.deleteMany({ where: { userId } });
    if (courses.length === 0) return;

    const terms = await tx.recommendedTerm.findMany({
      where: { catalogYearId, sequence: { lte: student.through } },
      include: {
        courses: {
          include: {
            course: { select: { id: true, subject: true, number: true, credits: true } },
            requirementGroup: { select: { name: true } },
          },
        },
      },
    });
    const catalog = await tx.course.findMany({
      where: { OR: courses.map(course => ({ subject: course.subject, number: course.number })) },
      select: { id: true, subject: true, number: true, credits: true },
    });
    const byCode = new Map(catalog.map(course => [`${course.subject} ${course.number}`, course]));

    // Generate transcript entries with custom grades for test scenarios
    const entries = courses.map(course => {
      const row = transcriptRow(terms, byCode, course);
      const code = `${course.subject} ${course.number}`;
      let grade = Grade.C;

      // Custom grades for specific test students
      if (student.email === "it.diverse-grades@example.test") {
        // P/TR/W/I/F grades scenario
        if (code === "ENGL 100") grade = Grade.P;
        else if (code === "MATH 125") grade = Grade.TR;
        else if (code === "CST 100") grade = Grade.W;
        else if (code === "CST 110") grade = Grade.I;
        else if (code === "HIST 207") grade = Grade.F;
        else if (code === "PSYC 101") grade = Grade.A;
        else grade = Grade.B;
      } else if (student.email === "it.over-credits@example.test") {
        // Over 120 credits - mix of good grades
        grade = Math.random() > 0.3 ? (Math.random() > 0.5 ? Grade.A : Grade.B) : Grade.C;
      }

      return {
        studentId: profile.id,
        courseId: row.courseId,
        recommendedTermCourseId: row.recommendedTermCourseId,
        credits: row.credits,
        grade,
        status: TranscriptStatus.COMPLETED,
        source: grade === Grade.TR ? TranscriptSource.TRANSFER : TranscriptSource.NCAT,
      };
    });

    await tx.transcriptEntry.createMany({ data: entries });

    // Add retake scenarios
    if (student.email === "it.retake-f-to-pass@example.test") {
      // F then passing retake for CST 110
      const cst110 = catalog.find(c => c.subject === "CST" && c.number === "110");
      if (cst110) {
        const term = terms.find(t => t.courses.some(c => c.course?.id === cst110.id));
        const termCourse = term?.courses.find(c => c.course?.id === cst110.id);
        
        await tx.transcriptEntry.createMany({
          data: [
            {
              studentId: profile.id,
              courseId: cst110.id,
              recommendedTermCourseId: termCourse?.id ?? null,
              credits: cst110.credits,
              grade: Grade.F,
              status: TranscriptStatus.COMPLETED,
              source: TranscriptSource.NCAT,
            },
            {
              studentId: profile.id,
              courseId: cst110.id,
              recommendedTermCourseId: termCourse?.id ?? null,
              credits: cst110.credits,
              grade: Grade.B,
              status: TranscriptStatus.COMPLETED,
              source: TranscriptSource.NCAT,
            },
          ],
        });
      }
    }

    if (student.email === "it.retake-c-to-a@example.test") {
      // C then A retake for CST 100
      const cst100 = catalog.find(c => c.subject === "CST" && c.number === "100");
      if (cst100) {
        const term = terms.find(t => t.courses.some(c => c.course?.id === cst100.id));
        const termCourse = term?.courses.find(c => c.course?.id === cst100.id);
        
        await tx.transcriptEntry.createMany({
          data: [
            {
              studentId: profile.id,
              courseId: cst100.id,
              recommendedTermCourseId: termCourse?.id ?? null,
              credits: cst100.credits,
              grade: Grade.C,
              status: TranscriptStatus.COMPLETED,
              source: TranscriptSource.NCAT,
            },
            {
              studentId: profile.id,
              courseId: cst100.id,
              recommendedTermCourseId: termCourse?.id ?? null,
              credits: cst100.credits,
              grade: Grade.A,
              status: TranscriptStatus.COMPLETED,
              source: TranscriptSource.NCAT,
            },
          ],
        });
      }
    }

    // Add an unmapped course for diverse-grades student
    if (student.email === "it.diverse-grades@example.test") {
      const unmappedCourse = await tx.course.findFirst({
        where: {
          subject: "JOUR",
          number: "101",
        },
        select: { id: true, credits: true },
      });

      if (unmappedCourse) {
        await tx.transcriptEntry.create({
          data: {
            studentId: profile.id,
            courseId: unmappedCourse.id,
            recommendedTermCourseId: null,
            credits: unmappedCourse.credits,
            grade: Grade.B,
            status: TranscriptStatus.COMPLETED,
            source: TranscriptSource.NCAT,
          },
        });
      }
    }
  });
}

function transcriptRow(
  terms: Array<{ sequence: number; courses: Array<{ id: string; requiresLab: boolean; credits: number | null; course: { id: string; subject: string; number: string; credits: number } | null; requirementGroup: { name: string } | null }> }>,
  byCode: Map<string, { id: string; credits: number }>,
  course: FrozenCourse,
) {
  const term = terms.find(item => item.sequence === course.sequence);
  if (!term) throw new TestStudentError(`Handbook term ${course.sequence} is missing.`, 500);
  const code = `${course.subject} ${course.number}`;
  const catalogCourse = byCode.get(code);
  if (!catalogCourse) throw new TestStudentError(`${code} is not in the catalog.`, 500);

  if (!course.slot) {
    const named = term.courses.find(item => item.course?.subject === course.subject && item.course.number === course.number);
    if (!named?.course) throw new TestStudentError(`${code} is not on handbook term ${course.sequence}.`, 500);
    return { courseId: named.course.id, credits: named.course.credits, recommendedTermCourseId: null };
  }

  const slot = term.courses.find(item => item.requirementGroup?.name === course.slot && item.requiresLab === course.requiresLab);
  if (!slot) throw new TestStudentError(`${course.slot} is not on handbook term ${course.sequence}.`, 500);
  if (slot.credits != null && slot.credits !== catalogCourse.credits) {
    throw new TestStudentError(`${code} is ${catalogCourse.credits} credits, and the handbook slot is ${slot.credits}.`, 500);
  }
  return { courseId: catalogCourse.id, credits: catalogCourse.credits, recommendedTermCourseId: slot.id };
}

export async function ensureTestStudents(request: Request) {
  const password = guardTestStudents(request);
  const catalogYearId = await infoCatalogYearId();
  
  // Ensure student accounts
  for (const student of testStudents) {
    const userId = await ensureUser(student, password, false);
    const profile = await prisma.studentProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!profile) await writeFrozen(userId, student, catalogYearId);
  }
  
  // Ensure advisor accounts (no profile needed)
  for (const advisor of testAdvisors) {
    await ensureUser(advisor, password, false);
  }
  
  return [...testStudents.map(s => s.email), ...testAdvisors.map(a => a.email)];
}

export async function resetTestStudent(request: Request, email: string) {
  const password = guardTestStudents(request, email, true);
  const account = testAccountByEmail(email);
  if (!account) throw new TestStudentError("That is not a test account.", 400);
  
  const advisor = testAdvisorByEmail(email);
  if (advisor) {
    // Advisors just need their account refreshed, no profile or transcript
    const userId = await ensureUser(advisor, password, true);
    await prisma.session.deleteMany({ where: { userId } });
    return { email: advisor.email, name: `${advisor.firstName} ${advisor.lastName}` };
  }
  
  const student = testStudentByEmail(email);
  if (!student) throw new TestStudentError("That is not a test account.", 400);
  const catalogYearId = await infoCatalogYearId();
  const userId = await ensureUser(student, password, true);
  await writeFrozen(userId, student, catalogYearId);
  return { email: student.email, name: `${student.firstName} ${student.lastName}` };
}
