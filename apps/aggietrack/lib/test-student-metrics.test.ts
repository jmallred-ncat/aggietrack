import assert from "node:assert/strict";
import { test } from "node:test";
import { applicableCredits, earnsDegreeCredit, meetsMinimumGrade, type ApplicableAttempt, type ApplicableCourse, type ApplicableGroup } from "./applicable-credits";
import { courseKey, courses as handbookCourses } from "../prisma/seed/courses";
import { cstCatalogCourses } from "../prisma/seed/cst-catalog";
import { gecAttributes, gecCourses } from "../prisma/seed/gec";
import { info2025 } from "../prisma/seed/info-2025";
import { mgmtCourses } from "../prisma/seed/mgmt";
import { Grade } from "./generated/prisma/client";
import { plannedAttempts, type PlannedAttempt } from "./frozen-transcript";
import { computeGpa, computeHonors } from "./gpa";
import { slotIsUnfilled } from "./progress-slots";
import { testStudents, type TestStudent } from "./test-students";

/**
 * Published results of the hand calculation in this file.
 * Quality points use the NC A&T scale in tenths so the sum does not depend on binary fractions.
 * GPA = round(quality-point tenths / graded hours) / 100, matching computeGpa's two-decimal round.
 */
const expected = {
  "it.start@example.test": { credits: 0, percentage: 0, gpa: null, adjusted: null, resident: 0 },
  "it.mid@example.test": { credits: 48, percentage: 40, gpa: 3.41, adjusted: 3.41, resident: 48 },
  "it.late@example.test": { credits: 92, percentage: 76.7, gpa: 3.64, adjusted: 3.64, resident: 86 },
  "it.retake-f-to-pass@example.test": { credits: 29, percentage: 24.2, gpa: 3.02, adjusted: 2.76, resident: 35 },
  "it.retake-c-to-a@example.test": { credits: 32, percentage: 26.7, gpa: 3.61, adjusted: 3.61, resident: 32 },
  "it.diverse-grades@example.test": { credits: 41, percentage: 34.2, gpa: 2.83, adjusted: 2.83, resident: 40 },
  "it.over-credits@example.test": { credits: 120, percentage: 100, gpa: 3.98, adjusted: 3.98, resident: 114 },
} as const;

const QUALITY_TENTHS: Record<string, number | null> = {
  A: 40,
  A_MINUS: 37,
  B_PLUS: 33,
  B: 30,
  B_MINUS: 27,
  C_PLUS: 23,
  C: 20,
  C_MINUS: 17,
  D_PLUS: 13,
  D: 10,
  F: 0,
  W: null,
  I: null,
  P: null,
  TR: null,
};

const catalog = new Map<string, number>();
for (const course of [...handbookCourses, ...cstCatalogCourses, ...gecCourses, ...mgmtCourses]) {
  catalog.set(courseKey(course), course.credits);
}

const tagsByCode = new Map<string, ApplicableCourse["tags"][number][]>();
for (const attribute of gecAttributes) {
  const code = courseKey(attribute.course);
  const tags = tagsByCode.get(code) ?? [];
  tags.push(attribute.tag);
  tagsByCode.set(code, tags);
}

const groups: ApplicableGroup[] = info2025.groups.map(group => ({
  id: group.name,
  slot: group.slot,
  minCredits: group.minCredits,
  minGrade: group.minGrade ?? null,
  subject: group.subject ?? null,
  minNumber: group.minNumber ?? null,
  genEdCategory: group.genEdCategory ?? null,
  requiredGenEdTag: group.requiredGenEdTag ?? null,
  courseIds: (group.courses ?? []).map(course => courseKey(course)),
  sortOrder: group.sortOrder,
}));

const groupByName = new Map(groups.map(group => [group.id, group]));
const groupByCourse = new Map<string, ApplicableGroup>();
for (const group of groups) {
  for (const courseId of group.courseIds) groupByCourse.set(courseId, group);
}

function creditsOf(attempt: PlannedAttempt) {
  const credits = catalog.get(courseKey(attempt));
  assert.ok(credits, `${attempt.subject} ${attempt.number} is missing from the catalog`);
  return credits;
}

