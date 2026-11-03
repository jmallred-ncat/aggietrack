import assert from "node:assert/strict";
import { test } from "node:test";

/**
 * Reset All on a database that already has students. The catalog seed does not
 * run again, and JOUR 101 must not be a catalog course. Alex typed it into a
 * free-elective slot, so the transcript row carries the subject, number, title,
 * and credits with no course id.
 */
test(
  "reset on an existing database writes Alex Rivera's typed JOUR 101",
  { skip: process.env.DATABASE_URL ? false : "DATABASE_URL is not set" },
  async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.TEST_STUDENT_PASSWORD = "test-password-12345678";
    process.env.TEST_STUDENT_RESET_SECRET = "test-secret-for-testing";

    const { Grade, TranscriptSource, TranscriptStatus } = await import("./generated/prisma/client");
    const { prisma } = await import("./prisma");
    const { resetTestStudent } = await import("./test-student-accounts");
    const { computeDegreeProgress } = await import("./degree-progress");
    const { computeGpa } = await import("./gpa");

    const email = "it.diverse-grades@example.test";
    const secret = process.env.TEST_STUDENT_RESET_SECRET;
    const request = () => new Request("http://localhost:3000/api/test-students/reset", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    async function expectAlex() {
      const catalog = await prisma.course.findUnique({
        where: { subject_number: { subject: "JOUR", number: "101" } },
      });
      assert.equal(catalog, null, "JOUR 101 stays out of the catalog");

      const user = await prisma.user.findUniqueOrThrow({
        where: { email },
        include: { studentProfile: true },
      });
      assert.ok(user.studentProfile);
      const transcript = await prisma.transcriptEntry.findMany({
        where: { studentId: user.studentProfile.id },
        include: {
          course: { select: { subject: true, number: true } },
          recommendedTermCourse: {
            select: {
              requirementGroup: { select: { name: true } },
              term: { select: { sequence: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      const jourRows = transcript.filter(row => row.subject === "JOUR" && row.number === "101");
      assert.equal(jourRows.length, 1);
      const jour = jourRows[0]!;
      assert.equal(jour.courseId, null);
      assert.equal(jour.title, "Introduction to Journalism");
      assert.equal(jour.credits, 3);
      assert.equal(jour.grade, Grade.B);
      assert.equal(jour.recommendedTermCourse?.requirementGroup?.name, "Free Electives");
      assert.equal(jour.recommendedTermCourse?.term.sequence, 7);

      const gradeOf = (subject: string, number: string) =>
        transcript.find(row => row.course?.subject === subject && row.course.number === number)?.grade;
      assert.equal(gradeOf("ENGL", "100"), Grade.P);
      assert.equal(gradeOf("MATH", "110"), Grade.TR);
      assert.equal(gradeOf("CST", "130"), Grade.W);
      assert.equal(gradeOf("CST", "122"), Grade.I);
      assert.equal(gradeOf("HIST", "207"), Grade.F);

      const progress = await computeDegreeProgress(user.studentProfile.id);
      assert.equal(progress.earnedCredits, 44);
      assert.equal(progress.percentage, 36.7);
      assert.equal(computeGpa(transcript), 2.83);
    }

    try {
      await prisma.course.upsert({
        where: { subject_number: { subject: "JOUR", number: "101" } },
        update: { title: "Introduction to Journalism", credits: 3 },
        create: { subject: "JOUR", number: "101", title: "Introduction to Journalism", credits: 3 },
      });
      await resetTestStudent(request(), email);
      await expectAlex();

      const user = await prisma.user.findUniqueOrThrow({
        where: { email },
        include: { studentProfile: true },
      });
      await prisma.transcriptEntry.create({
        data: {
          studentId: user.studentProfile!.id,
          subject: "JOUR",
          number: "101",
          title: "Stale title",
          credits: 3,
          grade: Grade.A,
          status: TranscriptStatus.COMPLETED,
          source: TranscriptSource.NCAT,
        },
      });
      await resetTestStudent(request(), email);
      await expectAlex();
    } finally {
      await prisma.$disconnect();
    }
  },
);
