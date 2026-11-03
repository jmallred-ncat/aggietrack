import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { StudentStanding } from "./generated/prisma/client";
import { prisma } from "./prisma";
import { ensureTestStudents, resetTestStudent } from "./test-student-accounts";
import { computeDegreeProgress } from "./degree-progress";
import { computeGpa, computeHonors } from "./gpa";

/**
 * Integration test: Verify that test student reset produces exact expected values
 * 
 * This test creates actual database rows and verifies the computed credits/GPA/badges.
 * Run with: pnpm --filter aggietrack test lib/test-student-reset-integration.test.ts
 */

// Mock request with valid authorization
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

// Set required env vars for tests
process.env.VERCEL_ENV = "preview";
process.env.TEST_STUDENT_PASSWORD = "test-password-12345678";
process.env.TEST_STUDENT_RESET_SECRET = "test-secret-for-testing";

before(async () => {
  console.log("Setting up test database...");
  // Ensure the catalog is seeded (programs, courses, etc.)
  // In a real environment, the seed script would have run
});

after(async () => {
  console.log("Cleaning up test database...");
  await prisma.$disconnect();
});

test("Jordan Hale reset produces exact expected values", async () => {
  const email = "it.mid@example.test";
  
  // Reset the student
  await resetTestStudent(mockRequest(email), email);
  
  // Get the student's profile
  const user = await prisma.user.findUnique({
    where: { email },
    include: { studentProfile: true },
  });
  
  assert.ok(user, "Jordan Hale user should exist");
  assert.ok(user.studentProfile, "Jordan Hale should have a profile");
  assert.equal(user.studentProfile.standing, StudentStanding.JUNIOR, "Jordan should be a junior");
  
  // Compute progress
  const progress = await computeDegreeProgress(user.studentProfile.id);
  
  // Get transcript for GPA calculation
  const transcript = await prisma.transcriptEntry.findMany({
    where: { studentId: user.studentProfile.id },
    include: {
      course: { select: { subject: true, number: true } },
    },
  });
  
  const gpa = computeGpa(transcript as any);
  const honors = computeHonors(transcript as any);
  
  // Verify exact values
  console.log(`Jordan Hale: ${progress.earnedCredits} credits, ${progress.percentage}%, GPA ${gpa?.toFixed(2)}, Honor: ${honors.honor}, Eligible: ${honors.eligible}`);
  
  assert.equal(progress.earnedCredits, 45, "Jordan should have 45 earned credits");
  assert.equal(progress.percentage, "37.5", "Jordan should be at 37.5% progress");
  assert.ok(gpa !== null, "Jordan should have a GPA");
  assert.ok(Math.abs(gpa! - 3.41) < 0.01, `Jordan's GPA should be 3.41, got ${gpa?.toFixed(2)}`);
  assert.equal(honors.honor, "Cum Laude", "Jordan should have Cum Laude honor");
  assert.equal(honors.eligible, false, "Jordan should not be eligible yet (<48 hours)");
});

test("Casey Parker reset produces exact expected values", async () => {
  const email = "it.retake-c-to-a@example.test";
  
  // Reset the student
  await resetTestStudent(mockRequest(email), email);
  
  // Get the student's profile
  const user = await prisma.user.findUnique({
    where: { email },
    include: { studentProfile: true },
  });
  
  assert.ok(user, "Casey Parker user should exist");
  assert.ok(user.studentProfile, "Casey Parker should have a profile");
  
  // Compute progress
  const progress = await computeDegreeProgress(user.studentProfile.id);
  
  // Get transcript for GPA calculation
  const transcript = await prisma.transcriptEntry.findMany({
    where: { studentId: user.studentProfile.id },
    include: {
      course: { select: { subject: true, number: true } },
    },
  });
  
  const gpa = computeGpa(transcript as any);
  const honors = computeHonors(transcript as any);
  
  // Verify exact values
  console.log(`Casey Parker: ${progress.earnedCredits} credits, ${progress.percentage}%, GPA ${gpa?.toFixed(2)}, Honor: ${honors.honor}, Eligible: ${honors.eligible}`);
  
  assert.equal(progress.earnedCredits, 33, "Casey should have 33 earned credits");
  assert.equal(progress.percentage, "27.5", "Casey should be at 27.5% progress");
  assert.ok(gpa !== null, "Casey should have a GPA");
  assert.ok(Math.abs(gpa! - 3.61) < 0.01, `Casey's GPA should be 3.61, got ${gpa?.toFixed(2)}`);
  assert.equal(honors.honor, "Magna Cum Laude", "Casey should have Magna Cum Laude honor");
  assert.equal(honors.eligible, false, "Casey should not be eligible yet (<48 hours)");
});