function roundedGpa(tenths: number, hours: number) {
  if (hours === 0) return null;
  // Tenths are quality points × 10. Round to two decimals: round(tenths / hours × 10) / 100.
  return Math.round((tenths / hours) * 10) / 100;
}

function percentage(credits: number) {
  return Math.round(Math.min(100, (credits / 120) * 100) * 10) / 10;
}

/**
 * Independent of applicableCredits and computeGpa.
 * Progress: one credit load per course, skipping in-progress work, courses outside the plan,
 * F/W/I, and grades below the requirement minimum. GPA: best letter grade per course.
 * Adjusted GPA: every letter-graded attempt, including an earlier F.
 */
function handCalculation(student: TestStudent) {
  const attempts = plannedAttempts(student);
  const byCourse = new Map<string, Array<PlannedAttempt & { credits: number; index: number }>>();
  attempts.forEach((attempt, index) => {
    const code = `${attempt.subject} ${attempt.number}`;
    const rows = byCourse.get(code) ?? [];
    rows.push({ ...attempt, credits: creditsOf(attempt), index });
    byCourse.set(code, rows);
  });

  let progressCredits = 0;
  const progressByGroup = new Map<string, number>();
  let cumulativeTenths = 0;
  let cumulativeHours = 0;
  let adjustedTenths = 0;
  let adjustedHours = 0;

  for (const [code, rows] of byCourse) {
    const counting = rows.filter(row => {
      if (row.status !== "COMPLETED" || row.outsidePlan || !earnsDegreeCredit(row.grade)) return false;
      const group = row.slot ? groupByName.get(row.slot) : groupByCourse.get(courseKey(row));
      return Boolean(group) && meetsMinimumGrade(row.grade, group?.minGrade ?? null);
    });
    if (counting.length > 0) {
      const best = counting.reduce((left, right) => (QUALITY_TENTHS[right.grade!] ?? 0) > (QUALITY_TENTHS[left.grade!] ?? 0) ? right : left);
      progressCredits += best.credits;
      const group = best.slot ? groupByName.get(best.slot) : groupByCourse.get(courseKey(best));
      assert.ok(group, `${code} counted without a requirement`);
      progressByGroup.set(group.id, (progressByGroup.get(group.id) ?? 0) + best.credits);
    }

    const graded = rows.filter(row => row.status === "COMPLETED" && row.grade && QUALITY_TENTHS[row.grade] != null);
    if (graded.length > 0) {
      const best = [...graded].sort((left, right) => {
        const delta = (QUALITY_TENTHS[right.grade!] ?? 0) - (QUALITY_TENTHS[left.grade!] ?? 0);
        return delta !== 0 ? delta : right.index - left.index;
      })[0]!;
      cumulativeTenths += (QUALITY_TENTHS[best.grade!] ?? 0) * best.credits;
      cumulativeHours += best.credits;
    }

    for (const row of rows) {
      if (row.status !== "COMPLETED" || !row.grade || QUALITY_TENTHS[row.grade] == null) continue;
      adjustedTenths += (QUALITY_TENTHS[row.grade] ?? 0) * row.credits;
      adjustedHours += row.credits;
    }
  }

  for (const [name, used] of progressByGroup) {
    const group = groupByName.get(name);
    assert.ok(group && used <= group.minCredits, `${name} hand total ${used} exceeds ${group?.minCredits}`);
  }

  return {
    credits: progressCredits,
    percentage: percentage(progressCredits),
    gpa: roundedGpa(cumulativeTenths, cumulativeHours),
    adjusted: roundedGpa(adjustedTenths, adjustedHours),
    resident: adjustedHours,
  };
}

function productionProgress(student: TestStudent) {
  const attempts = plannedAttempts(student);
  const courses = new Map<string, ApplicableCourse>();
  const rows: ApplicableAttempt[] = attempts.map((attempt, index) => {
    const code = courseKey(attempt);
    courses.set(code, {
      id: code,
      subject: attempt.subject,
      number: attempt.number,
      tags: tagsByCode.get(code) ?? [],
    });
    return {
      courseId: code,
      subject: attempt.subject,
      number: attempt.number,
      credits: creditsOf(attempt),
      grade: attempt.grade,
      status: attempt.status,
      groupId: attempt.outsidePlan ? null : attempt.slot,
      requiresLab: attempt.requiresLab,
      order: attempt.sequence * 100 + index,
    };
  });
  return applicableCredits({
    groups,
    courses: [...courses.values()],
    attempts: rows,
    totalCredits: 120,
  });
}

