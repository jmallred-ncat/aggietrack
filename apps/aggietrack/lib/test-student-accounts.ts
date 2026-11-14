import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { MeetingSessionStatus, MeetingSlotStatus, MeetingSlotSource, PlannedTermStatus, Prisma, TranscriptStatus, UserRole } from "./generated/prisma/client";
import { plannedAttempts } from "./frozen-transcript";
import { describeFixtureLoad, runFixtureLoad, type FixtureAttempt } from "./transcript-fixtures";
import { prisma } from "./prisma";
import { plannerWriteFaultValue } from "./planner-write";
import { testPlanNoteDeleteWhere } from "./test-plan-notes";
import { assignedAdvisorEmail, authorizeTestStudents, bearerSecret, jordanSubmittedPlan, nextRegistrationTerm, sarahMartinezEmail, testAccountByEmail, testAdvisorByEmail, testStudentByEmail, testStudents, testAdvisors, type FrozenCourse, type TestStudent, type TestAdvisor } from "./test-students";
import { academicTerms } from "../prisma/seed/academic-terms";

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

type Db = Prisma.TransactionClient | typeof prisma;

async function ensureUser(account: TestStudent | TestAdvisor, password: string, refreshPassword: boolean, db: Db = prisma) {
  const hash = await hashPassword(password);
  const role = "role" in account ? account.role : UserRole.STUDENT;
  let existing = await db.user.findUnique({ where: { email: account.email }, include: { accounts: true } });
  if (!existing) {
    const id = randomUUID();
    try {
      await db.user.create({
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
      existing = await db.user.findUnique({ where: { email: account.email }, include: { accounts: true } });
      if (!existing) throw error;
    }
  }

  await db.user.update({
    where: { id: existing.id },
    data: { emailVerified: true, firstName: account.firstName, lastName: account.lastName, name: `${account.firstName} ${account.lastName}`, role },
  });
  if (refreshPassword) {
    const credential = existing.accounts.find(item => item.providerId === "credential");
    if (credential) await db.account.update({ where: { id: credential.id }, data: { password: hash } });
    else {
      try {
        await db.account.create({ data: { id: randomUUID(), accountId: existing.id, providerId: "credential", userId: existing.id, password: hash } });
      } catch (error) {
        if (!isUniqueConflict(error)) throw error;
        const again = await db.account.findFirst({ where: { userId: existing.id, providerId: "credential" } });
        if (!again) throw error;
        await db.account.update({ where: { id: again.id }, data: { password: hash } });
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

/**
 * Check if a date is a US federal holiday (observed dates).
 * Only includes holidays that would affect a Spring or Fall term schedule.
 */
function isUSFederalHoliday(date: Date): boolean {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const dayOfWeek = date.getUTCDay();
  
  // New Year's Day (January 1, or observed on adjacent weekday)
  if (month === 0 && day === 1) return true;
  if (month === 0 && day === 2 && dayOfWeek === 1) return true; // observed Monday if Jan 1 is Sunday
  if (month === 11 && day === 31 && dayOfWeek === 5) return true; // observed Friday if Jan 1 is Saturday
  
  // Martin Luther King Jr. Day (third Monday of January)
  if (month === 0 && dayOfWeek === 1) {
    const mondayCount = Math.floor((day - 1) / 7) + 1;
    if (mondayCount === 3) return true;
  }
  
  // Presidents' Day (third Monday of February)
  if (month === 1 && dayOfWeek === 1) {
    const mondayCount = Math.floor((day - 1) / 7) + 1;
    if (mondayCount === 3) return true;
  }
  
  // Memorial Day (last Monday of May)
  if (month === 4 && dayOfWeek === 1 && day >= 25) return true;
  
  // Juneteenth (June 19, or observed on adjacent weekday)
  if (month === 5 && day === 19) return true;
  if (month === 5 && day === 18 && dayOfWeek === 5) return true; // observed Friday if Jun 19 is Saturday
  if (month === 5 && day === 20 && dayOfWeek === 1) return true; // observed Monday if Jun 19 is Sunday
  
  // Independence Day (July 4, or observed on adjacent weekday)
  if (month === 6 && day === 4) return true;
  if (month === 6 && day === 3 && dayOfWeek === 5) return true; // observed Friday if Jul 4 is Saturday
  if (month === 6 && day === 5 && dayOfWeek === 1) return true; // observed Monday if Jul 4 is Sunday
  
  // Labor Day (first Monday of September)
  if (month === 8 && dayOfWeek === 1 && day <= 7) return true;
  
  // Columbus Day (second Monday of October)
  if (month === 9 && dayOfWeek === 1) {
    const mondayCount = Math.floor((day - 1) / 7) + 1;
    if (mondayCount === 2) return true;
  }
  
  // Veterans Day (November 11, or observed on adjacent weekday)
  if (month === 10 && day === 11) return true;
  if (month === 10 && day === 10 && dayOfWeek === 5) return true; // observed Friday if Nov 11 is Saturday
  if (month === 10 && day === 12 && dayOfWeek === 1) return true; // observed Monday if Nov 11 is Sunday
  
  // Thanksgiving (fourth Thursday of November)
  if (month === 10 && dayOfWeek === 4) {
    const thursdayCount = Math.floor((day - 1) / 7) + 1;
    if (thursdayCount === 4) return true;
  }
  
  // Christmas (December 25, or observed on adjacent weekday)
  if (month === 11 && day === 25) return true;
  if (month === 11 && day === 24 && dayOfWeek === 5) return true; // observed Friday if Dec 25 is Saturday
  if (month === 11 && day === 26 && dayOfWeek === 1) return true; // observed Monday if Dec 25 is Sunday
  
  return false;
}

/**
 * Move a date backward to the nearest preceding weekday that is not a US federal holiday.
 */
function moveToValidBusinessDay(date: Date): Date {
  const result = new Date(date);
  
  while (true) {
    const dayOfWeek = result.getUTCDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    if (!isWeekend && !isUSFederalHoliday(result)) {
      return result;
    }
    
    // Move back one day
    result.setUTCDate(result.getUTCDate() - 1);
  }
}

/** 
 * Deterministic appointment time for Jordan's advising session.
 * Returns a stable date: 10 days before the next registration term starts,
 * at 2:00 PM (14:00 UTC / 9:00 AM EST). If that date falls on a weekend or
 * US federal holiday, moves it backward to the nearest preceding valid
 * business day. This gives a realistic "upcoming appointment about his
 * submitted plan" that doesn't drift with the current date.
 */
function jordanAppointmentTime(now = new Date()) {
  const term = nextRegistrationTerm(now);
  const termRecord = academicTerms.find(t => t.season === term.season && t.year === term.year);
  if (!termRecord) throw new TestStudentError(`${term.season} ${term.year} is not in the seed data.`, 500);
  
  const tenDaysBefore = new Date(termRecord.startsOn);
  tenDaysBefore.setDate(tenDaysBefore.getDate() - 10);
  tenDaysBefore.setUTCHours(14, 0, 0, 0);
  
  return moveToValidBusinessDay(tenDaysBefore);
}

/**
 * Seed Jordan Hale's advising appointment with Sarah Martinez.
 * Creates a 30-minute confirmed session for academic planning discussion.
 */
async function ensureJordanAdvisingSession(studentId: string, advisorId: string, db: Db = prisma) {
  const appointmentTime = jordanAppointmentTime();
  const endTime = new Date(appointmentTime.getTime() + 30 * 60 * 1000);
  const durationMinutes = 30;
  
  const term = nextRegistrationTerm();
  const topic = `Academic planning for ${term.season === "FALL" ? "Fall" : "Spring"} ${term.year}`;
  
  const existingSession = await db.meetingSession.findFirst({
    where: { studentId, advisorId, status: MeetingSessionStatus.CONFIRMED },
    include: { availability: true },
  });
  
  if (
    existingSession
    && existingSession.startsAt.getTime() === appointmentTime.getTime()
    && existingSession.endsAt.getTime() === endTime.getTime()
    && existingSession.durationMinutes === durationMinutes
    && existingSession.topic === topic
  ) {
    return;
  }
  
  if (existingSession?.availabilityId) {
    await db.meetingAvailability.delete({ where: { id: existingSession.availabilityId } }).catch(() => {});
  }
  if (existingSession) {
    await db.meetingSession.delete({ where: { id: existingSession.id } });
  }
  
  const availabilityId = randomUUID();
  const sessionId = randomUUID();
  
  await db.meetingAvailability.create({
    data: {
      id: availabilityId,
      advisorId,
      startsAt: appointmentTime,
      endsAt: endTime,
      durationMinutes,
      status: MeetingSlotStatus.BOOKED,
      source: MeetingSlotSource.MANUAL,
    },
  });
  
  await db.meetingSession.create({
    data: {
      id: sessionId,
      studentId,
      advisorId,
      availabilityId,
      startsAt: appointmentTime,
      endsAt: endTime,
      durationMinutes,
      status: MeetingSessionStatus.CONFIRMED,
      topic,
    },
  });
}

/**
 * Clean up all advisor availability, schedules, and sessions.
 * This restores the baseline empty availability state that Test Manager expects after reset.
 * Call this before recreating Jordan's seeded appointment.
 */
async function cleanAdvisorAvailability(db: Db = prisma) {
  const sarahId = await db.user.findUnique({ 
    where: { email: sarahMartinezEmail },
    select: { id: true },
  }).then(u => u?.id);
  
  if (!sarahId) return;
  
  await db.meetingSession.deleteMany({ where: { advisorId: sarahId } });
  await db.meetingAvailability.deleteMany({ where: { advisorId: sarahId } });
  await db.advisorTermSchedule.deleteMany({ where: { advisorId: sarahId } });
  await db.advisorTermDraft.deleteMany({ where: { advisorId: sarahId } });
  await db.advisorMeetingSettings.deleteMany({ where: { advisorId: sarahId } });
}

async function writeFrozen(userId: string, student: TestStudent, catalogYearId: string, advisorId: string | null) {
  const planned = plannedAttempts(student);
  const isJordan = student.email === jordanEmail;
  
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
    
    // Get session availability IDs before deleting sessions, so we can clean up orphan slots
    const studentSessions = await tx.meetingSession.findMany({
      where: { studentId: profile.id },
      select: { availabilityId: true },
    });
    const availabilityIds = studentSessions.map(s => s.availabilityId).filter((id): id is string => id !== null);
    
    await tx.meetingSession.deleteMany({ where: { studentId: profile.id } });
    
    // Clean up availability slots that were linked to this student's sessions
    if (availabilityIds.length > 0) {
      await tx.meetingAvailability.deleteMany({ where: { id: { in: availabilityIds } } });
    }
    
    await tx.session.deleteMany({ where: { userId } });
    
    if (isJordan) {
      await cleanAdvisorAvailability(tx);
    }
    
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
    
    if (isJordan && advisorId) {
      await ensureJordanAdvisingSession(profile.id, advisorId, tx);
    }
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
    const userId = await ensureUser(advisor, password, true);
    
    if (advisor.email === sarahMartinezEmail) {
      const jordanUser = await prisma.user.findUnique({
        where: { email: jordanEmail },
        include: { studentProfile: true },
      });
      
      await prisma.$transaction(async tx => {
        await tx.session.deleteMany({ where: { userId } });
        await cleanAdvisorAvailability(tx);
        
        if (jordanUser?.studentProfile) {
          await ensureJordanAdvisingSession(jordanUser.studentProfile.id, userId, tx);
        }
      });
    } else {
      await prisma.session.deleteMany({ where: { userId } });
    }
    
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

async function fixtureCatalogMismatches(attempts: readonly FixtureAttempt[]) {
  if (attempts.length === 0) return [];
  const found = await prisma.course.findMany({
    where: { OR: attempts.map((attempt) => ({ subject: attempt.subject, number: attempt.number })) },
    select: { subject: true, number: true, credits: true },
  });
  const byCode = new Map(found.map((course) => [`${course.subject} ${course.number}`, course]));
  const mismatches: string[] = [];
  const seen = new Set<string>();
  for (const attempt of attempts) {
    const code = `${attempt.subject} ${attempt.number}`;
    if (seen.has(code)) continue;
    seen.add(code);
    const course = byCode.get(code);
    if (!course) mismatches.push(`${code} is not in the catalog. The account was not changed.`);
    else if (course.credits !== attempt.credits) {
      mismatches.push(`${code} is ${course.credits} credits in the catalog, and this fixture expects ${attempt.credits}. The account was not changed.`);
    }
  }
  return mismatches;
}

/** Replaces one fixture student's transcript. The browser sends a fixture id, not courses. */
export async function loadTestTranscriptFixture(request: Request, email: string, fixtureId: string) {
  guardTestStudents(request, email, true);
  const described = describeFixtureLoad(email, fixtureId);
  const existing = described.ok
    ? await prisma.user.findUnique({ where: { email: described.email }, select: { role: true } })
    : null;
  const mismatches = described.ok ? await fixtureCatalogMismatches(described.attempts) : [];
  const decision = await runFixtureLoad({
    email,
    fixtureId,
    existingRole: existing?.role ?? null,
    catalogMismatches: mismatches,
    replace: async () => {
      if (!described.ok) throw new TestStudentError("That is not a test student.", 400);
      const student = testStudentByEmail(described.email);
      if (!student) throw new TestStudentError("That is not a test student.", 400);
      const password = guardTestStudents(request, described.email, true);
      let catalogYearId: string;
      try {
        catalogYearId = await infoCatalogYearId();
      } catch (error) {
        if (error instanceof TestStudentError) {
          throw new TestStudentError(`${error.message} The account was not changed.`, error.status);
        }
        throw error;
      }
      await prisma.$transaction(async (tx) => {
        const current = await tx.user.findUnique({ where: { email: student.email }, select: { role: true } });
        if (current && current.role !== UserRole.STUDENT) {
          throw new TestStudentError("That account is not a test student.", 400);
        }
        const advisorEmail = assignedAdvisorEmail(student.email);
        const advisor = advisorEmail ? testAdvisorByEmail(advisorEmail) : null;
        if (advisorEmail && !advisor) throw new TestStudentError("Sarah Martinez is not a test advisor.", 500);
        const advisorId = advisor ? await ensureUser(advisor, password, false, tx) : null;
        const userId = await ensureUser(student, password, true, tx);
        const profile = await tx.studentProfile.upsert({
          where: { userId },
          create: { userId, catalogYearId, standing: student.standing, startConfirmedAt: frozenAt, advisorId },
          update: { catalogYearId, standing: student.standing, startConfirmedAt: frozenAt, advisorId, expectedGradTermId: null, notTakingTermId: null, bannerId: null, plannerWriteFault: null },
          select: { id: true },
        });
        const found = described.attempts.length === 0 ? [] : await tx.course.findMany({
          where: { OR: described.attempts.map((attempt) => ({ subject: attempt.subject, number: attempt.number })) },
          select: { id: true, subject: true, number: true, credits: true },
        });
        const byCode = new Map(found.map((course) => [`${course.subject} ${course.number}`, course]));
        const started = Date.UTC(2024, 0, 1);
        const rows = described.attempts.map((attempt, index) => {
          const code = `${attempt.subject} ${attempt.number}`;
          const course = byCode.get(code);
          if (!course) throw new TestStudentError(`${code} is not in the catalog. The account was not changed.`, 500);
          if (course.credits !== attempt.credits) {
            throw new TestStudentError(`${code} is ${course.credits} credits in the catalog, and this fixture expects ${attempt.credits}. The account was not changed.`, 500);
          }
          return {
            studentId: profile.id,
            courseId: course.id,
            credits: course.credits,
            grade: attempt.grade,
            status: attempt.status,
            source: attempt.source,
            createdAt: new Date(started + index * 86_400_000),
          };
        });
        await tx.plannedCourse.deleteMany({ where: { plannedTerm: { studentId: profile.id } } });
        await tx.plannedTerm.deleteMany({ where: { studentId: profile.id } });
        await tx.advisingAppointment.deleteMany({ where: { studentId: profile.id } });
        await tx.advisingNote.deleteMany({ where: { studentId: profile.id } });
        await tx.transcriptEntry.deleteMany({ where: { studentId: profile.id } });
        await tx.session.deleteMany({ where: { userId } });
        if (rows.length > 0) await tx.transcriptEntry.createMany({ data: rows });
      });
      return {
        email: described.email,
        name: described.name,
        fixture: described.fixture,
        attempts: described.summary.attempts,
        courses: described.summary.courses,
        completedCourses: described.summary.completedCourses,
        earnedCredits: described.summary.earnedCredits,
      };
    },
  });
  if (!decision.result) throw new TestStudentError(decision.error ?? "That transcript could not be loaded.", decision.status);
  return decision.result;
}

/** Deletes shared notes on fixture student plans. The request body is ignored. */
export async function resetTestPlanNotes(request: Request) {
  guardTestStudents(request);
  const where = testPlanNoteDeleteWhere();
  return prisma.$transaction(async (tx) => {
    const result = await tx.planNote.deleteMany({ where });
    return { deleted: result.count };
  });
}
