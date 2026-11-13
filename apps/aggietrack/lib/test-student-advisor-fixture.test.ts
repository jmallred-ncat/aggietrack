import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";

/**
 * Reset and ensure write Sarah's assignments. Jordan's planner is left empty.
 * Needs the seeded AggieTrack database. Skips when DATABASE_URL is unset.
 */
test(
  "student reset rebuilds Sarah's assignments and leaves planners empty",
  { skip: process.env.DATABASE_URL ? false : "DATABASE_URL is not set" },
  async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.TEST_STUDENT_PASSWORD = "test-password-12345678";
    process.env.TEST_STUDENT_RESET_SECRET = "test-secret-for-testing";

    const { PlannedTermStatus, MeetingSessionStatus } = await import("./generated/prisma/client");
    const { prisma } = await import("./prisma");
    const { ensureTestStudents, resetTestStudent } = await import("./test-student-accounts");
    const { michaelChenEmail, sarahMartinezEmail } = await import("./test-students");

    const secret = process.env.TEST_STUDENT_RESET_SECRET;
    const request = (email?: string) => new Request("http://localhost:3000/api/test-students/reset", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(email ? { email } : {}),
    });

    async function advisorEmailOf(studentEmail: string) {
      const user = await prisma.user.findUniqueOrThrow({
        where: { email: studentEmail },
        include: { studentProfile: { include: { advisor: { select: { email: true } } } } },
      });
      return user.studentProfile?.advisor?.email ?? null;
    }

    try {
      await resetTestStudent(request("it.start@example.test"), "it.start@example.test");
      await resetTestStudent(request("it.mid@example.test"), "it.mid@example.test");
      await resetTestStudent(request("it.late@example.test"), "it.late@example.test");
      await resetTestStudent(request("it.retake-f-to-pass@example.test"), "it.retake-f-to-pass@example.test");

      assert.equal(await advisorEmailOf("it.start@example.test"), sarahMartinezEmail);
      assert.equal(await advisorEmailOf("it.mid@example.test"), sarahMartinezEmail);
      assert.equal(await advisorEmailOf("it.late@example.test"), sarahMartinezEmail);
      assert.equal(await advisorEmailOf("it.retake-f-to-pass@example.test"), null);

      const jordan = await prisma.user.findUniqueOrThrow({
        where: { email: "it.mid@example.test" },
        include: { studentProfile: true },
      });
      const profileId = jordan.studentProfile!.id;
      
      // After reset, Jordan should have no planned terms (clean planner)
      const plans = await prisma.plannedTerm.findMany({
        where: { studentId: profileId },
      });
      assert.equal(plans.length, 0, "Jordan should have no plans after reset");
      
      // Jordan should have a seeded advising session
      const session = await prisma.meetingSession.findFirst({
        where: { studentId: profileId, status: MeetingSessionStatus.CONFIRMED },
      });
      assert.ok(session, "Jordan should have a seeded advising session");
      assert.equal(session.durationMinutes, 30, "Session should be 30 minutes");
      assert.ok(session.topic?.includes("planning"), "Session should be about planning");

      // Create a plan for Jordan to test that advisor reset doesn't touch it
      const term = await prisma.academicTerm.findFirstOrThrow({
        where: { season: { in: ["FALL", "SPRING"] } },
        orderBy: { startsOn: "desc" },
      });
      const course = await prisma.course.findFirstOrThrow({
        where: { subject: "CST" },
      });
      const plan = await prisma.plannedTerm.create({
        data: {
          studentId: profileId,
          termId: term.id,
          status: PlannedTermStatus.APPROVED,
          registrationPin: "1234",
          reviewedAt: new Date(),
          courses: {
            create: { courseId: course.id },
          },
        },
      });

      const sarah = await prisma.user.findUniqueOrThrow({ where: { email: sarahMartinezEmail } });
      await prisma.session.create({
        data: {
          id: randomUUID(),
          token: randomUUID(),
          expiresAt: new Date(Date.now() + 86_400_000),
          userId: sarah.id,
        },
      });
      
      // Advisor reset should not touch student plans, only sign out and restore Jordan's session
      await resetTestStudent(request(sarahMartinezEmail), sarahMartinezEmail);
      const afterAdvisorReset = await prisma.plannedTerm.findUnique({ where: { id: plan.id } });
      assert.ok(afterAdvisorReset, "Plan should still exist after advisor reset");
      assert.equal(await advisorEmailOf("it.mid@example.test"), sarahMartinezEmail);
      assert.equal(await prisma.session.count({ where: { userId: sarah.id } }), 0);

      // Student reset should clear the plan
      await resetTestStudent(request("it.mid@example.test"), "it.mid@example.test");
      const afterStudentReset = await prisma.plannedTerm.findMany({ where: { studentId: profileId } });
      assert.equal(afterStudentReset.length, 0, "Plan should be deleted after student reset");
      assert.equal(await advisorEmailOf("it.mid@example.test"), sarahMartinezEmail);

      // ensureTestStudents should not restore any plan
      await ensureTestStudents(request());
      assert.equal(await advisorEmailOf("it.start@example.test"), sarahMartinezEmail);
      assert.equal(await advisorEmailOf("it.mid@example.test"), sarahMartinezEmail);
      assert.equal(await advisorEmailOf("it.late@example.test"), sarahMartinezEmail);
      assert.equal(await advisorEmailOf("it.retake-f-to-pass@example.test"), null);
      const ensured = await prisma.plannedTerm.findMany({ where: { studentId: profileId } });
      assert.equal(ensured.length, 0, "ensureTestStudents should not restore any plan");

      const michael = await prisma.user.findUniqueOrThrow({
        where: { email: michaelChenEmail },
        include: { advisees: { select: { id: true } } },
      });
      assert.equal(michael.advisees.length, 0);
    } finally {
      await prisma.$disconnect();
    }
  },
);
