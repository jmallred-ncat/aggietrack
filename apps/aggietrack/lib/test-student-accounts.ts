import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { TranscriptStatus, UserRole } from "./generated/prisma/client";
import { plannedAttempts } from "./frozen-transcript";
import { prisma } from "./prisma";
import { authorizeTestStudents, bearerSecret, testAccountByEmail, testAdvisorByEmail, testStudentByEmail, testStudents, testAdvisors, type FrozenCourse, type TestStudent, type TestAdvisor } from "./test-students";

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

function isUniqueConflict(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
}

async function ensureUser(account: TestStudent | TestAdvisor, password: string, refreshPassword: boolean) {
  const hash = await hashPassword(password);
  const role = "role" in account ? account.role : UserRole.STUDENT;
  let existing = await prisma.user.findUnique({ where: { email: account.email }, include: { accounts: true } });
  if (!existing) {
    const id = randomUUID();
    try {
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
    } catch (error) {
      if (!isUniqueConflict(error)) throw error;
      existing = await prisma.user.findUnique({ where: { email: account.email }, include: { accounts: true } });
      if (!existing) throw error;
    }
  }

  await prisma.user.update({
    where: { id: existing.id },
    data: { emailVerified: true, firstName: account.firstName, lastName: account.lastName, name: `${account.firstName} ${account.lastName}`, role },
  });
  if (refreshPassword) {
    const credential = existing.accounts.find(item => item.providerId === "credential");
    if (credential) await prisma.account.update({ where: { id: credential.id }, data: { password: hash } });
    else {
      try {
        await prisma.account.create({ data: { id: randomUUID(), accountId: existing.id, providerId: "credential", userId: existing.id, password: hash } });
      } catch (error) {
        if (!isUniqueConflict(error)) throw error;
        const again = await prisma.account.findFirst({ where: { userId: existing.id, providerId: "credential" } });
        if (!again) throw error;
        await prisma.account.update({ where: { id: again.id }, data: { password: hash } });
      }
    }
  }
  return existing.id;
}

async function writeFrozen(userId: string, student: TestStudent, catalogYearId: string) {
  const planned = plannedAttempts(student);
  await prisma.$transaction(async tx => {
    const profile = await tx.studentProfile.upsert({
      where: { userId },
      create: { userId, catalogYearId, standing: student.standing, startConfirmedAt: frozenAt },
      update: { catalogYearId, standing: student.standing, startConfirmedAt: frozenAt, advisorId: null, expectedGradTermId: null, notTakingTermId: null, bannerId: null },
    });
    // Replace whatever is already there. A second reset of a frozen student deletes these rows, then writes the same fixture again.
    await tx.plannedCourse.deleteMany({ where: { plannedTerm: { studentId: profile.id } } });
    await tx.transcriptEntry.deleteMany({ where: { studentId: profile.id } });
    await tx.plannedTerm.deleteMany({ where: { studentId: profile.id } });
    await tx.advisingAppointment.deleteMany({ where: { studentId: profile.id } });
    await tx.advisingNote.deleteMany({ where: { studentId: profile.id } });
    await tx.session.deleteMany({ where: { userId } });
    if (planned.length === 0) return;

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
      where: { OR: planned.map(course => ({ subject: course.subject, number: course.number })) },
      select: { id: true, subject: true, number: true, credits: true },
    });
    const byCode = new Map(catalog.map(course => [`${course.subject} ${course.number}`, course]));
    const usedSlots = new Set<string>();
    const started = Date.UTC(2024, 7, 15);
    const entries = planned.map((course, index) => {
      const createdAt = new Date(started + index * 86_400_000);
      if (course.outsidePlan) {
        const catalogCourse = byCode.get(`${course.subject} ${course.number}`);
        if (!catalogCourse) throw new TestStudentError(`${course.subject} ${course.number} is not in the catalog.`, 500);
        return {
          studentId: profile.id,
          courseId: catalogCourse.id,
          recommendedTermCourseId: null,
          credits: catalogCourse.credits,
          grade: course.grade,
          status: course.status,
          source: course.source,
          createdAt,
        };
      }
      const placed = transcriptRow(terms, byCode, course, usedSlots);
      return {
        studentId: profile.id,
        courseId: placed.courseId,
        recommendedTermCourseId: placed.recommendedTermCourseId,
        credits: placed.credits,
        grade: course.status === TranscriptStatus.IN_PROGRESS ? null : course.grade,
        status: course.status,
        source: course.source,
        createdAt,
      };
    });
    await tx.transcriptEntry.createMany({ data: entries });
  });
}

function transcriptRow(
  terms: Array<{ sequence: number; courses: Array<{ id: string; requiresLab: boolean; credits: number | null; course: { id: string; subject: string; number: string; credits: number } | null; requirementGroup: { name: string } | null }> }>,
  byCode: Map<string, { id: string; credits: number }>,
  course: FrozenCourse,
  usedSlots: Set<string>,
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

  const slot = term.courses.find(item => item.requirementGroup?.name === course.slot && item.requiresLab === course.requiresLab && !usedSlots.has(item.id));
  if (!slot) throw new TestStudentError(`${course.slot} is not on handbook term ${course.sequence}.`, 500);
  usedSlots.add(slot.id);
  if (slot.credits != null && slot.credits !== catalogCourse.credits) {
    throw new TestStudentError(`${code} is ${catalogCourse.credits} credits, and the handbook slot is ${slot.credits}.`, 500);
  }
  return { courseId: catalogCourse.id, credits: catalogCourse.credits, recommendedTermCourseId: slot.id };
}

export async function ensureTestStudents(request: Request) {
  const password = guardTestStudents(request);
  const catalogYearId = await infoCatalogYearId();
  
  const succeeded: string[] = [];
  const failed: Array<{ email: string; error: string }> = [];
  
  // Ensure student accounts - continue past individual failures
  for (const student of testStudents) {
    try {
      const userId = await ensureUser(student, password, false);
      const profile = await prisma.studentProfile.findUnique({ where: { userId }, select: { id: true } });
      if (!profile) await writeFrozen(userId, student, catalogYearId);
      succeeded.push(student.email);
    } catch (error) {
      console.error(`Failed to ensure test student ${student.email}:`, error);
      failed.push({ email: student.email, error: error instanceof Error ? error.message : String(error) });
    }
  }
  
  // Ensure advisor accounts (no profile needed)
  for (const advisor of testAdvisors) {
    try {
      await ensureUser(advisor, password, false);
      succeeded.push(advisor.email);
    } catch (error) {
      console.error(`Failed to ensure test advisor ${advisor.email}:`, error);
      failed.push({ email: advisor.email, error: error instanceof Error ? error.message : String(error) });
    }
  }
  
  if (failed.length > 0 && succeeded.length === 0) {
    throw new TestStudentError(`All test accounts failed: ${failed.map(f => `${f.email} (${f.error})`).join(", ")}`, 500);
  }
  
  return { succeeded, failed };
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