test("Riley Brooks reset produces exact expected values", async () => {
  const email = "it.late@example.test";
  
  // Reset the student
  await resetTestStudent(mockRequest(email), email);
  
  // Get the student's profile
  const user = await prisma.user.findUnique({
    where: { email },
    include: { studentProfile: true },
  });
  
  assert.ok(user, "Riley Brooks user should exist");
  assert.ok(user.studentProfile, "Riley Brooks should have a profile");
  
  // Compute progress
  const progress = await computeDegreeProgress(user.studentProfile.id);
  
  // Get transcript for GPA calculation
  const transcript = await prisma.transcriptEntry.findMany({
    where: { studentId: user.studentProfile.id },
    include: {
      course: { select: { subject: true, number: true } },
    },
  });
  
  const gpa = computeGpa(transcript as any);
  const honors = computeHonors(transcript as any);
  
  // Verify exact values
  console.log(`Riley Brooks: ${progress.earnedCredits} credits, ${progress.percentage}%, GPA ${gpa?.toFixed(2)}, Honor: ${honors.honor}, Eligible: ${honors.eligible}`);
  
  assert.equal(progress.earnedCredits, 90, "Riley should have 90 earned credits");
  assert.equal(progress.percentage, "75.0", "Riley should be at 75% progress");
  assert.ok(gpa !== null, "Riley should have a GPA");
  assert.ok(Math.abs(gpa! - 3.64) < 0.01, `Riley's GPA should be 3.64, got ${gpa?.toFixed(2)}`);
  assert.equal(honors.honor, "Magna Cum Laude", "Riley should have Magna Cum Laude honor");
  assert.equal(honors.eligible, true, "Riley should be eligible (>=48 hours)");
});

test("Morgan Lee reset produces exact expected values", async () => {
  const email = "it.over-credits@example.test";
  
  // Reset the student
  await resetTestStudent(mockRequest(email), email);
  
  // Get the student's profile
  const user = await prisma.user.findUnique({
    where: { email },
    include: { studentProfile: true },
  });
  
  assert.ok(user, "Morgan Lee user should exist");
  assert.ok(user.studentProfile, "Morgan Lee should have a profile");
  
  // Compute progress
  const progress = await computeDegreeProgress(user.studentProfile.id);
  
  // Get transcript for GPA calculation
  const transcript = await prisma.transcriptEntry.findMany({
    where: { studentId: user.studentProfile.id },
    include: {
      course: { select: { subject: true, number: true } },
    },
  });
  
  const gpa = computeGpa(transcript as any);
  const honors = computeHonors(transcript as any);
  
  // Verify exact values
  console.log(`Morgan Lee: ${progress.earnedCredits} credits, ${progress.percentage}%, GPA ${gpa?.toFixed(2)}, Honor: ${honors.honor}, Eligible: ${honors.eligible}`);
  
  assert.equal(progress.earnedCredits, 120, "Morgan should have 120 earned credits");
  assert.equal(progress.percentage, "100.0", "Morgan should be at 100% progress");
  assert.ok(gpa !== null, "Morgan should have a GPA");
  assert.ok(Math.abs(gpa! - 3.98) < 0.01, `Morgan's GPA should be 3.98, got ${gpa?.toFixed(2)}`);
  assert.equal(honors.honor, "Summa Cum Laude", "Morgan should have Summa Cum Laude honor");
  assert.equal(honors.eligible, true, "Morgan should be eligible (>=48 hours)");
});

test("Avery Cole reset produces exact expected values", async () => {
  const email = "it.start@example.test";
  
  // Reset the student
  await resetTestStudent(mockRequest(email), email);
  
  // Get the student's profile
  const user = await prisma.user.findUnique({
    where: { email },
    include: { studentProfile: true },
  });
  
  assert.ok(user, "Avery Cole user should exist");
  assert.ok(user.studentProfile, "Avery Cole should have a profile");
  
  // Compute progress
  const progress = await computeDegreeProgress(user.studentProfile.id);
  
  // Get transcript for GPA calculation
  const transcript = await prisma.transcriptEntry.findMany({
    where: { studentId: user.studentProfile.id },
    include: {
      course: { select: { subject: true, number: true } },
    },
  });
  
  const gpa = computeGpa(transcript as any);
  const honors = computeHonors(transcript as any);
  
  // Verify exact values
  console.log(`Avery Cole: ${progress.earnedCredits} credits, ${progress.percentage}%, GPA ${gpa?.toFixed(2) || "null"}, Honor: ${honors.honor || "null"}, Eligible: ${honors.eligible}`);
  
  assert.equal(progress.earnedCredits, 0, "Avery should have 0 earned credits");
  assert.equal(progress.percentage, "0.0", "Avery should be at 0% progress");
  assert.equal(gpa, null, "Avery should have no GPA");
  assert.equal(honors.honor, null, "Avery should have no honor");
  assert.equal(honors.eligible, false, "Avery should not be eligible");
});
