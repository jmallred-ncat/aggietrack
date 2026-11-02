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
    // Note: Taylor Morgan and Casey Parker's specific courses are handled in their special sections
    // to avoid any countable-grade-followed-by-another-attempt sequences
    const entries = courses.map(course => {
      const row = transcriptRow(terms, byCode, course);
      const code = `${course.subject} ${course.number}`;
      let grade = Grade.C;

      // Jordan Hale: realistic passing grades (mostly Bs and Cs)
      if (student.email === "it.mid@example.test") {
        const hash = (code.length + course.sequence) % 3;
        grade = hash === 0 ? Grade.A : hash === 1 ? Grade.B : Grade.C;
      }
      // Riley Brooks: strong grades (mostly As and Bs)
      else if (student.email === "it.late@example.test") {
        const hash = (code.length + course.sequence) % 4;
        grade = hash === 0 ? Grade.A : hash === 1 ? Grade.A : hash === 2 ? Grade.B : Grade.B_PLUS;
      }
      // Alex Rivera: diverse grades scenario (W, I, F are non-countable, so no issue with "attempts")
      else if (student.email === "it.diverse-grades@example.test") {
        if (code === "ENGL 100") grade = Grade.P;
        else if (code === "MATH 125") grade = Grade.TR;
        else if (code === "CST 100") grade = Grade.W;
        else if (code === "CST 110") grade = Grade.I;
        else if (code === "HIST 207") grade = Grade.F;
        else if (code === "PSYC 101") grade = Grade.A;
        else grade = Grade.B;
      }
      // Morgan Lee: over 120 credits - excellent grades
      else if (student.email === "it.over-credits@example.test") {
        const hash = code.charCodeAt(0) % 5;
        grade = hash === 0 ? Grade.A : hash === 1 ? Grade.A_MINUS : hash === 2 ? Grade.B_PLUS : hash === 3 ? Grade.B : Grade.A;
      }
      // Default for others
      else {
        grade = Grade.C;
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

    // Add realistic retake scenarios (only after non-countable grades: F, W, D below-min)
    // These special cases run FIRST and return early to avoid the default createMany below
    if (student.email === "it.retake-f-to-pass@example.test") {
      // Taylor Morgan: Sophomore with F→B retake and SINGLE D below-min (not retaken)
      const cst112 = catalog.find(c => c.subject === "CST" && c.number === "112");
      const cst120 = catalog.find(c => c.subject === "CST" && c.number === "120");
      
      if (cst112 && cst120) {
        const term1 = terms.find(t => t.sequence === 1);
        const term2 = terms.find(t => t.sequence === 2);
        const cst120Course = term1?.courses.find(c => c.course?.id === cst120.id);
        const cst112Course = term2?.courses.find(c => c.course?.id === cst112.id);
        
        // Add base courses from terms 1-2 with decent grades, EXCLUDING CST 112 and CST 120
        const baseCourses = entries.filter(e => 
          e.courseId !== cst112.id && e.courseId !== cst120.id
        );
        await tx.transcriptEntry.createMany({
          data: baseCourses.map(e => ({ ...e, grade: e.grade || Grade.B })),
        });
        
        // CST 120: SINGLE attempt with D (below C minimum for Major Core) - NOT RETAKEN
        // This is the clear below-min example that must not count toward progress
        await tx.transcriptEntry.create({
          data: {
            studentId: profile.id,
            courseId: cst120.id,
            recommendedTermCourseId: cst120Course?.id ?? null,
            credits: cst120.credits,
            grade: Grade.D,
            status: TranscriptStatus.COMPLETED,
            source: TranscriptSource.NCAT,
          },
        });
        
        // CST 112: F (first attempt in term 2), then B (retake after F)
        await tx.transcriptEntry.createMany({
          data: [
            {
              studentId: profile.id,
              courseId: cst112.id,
              recommendedTermCourseId: cst112Course?.id ?? null,
              credits: cst112.credits,
              grade: Grade.F,
              status: TranscriptStatus.COMPLETED,
              source: TranscriptSource.NCAT,
            },
            {
              studentId: profile.id,
              courseId: cst112.id,
              recommendedTermCourseId: cst112Course?.id ?? null,
              credits: cst112.credits,
              grade: Grade.B,
              status: TranscriptStatus.COMPLETED,
              source: TranscriptSource.NCAT,
            },
          ],
        });
        return;
      }
    }

    if (student.email === "it.retake-c-to-a@example.test") {
      // Casey Parker: Sophomore with W→A retake (realistic: withdrew, then passed)
      const cst130 = catalog.find(c => c.subject === "CST" && c.number === "130");
      if (cst130) {
        const term1 = terms.find(t => t.sequence === 1);
        const cst130Course = term1?.courses.find(c => c.course?.id === cst130.id);
        
        // Add base courses from terms 1-2 with good grades, EXCLUDING CST 130
        const baseCourses = entries.filter(e => e.courseId !== cst130.id);
        await tx.transcriptEntry.createMany({
          data: baseCourses.map(e => ({ ...e, grade: e.grade || Grade.B_PLUS })),
        });
        
        // CST 130: W (withdrew first attempt), then A (retake after W)
        // W is non-countable, so this is a realistic retake scenario
        await tx.transcriptEntry.createMany({
          data: [
            {
              studentId: profile.id,
              courseId: cst130.id,
              recommendedTermCourseId: cst130Course?.id ?? null,
              credits: cst130.credits,
              grade: Grade.W,
              status: TranscriptStatus.COMPLETED,
              source: TranscriptSource.NCAT,
            },
            {
              studentId: profile.id,
              courseId: cst130.id,
              recommendedTermCourseId: cst130Course?.id ?? null,
              credits: cst130.credits,
              grade: Grade.A,
              status: TranscriptStatus.COMPLETED,
              source: TranscriptSource.NCAT,
            },
          ],
        });
        return;
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

    // Default: create all entries for students without special retake handling
    // (This runs for Jordan Hale, Riley Brooks, Alex Rivera, Morgan Lee, and Avery Cole)
    if (
      student.email !== "it.retake-f-to-pass@example.test" &&
      student.email !== "it.retake-c-to-a@example.test"
    ) {
      await tx.transcriptEntry.createMany({ data: entries });
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
