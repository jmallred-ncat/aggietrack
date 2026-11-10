import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { randomUUID } from "node:crypto";
import { MeetingSessionStatus, MeetingSlotStatus, MeetingSlotSource } from "./generated/prisma/client";
import { prisma } from "./prisma";
import { resetTestStudent } from "./test-student-accounts";
import { nextRegistrationTerm, sarahMartinezEmail } from "./test-students";
import { academicTerms } from "../prisma/seed/academic-terms";

/**
 * Test: Verify advisor availability reset behavior
 * 
 * This test ensures that:
 * 1. Jordan's reset creates his seeded advising appointment with Sarah
 * 2. Jordan's reset wipes Sarah's other availability (schedules, sessions, open times)
 * 3. Avery/Riley reset does NOT wipe Sarah's availability
 * 4. Sarah's advisor reset wipes and restores only Jordan's session
 * 
 * Run with: pnpm --filter aggietrack test lib/test-student-advisor-availability-reset.test.ts
 */

const mockRequest = (email?: string) => {
  const secret = process.env.TEST_STUDENT_RESET_SECRET || "test-secret-for-testing";
  return new Request("http://localhost:3000/api/test-students/reset", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });
};

process.env.VERCEL_ENV = "preview";
process.env.TEST_STUDENT_PASSWORD = "test-password-12345678";
process.env.TEST_STUDENT_RESET_SECRET = "test-secret-for-testing";

before(async () => {
  console.log("Setting up advisor availability reset tests...");
});

after(async () => {
  console.log("Cleaning up advisor availability reset tests...");
  await prisma.$disconnect();
});

async function getSarahId() {
  const sarah = await prisma.user.findUnique({
    where: { email: sarahMartinezEmail },
    select: { id: true },
  });
  return sarah?.id ?? null;
}

async function getStudentProfileId(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { studentProfile: true },
  });
  return user?.studentProfile?.id ?? null;
}

async function createDirtySarahAvailability(sarahId: string) {
  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
  
  const termRecord = academicTerms.find(t => t.season === "FALL" && t.year === 2026);
  if (!termRecord) throw new Error("Fall 2026 term not found");
  
  const term = await prisma.academicTerm.findUnique({
    where: { season_year: { season: termRecord.season, year: termRecord.year } },
    select: { id: true },
  });
  if (!term) throw new Error("Fall 2026 term not seeded");
  
  await prisma.meetingAvailability.create({
    data: {
      advisorId: sarahId,
      startsAt: now,
      endsAt: oneHourLater,
      durationMinutes: 60,
      status: MeetingSlotStatus.OPEN,
      source: MeetingSlotSource.MANUAL,
    },
  });
  
  await prisma.advisorTermSchedule.create({
    data: {
      advisorId: sarahId,
      termId: term.id,
      config: { days: ["MONDAY"], startTime: "09:00", endTime: "17:00" },
      version: 1,
    },
  });
  
  await prisma.advisorTermDraft.create({
    data: {
      advisorId: sarahId,
      termId: term.id,
      config: { days: ["TUESDAY"], startTime: "10:00", endTime: "16:00" },
      version: 1,
    },
  });
}

async function countSarahAvailability() {
  const sarahId = await getSarahId();
  if (!sarahId) return { availability: 0, schedules: 0, drafts: 0, sessions: 0 };
  
  const [availability, schedules, drafts, sessions] = await Promise.all([
    prisma.meetingAvailability.count({ where: { advisorId: sarahId } }),
    prisma.advisorTermSchedule.count({ where: { advisorId: sarahId } }),
    prisma.advisorTermDraft.count({ where: { advisorId: sarahId } }),
    prisma.meetingSession.count({ where: { advisorId: sarahId, status: MeetingSessionStatus.CONFIRMED } }),
  ]);
  
  return { availability, schedules, drafts, sessions };
}

async function getJordanSession() {
  const jordanId = await getStudentProfileId("it.mid@example.test");
  const sarahId = await getSarahId();
  
  if (!jordanId || !sarahId) return null;
  
  return prisma.meetingSession.findFirst({
    where: {
      studentId: jordanId,
      advisorId: sarahId,
      status: MeetingSessionStatus.CONFIRMED,
    },
    include: {
      availability: true,
    },
  });
}

function expectedJordanAppointmentTime() {
  const term = nextRegistrationTerm();
  const termRecord = academicTerms.find(t => t.season === term.season && t.year === term.year);
  if (!termRecord) throw new Error(`${term.season} ${term.year} not found`);
  
  const tenDaysBefore = new Date(termRecord.startsOn);
  tenDaysBefore.setDate(tenDaysBefore.getDate() - 10);
  tenDaysBefore.setUTCHours(14, 0, 0, 0);
  return tenDaysBefore;
}

