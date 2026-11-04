import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { PlannedTermStatus, TranscriptStatus, UserRole } from "./generated/prisma/client";
import { plannedAttempts } from "./frozen-transcript";
import { prisma } from "./prisma";
import { plannerWriteFaultValue } from "./planner-write";
import { assignedAdvisorEmail, authorizeTestStudents, bearerSecret, jordanSubmittedPlan, sarahMartinezEmail, testAccountByEmail, testAdvisorByEmail, testStudentByEmail, testStudents, testAdvisors, type FrozenCourse, type TestStudent, type TestAdvisor } from "./test-students";

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

const jordanEmail = "it.mid@example.test";

async function sarahUserId(password: string) {
  const sarah = testAdvisorByEmail(sarahMartinezEmail);
  if (!sarah) throw new TestStudentError("Sarah Martinez is not a test advisor.", 500);
  return ensureUser(sarah, password, false);
}

async function jordanPlanRecords() {
  const plan = jordanSubmittedPlan();
  const term = await prisma.academicTerm.findUnique({
    where: { season_year: { season: plan.term.season, year: plan.term.year } },
    select: { id: true },
  });
  if (!term) {
    const label = plan.term.season === "FALL" ? "Fall" : "Spring";
    throw new TestStudentError(`${label} ${plan.term.year} is not loaded.`, 500);
  }
  const found = await prisma.course.findMany({
    where: { OR: plan.courses.map((course) => ({ subject: course.subject, number: course.number })) },
    select: { id: true, subject: true, number: true },
  });
  const byCode = new Map(found.map((course) => [`${course.subject} ${course.number}`, course]));
  const courseIds = plan.courses.map((course) => {
    const row = byCode.get(`${course.subject} ${course.number}`);
    if (!row) throw new TestStudentError(`${course.subject} ${course.number} is not in the catalog.`, 500);
    return row.id;
  });
  return { termId: term.id, courseIds };
}

function submittedPlanData(studentId: string, termId: string, courseIds: string[]) {
  const submittedAt = new Date();
  return {
    studentId,
    termId,
    status: PlannedTermStatus.SUBMITTED,
    submittedAt,
    courses: {
      create: courseIds.map((courseId, index) => ({
        courseId,
        createdAt: new Date(submittedAt.getTime() + index),
      })),
    },
  };
}

async function ensureJordanSubmittedPlan(studentId: string) {
  const loaded = await jordanPlanRecords();
  const existing = await prisma.plannedTerm.findMany({
    where: { studentId },
    include: { courses: { select: { courseId: true } } },
  });
  const only = existing.length === 1 ? existing[0] : null;
  if (
    only
    && only.termId === loaded.termId
    && (only.status === PlannedTermStatus.SUBMITTED || only.status === PlannedTermStatus.APPROVED)
    && [...only.courses.map((course) => course.courseId)].sort().join() === [...loaded.courseIds].sort().join()
  ) return;

  await prisma.$transaction(async (tx) => {
    await tx.plannedCourse.deleteMany({ where: { plannedTerm: { studentId } } });
    await tx.plannedTerm.deleteMany({ where: { studentId } });
    await tx.plannedTerm.create({ data: submittedPlanData(studentId, loaded.termId, loaded.courseIds) });
  });
}

