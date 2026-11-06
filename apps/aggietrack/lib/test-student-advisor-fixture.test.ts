import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";

/**
 * Reset and ensure write Sarah's assignments and Jordan Hale's submitted plan.
 * Needs the seeded AggieTrack database. Skips when DATABASE_URL is unset.
 */
test(
  "student reset rebuilds Sarah's assignments and Jordan's submitted plan",
  { skip: process.env.DATABASE_URL ? false : "DATABASE_URL is not set" },
  async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.TEST_STUDENT_PASSWORD = "test-password-12345678";
    process.env.TEST_STUDENT_RESET_SECRET = "test-secret-for-testing";

    const { PlannedTermStatus } = await import("./generated/prisma/client");
    const { prisma } = await import("./prisma");
    const { ensureTestStudents, resetTestStudent } = await import("./test-student-accounts");
    const { jordanSubmittedPlan, michaelChenEmail, sarahMartinezEmail } = await import("./test-students");

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
      const expected = jordanSubmittedPlan();
      const plans = await prisma.plannedTerm.findMany({
        where: { studentId: profileId },
        include: {
          term: true,
          courses: { include: { course: true }, orderBy: { createdAt: "asc" } },
        },
      });
      assert.equal(plans.length, 1);
      const plan = plans[0]!;
      assert.equal(plan.status, PlannedTermStatus.SUBMITTED);
      assert.equal(plan.registrationPin, null);
      assert.equal(plan.reviewedAt, null);
      assert.equal(plan.registeredAt, null);
      assert.equal(plan.term.season, expected.term.season);
      assert.equal(plan.term.year, expected.term.year);
      assert.deepEqual(
        plan.courses.map((row) => ({ subject: row.course.subject, number: row.course.number })),
        expected.courses,
      );
      const credits = plan.courses.reduce((sum, row) => sum + row.course.credits, 0);
      assert.ok(credits >= 12 && credits <= 16, `submitted plan is ${credits} credits`);

      const transcript = await prisma.transcriptEntry.findMany({
        where: { studentId: profileId, status: { in: ["COMPLETED", "IN_PROGRESS"] } },
        include: { course: { select: { subject: true, number: true } } },
      });
      const taken = new Set(transcript.flatMap((row) => {
        if (row.course) return [`${row.course.subject} ${row.course.number}`];
        if (row.subject && row.number) return [`${row.subject} ${row.number}`];
        return [];
      }));
      for (const course of expected.courses) {
        assert.equal(taken.has(`${course.subject} ${course.number}`), false);
      }

      await prisma.plannedTerm.update({
        where: { id: plan.id },
        data: { status: PlannedTermStatus.APPROVED, registrationPin: "1234", reviewedAt: new Date() },
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
      await resetTestStudent(request(sarahMartinezEmail), sarahMartinezEmail);
      const afterAdvisorReset = await prisma.plannedTerm.findUniqueOrThrow({ where: { id: plan.id } });
      assert.equal(afterAdvisorReset.status, PlannedTermStatus.APPROVED);
      assert.equal(afterAdvisorReset.registrationPin, "1234");
      assert.equal(await advisorEmailOf("it.mid@example.test"), sarahMartinezEmail);
      assert.equal(await prisma.session.count({ where: { userId: sarah.id } }), 0);

      await prisma.transcriptEntry.create({
        data: {
          studentId: profileId,
          courseId: plan.courses[0]!.course.id,
          termId: plan.termId,
          credits: plan.courses[0]!.course.credits,
          status: "IN_PROGRESS",
          source: "NCAT",
        },
      });
      await resetTestStudent(request("it.mid@example.test"), "it.mid@example.test");
      const rebuilt = await prisma.plannedTerm.findMany({ where: { studentId: profileId } });
      assert.equal(rebuilt.length, 1);
      assert.equal(rebuilt[0]!.status, PlannedTermStatus.SUBMITTED);
      assert.equal(rebuilt[0]!.registrationPin, null);
      const approvedRows = await prisma.transcriptEntry.findMany({
        where: { studentId: profileId, courseId: plan.courses[0]!.course.id, status: "IN_PROGRESS" },
      });
      assert.equal(approvedRows.length, 0);
      assert.equal(await advisorEmailOf("it.mid@example.test"), sarahMartinezEmail);

      await prisma.studentProfile.update({ where: { id: profileId }, data: { advisorId: null } });
      await prisma.plannedCourse.deleteMany({ where: { plannedTerm: { studentId: profileId } } });
      await prisma.plannedTerm.deleteMany({ where: { studentId: profileId } });
      await ensureTestStudents(request());
      assert.equal(await advisorEmailOf("it.start@example.test"), sarahMartinezEmail);
      assert.equal(await advisorEmailOf("it.mid@example.test"), sarahMartinezEmail);
      assert.equal(await advisorEmailOf("it.late@example.test"), sarahMartinezEmail);
      assert.equal(await advisorEmailOf("it.retake-f-to-pass@example.test"), null);
      const restored = await prisma.plannedTerm.findMany({ where: { studentId: profileId } });
      assert.equal(restored.length, 1);
      assert.equal(restored[0]!.status, PlannedTermStatus.SUBMITTED);

      await prisma.plannedTerm.update({
        where: { id: restored[0]!.id },
        data: { status: PlannedTermStatus.APPROVED, registrationPin: "5678", reviewedAt: new Date() },
      });
      await ensureTestStudents(request());
      const kept = await prisma.plannedTerm.findUniqueOrThrow({ where: { id: restored[0]!.id } });
      assert.equal(kept.status, PlannedTermStatus.APPROVED);
      assert.equal(kept.registrationPin, "5678");

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