function gpaEntries(student: TestStudent) {
  return plannedAttempts(student).map((attempt, index) => ({
    id: `${student.email}-${index}`,
    courseId: `${attempt.subject} ${attempt.number}`,
    subject: attempt.subject,
    number: attempt.number,
    credits: creditsOf(attempt),
    grade: attempt.grade,
    status: attempt.status,
    source: attempt.source,
    createdAt: new Date(Date.UTC(2024, 7, 15) + index * 86_400_000),
  }));
}

test("each test student's credits, percent, and GPA match an independent hand calculation", () => {
  assert.equal(testStudents.length, 7);
  for (const student of testStudents) {
    const hand = handCalculation(student);
    const published = expected[student.email as keyof typeof expected];
    assert.deepEqual(hand, published, student.email);

    const progress = productionProgress(student);
    assert.equal(progress.earnedCredits, hand.credits, `${student.email} credits`);
    assert.equal(progress.percentage, hand.percentage, `${student.email} percent`);
    assert.equal(progress.totalCredits, 120);

    const transcript = gpaEntries(student);
    assert.equal(computeGpa(transcript), hand.gpa, `${student.email} GPA`);
    const honors = computeHonors(transcript);
    assert.equal(honors.adjustedGpa, hand.adjusted, `${student.email} adjusted GPA`);
    assert.equal(honors.residentHours, hand.resident, `${student.email} resident hours`);
  }
});

test("Alex Rivera keeps JOUR 101 and one row each of P, TR, W, I, and F", () => {
  const alex = testStudents.find(student => student.email === "it.diverse-grades@example.test");
  assert.ok(alex);
  const attempts = plannedAttempts(alex);
  const jour = attempts.find(attempt => attempt.subject === "JOUR" && attempt.number === "101");
  assert.ok(jour);
  assert.equal(jour.outsidePlan, true);
  assert.equal(jour.grade, Grade.B);
  assert.equal(jour.slot, null);

  const gradeOf = (subject: string, number: string) => {
    const rows = attempts.filter(attempt => attempt.subject === subject && attempt.number === number);
    assert.equal(rows.length, 1, `${subject} ${number}`);
    return rows[0]!.grade;
  };
  assert.equal(gradeOf("ENGL", "100"), Grade.P);
  assert.equal(gradeOf("MATH", "110"), Grade.TR);
  assert.equal(gradeOf("CST", "130"), Grade.W);
  assert.equal(gradeOf("CST", "122"), Grade.I);
  assert.equal(gradeOf("HIST", "207"), Grade.F);

  const progress = productionProgress(alex);
  assert.equal(progress.earnedCredits, 41);
  const withJour = progress.earnedCredits;
  const withoutOutside = handCalculation(alex).credits;
  assert.equal(withJour, withoutOutside);
});

test("a later attempt exists only after F, W, or a D that does not meet the major minimum", () => {
  for (const student of testStudents) {
    const byCourse = new Map<string, PlannedAttempt[]>();
    for (const attempt of plannedAttempts(student)) {
      const code = `${attempt.subject} ${attempt.number}`;
      const rows = byCourse.get(code) ?? [];
      rows.push(attempt);
      byCourse.set(code, rows);
    }
    for (const [code, rows] of byCourse) {
      for (const earlier of rows.slice(0, -1)) {
        assert.ok(
          earlier.grade === Grade.F || earlier.grade === Grade.W || earlier.grade === Grade.D,
          `${student.email} ${code} continues after ${earlier.grade}`,
        );
      }
    }
  }
});

test("a copied blank elective slot is still unfilled", () => {
  const blank = { courseId: "", subject: "", number: "", title: "", credits: "", status: "" as const };
  const copy = { ...blank };
  assert.equal(copy === blank, false);
  assert.equal(slotIsUnfilled(copy), true);
  assert.equal(slotIsUnfilled({ ...copy, courseId: "course" }), false);
});