async function writeFrozen(userId: string, student: TestStudent, catalogYearId: string, advisorId: string | null) {
  const planned = plannedAttempts(student);
  const submitted = student.email === jordanEmail ? await jordanPlanRecords() : null;
  await prisma.$transaction(async tx => {
    const profile = await tx.studentProfile.upsert({
      where: { userId },
      create: { userId, catalogYearId, standing: student.standing, startConfirmedAt: frozenAt, advisorId },
      update: { catalogYearId, standing: student.standing, startConfirmedAt: frozenAt, advisorId, expectedGradTermId: null, notTakingTermId: null, bannerId: null, plannerWriteFault: null },
    });
    // Replace whatever is already there. A second reset of a frozen student deletes these rows, then writes the same fixture again.
    await tx.plannedCourse.deleteMany({ where: { plannedTerm: { studentId: profile.id } } });
    await tx.transcriptEntry.deleteMany({ where: { studentId: profile.id } });
    await tx.plannedTerm.deleteMany({ where: { studentId: profile.id } });
    await tx.advisingAppointment.deleteMany({ where: { studentId: profile.id } });
    await tx.advisingNote.deleteMany({ where: { studentId: profile.id } });
    await tx.session.deleteMany({ where: { userId } });
    // JOUR 101 was briefly inserted as a catalog course. A typed free elective is not one, so drop that row once this transcript no longer points at it.
    await tx.course.deleteMany({
      where: {
        subject: "JOUR",
        number: "101",
        transcriptEntries: { none: {} },
        plannedCourses: { none: {} },
        requirementItems: { none: {} },
        recommendedIn: { none: {} },
      },
    });
    if (planned.length === 0) {
      if (submitted) await tx.plannedTerm.create({ data: submittedPlanData(profile.id, submitted.termId, submitted.courseIds) });
      return;
    }

    const sequences = [...new Set(planned.map(course => course.sequence))];
    const terms = await tx.recommendedTerm.findMany({
      where: { catalogYearId, sequence: { in: sequences } },
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
      if (course.entered) {
        const slotId = enteredSlot(terms, course, usedSlots);
        return {
          studentId: profile.id,
          courseId: null,
          subject: course.subject,
          number: course.number,
          title: course.entered.title,
          recommendedTermCourseId: slotId,
          credits: course.entered.credits,
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
        subject: null,
        number: null,
        title: null,
        recommendedTermCourseId: placed.recommendedTermCourseId,
        credits: placed.credits,
        grade: course.status === TranscriptStatus.IN_PROGRESS ? null : course.grade,
        status: course.status,
        source: course.source,
        createdAt,
      };
    });
    await tx.transcriptEntry.createMany({ data: entries });
    if (submitted) await tx.plannedTerm.create({ data: submittedPlanData(profile.id, submitted.termId, submitted.courseIds) });
  });
}

function enteredSlot(
  terms: Array<{ sequence: number; courses: Array<{ id: string; requiresLab: boolean; requirementGroup: { name: string } | null }> }>,
  course: FrozenCourse,
  usedSlots: Set<string>,
) {
  const term = terms.find(item => item.sequence === course.sequence);
  if (!term) throw new TestStudentError(`Handbook term ${course.sequence} is missing.`, 500);
  if (!course.slot) throw new TestStudentError(`${course.subject} ${course.number} needs a free-elective slot.`, 500);
  const slot = term.courses.find(item => item.requirementGroup?.name === course.slot && item.requiresLab === course.requiresLab && !usedSlots.has(item.id));
  if (!slot) throw new TestStudentError(`${course.slot} is not on handbook term ${course.sequence}.`, 500);
  usedSlots.add(slot.id);
  return slot.id;
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
  const advisorIds = new Map<string, string>();

  // Advisors first, so Sarah exists before students are assigned to her.
  for (const advisor of testAdvisors) {
    try {
      advisorIds.set(advisor.email, await ensureUser(advisor, password, false));
      succeeded.push(advisor.email);
    } catch (error) {
      console.error(`Failed to ensure test advisor ${advisor.email}:`, error);
      failed.push({ email: advisor.email, error: error instanceof Error ? error.message : String(error) });
    }
  }
  
  for (const student of testStudents) {
    try {
      const userId = await ensureUser(student, password, false);
      const advisorEmail = assignedAdvisorEmail(student.email);
      const advisorId = advisorEmail ? advisorIds.get(advisorEmail) ?? null : null;
      if (advisorEmail && !advisorId) throw new TestStudentError("Sarah Martinez could not be prepared.", 500);
      const profile = await prisma.studentProfile.findUnique({ where: { userId }, select: { id: true } });
      if (!profile) await writeFrozen(userId, student, catalogYearId, advisorId);
      else {
        await prisma.studentProfile.update({ where: { id: profile.id }, data: { advisorId } });
        if (student.email === jordanEmail) await ensureJordanSubmittedPlan(profile.id);
      }
      succeeded.push(student.email);
    } catch (error) {
      console.error(`Failed to ensure test student ${student.email}:`, error);
      failed.push({ email: student.email, error: error instanceof Error ? error.message : String(error) });
    }
  }
  
  if (failed.length > 0 && succeeded.length === 0) {
    throw new TestStudentError(`All test accounts failed: ${failed.map(f => `${f.email} (${f.error})`).join(", ")}`, 500);
  }

  const profiles = await prisma.studentProfile.findMany({
    where: { user: { email: { in: testStudents.map((student) => student.email) } } },
    select: { plannerWriteFault: true, user: { select: { email: true } } },
  });
  const faults: Record<string, string | null> = {};
  for (const student of testStudents) faults[student.email] = null;
  for (const profile of profiles) faults[profile.user.email] = profile.plannerWriteFault;

  return { succeeded, failed, faults };
}

export async function armPlannerWriteFault(request: Request, email: string, fault: unknown, seconds: unknown) {
  guardTestStudents(request, email, true);
  if (process.env.VERCEL_ENV === "production") {
    throw new TestStudentError("Test students are not available on the live site.", 403);
  }
  const student = testStudentByEmail(email);
  if (!student) throw new TestStudentError("That is not a test student.", 400);
  const stored = plannerWriteFaultValue(fault, seconds);
  if (!stored.ok) throw new TestStudentError(stored.error, 400);
  const profile = await prisma.studentProfile.findFirst({
    where: { user: { email: student.email } },
    select: { id: true },
  });
  if (!profile) throw new TestStudentError("That student is not ready yet.", 400);
  await prisma.studentProfile.update({
    where: { id: profile.id },
    data: { plannerWriteFault: stored.value },
  });
  return { email: student.email, fault: stored.value };
}

export async function resetTestStudent(request: Request, email: string) {
  const password = guardTestStudents(request, email, true);
  const account = testAccountByEmail(email);
  if (!account) throw new TestStudentError("That is not a test account.", 400);
  
  const advisor = testAdvisorByEmail(email);
  if (advisor) {
    // Sign the advisor out and refresh the password. Assignments and Jordan's submitted plan stay.
    const userId = await ensureUser(advisor, password, true);
    await prisma.session.deleteMany({ where: { userId } });
    return { email: advisor.email, name: `${advisor.firstName} ${advisor.lastName}` };
  }
  
  const student = testStudentByEmail(email);
  if (!student) throw new TestStudentError("That is not a test account.", 400);
  const catalogYearId = await infoCatalogYearId();
  const advisorId = assignedAdvisorEmail(student.email) ? await sarahUserId(password) : null;
  const userId = await ensureUser(student, password, true);
  await writeFrozen(userId, student, catalogYearId, advisorId);
  return { email: student.email, name: `${student.firstName} ${student.lastName}` };
}
