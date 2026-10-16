import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { Grade, TranscriptSource, TranscriptStatus } from "./generated/prisma/client";
import { prisma } from "./prisma";
import { authorizeTestStudents, bearerSecret, stateAfterReset, testStudentByEmail, testStudents, type FrozenCourse, type TestStudent } from "./test-students";

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

async function ensureUser(student: TestStudent, password: string, refreshPassword: boolean) {
  const hash = await hashPassword(password);
  const existing = await prisma.user.findUnique({ where: { email: student.email }, include: { accounts: true } });
  if (!existing) {
    const id = randomUUID();
    await prisma.user.create({
      data: {
        id,
        name: `${student.firstName} ${student.lastName}`,
        email: student.email,
        emailVerified: true,
        firstName: student.firstName,
        lastName: student.lastName,
        role: "STUDENT",
        accounts: { create: { id: randomUUID(), accountId: id, providerId: "credential", password: hash } },
      },
    });
    return id;
  }

  await prisma.user.update({
    where: { id: existing.id },
    data: { emailVerified: true, firstName: student.firstName, lastName: student.lastName, name: `${student.firstName} ${student.lastName}`, role: "STUDENT" },
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

    await tx.transcriptEntry.createMany({
      data: courses.map(course => {
        const row = transcriptRow(terms, byCode, course);
        return {
          studentId: profile.id,
          courseId: row.courseId,
          recommendedTermCourseId: row.recommendedTermCourseId,
          credits: row.credits,
          grade: Grade.C,
          status: TranscriptStatus.COMPLETED,
          source: TranscriptSource.NCAT,
        };
      }),
    });
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
  for (const student of testStudents) {
    const userId = await ensureUser(student, password, false);
    const profile = await prisma.studentProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!profile) await writeFrozen(userId, student, catalogYearId);
  }
  return testStudents.map(student => student.email);
}

export async function resetTestStudent(request: Request, email: string) {
  const password = guardTestStudents(request, email, true);
  const student = testStudentByEmail(email);
  if (!student) throw new TestStudentError("That is not a test student.", 400);
  const catalogYearId = await infoCatalogYearId();
  const userId = await ensureUser(student, password, true);
  await writeFrozen(userId, student, catalogYearId);
  return { email: student.email, name: `${student.firstName} ${student.lastName}` };
}