test("Jordan reset wipes Sarah's availability and creates seeded appointment", async () => {
  const sarahId = await getSarahId();
  assert.ok(sarahId, "Sarah Martinez should exist");
  
  await createDirtySarahAvailability(sarahId);
  
  const beforeCounts = await countSarahAvailability();
  assert.equal(beforeCounts.availability, 1, "Should have 1 open slot before reset");
  assert.equal(beforeCounts.schedules, 1, "Should have 1 schedule before reset");
  assert.equal(beforeCounts.drafts, 1, "Should have 1 draft before reset");
  
  await resetTestStudent(mockRequest("it.mid@example.test"), "it.mid@example.test");
  
  const afterCounts = await countSarahAvailability();
  assert.equal(afterCounts.schedules, 0, "Schedules should be wiped");
  assert.equal(afterCounts.drafts, 0, "Drafts should be wiped");
  assert.equal(afterCounts.sessions, 1, "Should have exactly 1 session (Jordan's seeded)");
  assert.equal(afterCounts.availability, 1, "Should have exactly 1 availability (Jordan's slot)");
  
  const session = await getJordanSession();
  assert.ok(session, "Jordan should have a seeded session");
  assert.equal(session.durationMinutes, 30, "Session should be 30 minutes");
  assert.ok(session.topic?.includes("plan"), "Session should be about plan review");
  assert.ok(session.availability, "Session should have linked availability");
  assert.equal(session.availability.status, MeetingSlotStatus.BOOKED, "Slot should be booked");
  
  const expectedTime = expectedJordanAppointmentTime();
  assert.equal(
    session.startsAt.getTime(),
    expectedTime.getTime(),
    "Session should start at expected time (10 days before next term, 2 PM UTC)"
  );
});

test("Avery reset does NOT wipe Sarah's availability", async () => {
  const sarahId = await getSarahId();
  assert.ok(sarahId, "Sarah Martinez should exist");
  
  await createDirtySarahAvailability(sarahId);
  
  const beforeCounts = await countSarahAvailability();
  assert.equal(beforeCounts.availability, 1, "Should have availability before Avery reset");
  assert.equal(beforeCounts.schedules, 1, "Should have schedule before Avery reset");
  
  await resetTestStudent(mockRequest("it.start@example.test"), "it.start@example.test");
  
  const afterCounts = await countSarahAvailability();
  assert.equal(afterCounts.availability, 1, "Availability should remain after Avery reset");
  assert.equal(afterCounts.schedules, 1, "Schedule should remain after Avery reset");
  assert.equal(afterCounts.drafts, 1, "Draft should remain after Avery reset");
  
  console.log("✓ Avery reset preserved Sarah's availability (did not wipe)");
});

test("Riley reset does NOT wipe Sarah's availability", async () => {
  const sarahId = await getSarahId();
  assert.ok(sarahId, "Sarah Martinez should exist");
  
  await createDirtySarahAvailability(sarahId);
  
  const beforeCounts = await countSarahAvailability();
  assert.ok(beforeCounts.availability > 0, "Should have availability before Riley reset");
  
  await resetTestStudent(mockRequest("it.late@example.test"), "it.late@example.test");
  
  const afterCounts = await countSarahAvailability();
  assert.ok(afterCounts.availability > 0, "Availability should remain after Riley reset");
  
  console.log("✓ Riley reset preserved Sarah's availability (did not wipe)");
});

test("Sarah advisor reset wipes availability and restores Jordan's session", async () => {
  const sarahId = await getSarahId();
  assert.ok(sarahId, "Sarah Martinez should exist");
  
  await createDirtySarahAvailability(sarahId);
  
  await resetTestStudent(mockRequest(sarahMartinezEmail), sarahMartinezEmail);
  
  const afterCounts = await countSarahAvailability();
  assert.equal(afterCounts.schedules, 0, "Schedules should be wiped after advisor reset");
  assert.equal(afterCounts.drafts, 0, "Drafts should be wiped after advisor reset");
  assert.equal(afterCounts.sessions, 1, "Should have exactly 1 session (Jordan's seeded)");
  assert.equal(afterCounts.availability, 1, "Should have exactly 1 availability (Jordan's slot)");
  
  const session = await getJordanSession();
  assert.ok(session, "Jordan's session should be restored after advisor reset");
  assert.equal(session.durationMinutes, 30, "Restored session should be 30 minutes");
});

test("Jordan's seeded appointment has correct linked availability", async () => {
  await resetTestStudent(mockRequest("it.mid@example.test"), "it.mid@example.test");
  
  const session = await getJordanSession();
  assert.ok(session, "Jordan should have a session");
  assert.ok(session.availabilityId, "Session should have availabilityId");
  assert.ok(session.availability, "Session should have linked availability");
  assert.equal(session.availability.id, session.availabilityId, "IDs should match");
  assert.equal(session.availability.advisorId, session.advisorId, "Advisor IDs should match");
  assert.equal(
    session.availability.startsAt.getTime(),
    session.startsAt.getTime(),
    "Start times should match"
  );
  assert.equal(
    session.availability.endsAt.getTime(),
    session.endsAt.getTime(),
    "End times should match"
  );
});
