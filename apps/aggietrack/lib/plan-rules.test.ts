import assert from "node:assert/strict";
import { test } from "node:test";
import { academicTermLabel } from "./academic-term";
import { plannedAttempts } from "./frozen-transcript";
import { TermSeason, TranscriptStatus } from "./generated/prisma/client";
import { courseKey, concurrentPairs, courses as handbookCourses, type CourseRef } from "../prisma/seed/courses";
import { cstCatalogCourses, cstCatalogGroups } from "../prisma/seed/cst-catalog";
import { gecCatalogGroups, gecCourses } from "../prisma/seed/gec";
import { mgmtCatalogGroups, mgmtCourses } from "../prisma/seed/mgmt";
import type { PrerequisiteGroupSeed } from "../prisma/seed/prerequisite-text";
import {
  approveDecision,
  claimDraftPlan,
  planRuleViolations,
  submitDecision,
  violationsAfterRemoval,
  type PlannedTermSnapshot,
  type RuleCourse,
  type RuleGroup,
} from "./plan-rules";
import {
  jordanSubmittedPlan,
  plannedCoursesAfterReset,
  testStudents,
  type FixtureCourse,
} from "./test-students";

const rawEnum = /\b(FALL|SPRING|SUMMER_I|SUMMER_II|DRAFT|SUBMITTED|APPROVED|IN_PROGRESS|COMPLETED)\b/;

type CatalogMeta = { isLab: boolean; offeredIn: TermSeason[] };

const meta = new Map<string, CatalogMeta>();
for (const course of [...cstCatalogCourses, ...gecCourses, ...mgmtCourses, ...handbookCourses]) {
  const key = courseKey(course);
  const prior = meta.get(key);
  meta.set(key, {
    isLab: Boolean(course.isLab || prior?.isLab),
    offeredIn: course.offeredIn && course.offeredIn.length > 0 ? [...course.offeredIn] : prior?.offeredIn ?? [],
  });
}

const groups = new Map<string, RuleGroup[]>();

function displayCode(course: CourseRef) {
  return `${course.subject} ${course.number}`;
}

function addGroup(course: CourseRef, isConcurrent: boolean, options: CourseRef[], note: string | null) {
  const optionRows = options.flatMap((option) => {
    const id = courseKey(option);
    const info = meta.get(id);
    if (!info) return [];
    return [{ id, code: displayCode(option), isLab: info.isLab }];
  });
  if (optionRows.length === 0 && options.length > 0 && !note) return;
  const key = courseKey(course);
  const list = groups.get(key) ?? [];
  const signature = `${isConcurrent}|${optionRows.map((option) => option.id).sort().join(",")}`;
  const existing = list.some((group) => {
    const current = `${group.isConcurrent}|${group.options.map((option) => option.id).sort().join(",")}`;
    return current === signature;
  });
  if (existing) return;
  list.push({ isConcurrent, options: optionRows });
  groups.set(key, list);
}

function loadGroups(seeds: PrerequisiteGroupSeed[]) {
  for (const [lecture, lab] of concurrentPairs) {
    addGroup(lecture, true, [lab], null);
    addGroup(lab, true, [lecture], null);
  }
  for (const group of seeds) {
    if (group.isConcurrent && group.options.length === 1) continue;
    addGroup(group.course, group.isConcurrent, group.options, group.note);
  }
}

loadGroups([...cstCatalogGroups, ...gecCatalogGroups, ...mgmtCatalogGroups]);

function ruleCourse(course: CourseRef): RuleCourse {
  const key = courseKey(course);
  const info = meta.get(key);
  assert.ok(info, `${displayCode(course)} is not in the catalog`);
  return {
    id: key,
    code: displayCode(course),
    isLab: info.isLab,
    offeredIn: info.offeredIn,
    groups: groups.get(key) ?? [],
  };
}

function standingFor(studentEmail: string) {
  const student = testStudents.find((item) => item.email === studentEmail);
  assert.ok(student);
  const attempts = plannedAttempts(student);
  return {
    student,
    satisfied: new Set(
      attempts
        .filter((row) => row.status === TranscriptStatus.COMPLETED || row.status === TranscriptStatus.IN_PROGRESS)
        .map((row) => courseKey(row)),
    ),
    completed: new Set(
      attempts
        .filter((row) => row.status === TranscriptStatus.COMPLETED)
        .map((row) => courseKey(row)),
    ),
  };
}

function checkPlan(courses: FixtureCourse[], season: TermSeason, termLabel: string, studentEmail: string) {
  const standing = standingFor(studentEmail);
  return planRuleViolations({
    courses: courses.map((course) => ruleCourse(course)),
    season,
    termLabel,
    satisfiedCourseIds: standing.satisfied,
    completedCourseIds: standing.completed,
  });
}

function assertHuman(messages: readonly string[]) {
  assert.ok(messages.length > 0);
  for (const message of messages) {
    assert.match(message, /\.$/);
    assert.doesNotMatch(message, rawEnum, message);
  }
}

function snapshot(termLabel: string, season: TermSeason, startsOn: number, courses: CourseRef[]): PlannedTermSnapshot {
  return {
    termLabel,
    season,
    startsOn,
    courses: courses.map((course) => ruleCourse(course)),
  };
}

test("submit with a broken prerequisite is rejected", () => {
  const violations = planRuleViolations({
    courses: [ruleCourse({ subject: "CST", number: "112" }), ruleCourse({ subject: "CST", number: "122" })],
    season: TermSeason.SPRING,
    termLabel: "Spring 2027",
    satisfiedCourseIds: new Set(),
    completedCourseIds: new Set(),
  });
  const decision = submitDecision({ courseCount: 2, violations });

  assert.equal(decision.success, false);
  if (!decision.success) {
    assert.ok(decision.violations?.some((message) => message.includes("CST 112 needs MATH 110 or CST 120")));
    assertHuman(decision.violations ?? []);
  }
  assert.deepEqual(submitDecision({ courseCount: 0, violations: [] }), {
    success: false,
    error: "Add at least one course before submitting.",
  });
});

test("approve with a broken corequisite or offering is rejected", () => {
  const corequisite = planRuleViolations({
    courses: [ruleCourse({ subject: "CST", number: "122" })],
    season: TermSeason.SPRING,
    termLabel: "Spring 2027",
    satisfiedCourseIds: new Set([courseKey({ subject: "MATH", number: "110" })]),
    completedCourseIds: new Set([courseKey({ subject: "MATH", number: "110" })]),
  });
  const corequisiteDecision = approveDecision(corequisite);
  assert.equal(corequisiteDecision.success, false);
  if (!corequisiteDecision.success) {
    assert.ok(corequisiteDecision.violations?.some((message) =>
      message === "CST 122 must be taken with CST 112 in Spring 2027.",
    ));
    assertHuman(corequisiteDecision.violations ?? []);
  }

  const offering = planRuleViolations({
    courses: [ruleCourse({ subject: "CST", number: "212" })],
    season: TermSeason.SPRING,
    termLabel: "Spring 2027",
    satisfiedCourseIds: new Set([courseKey({ subject: "CST", number: "112" })]),
    completedCourseIds: new Set([courseKey({ subject: "CST", number: "112" })]),
  });
  const offeringDecision = approveDecision(offering);
  assert.equal(offeringDecision.success, false);
  if (!offeringDecision.success) {
    assert.ok(offeringDecision.violations?.some((message) =>
      message.includes("CST 212 is not offered in Spring 2027"),
    ));
    assert.ok(offeringDecision.violations?.some((message) => message.includes("Fall")));
    assertHuman(offeringDecision.violations ?? []);
  }
});

test("a second tab cannot write after the plan is submitted", async () => {
  let status: "DRAFT" | "SUBMITTED" = "DRAFT";
  const courses = ["CST 130"];

  const updateMany = async (args: {
    where: { id: string; studentId: string; status: "DRAFT" };
    data: { status?: "SUBMITTED"; updatedAt?: Date };
  }) => {
    assert.equal(args.where.status, "DRAFT");
    assert.equal(args.where.id, "plan-1");
    assert.equal(args.where.studentId, "student-1");
    if (status !== "DRAFT") return { count: 0 };
    if (args.data.status === "SUBMITTED") status = "SUBMITTED";
    return { count: 1 };
  };

  const submitted = await claimDraftPlan(
    updateMany,
    { id: "plan-1", studentId: "student-1" },
    { status: "SUBMITTED", submittedAt: new Date("2026-11-04T16:00:00.000Z") },
  );
  assert.equal(submitted, true);
  assert.equal(status, "SUBMITTED");

  const secondWrite = await claimDraftPlan(
    updateMany,
    { id: "plan-1", studentId: "student-1" },
    { updatedAt: new Date("2026-11-04T16:00:01.000Z") },
  );
  if (secondWrite) courses.push("CST 140");

  assert.equal(secondWrite, false);
  assert.deepEqual(courses, ["CST 130"]);
});

test("removing a course a later course or lab depends on reports the violation", () => {
  const fall = snapshot("Fall 2026", TermSeason.FALL, Date.parse("2026-08-19T00:00:00.000Z"), [
    { subject: "CST", number: "120" },
  ]);
  const spring = snapshot("Spring 2027", TermSeason.SPRING, Date.parse("2027-01-11T00:00:00.000Z"), [
    { subject: "CST", number: "112" },
    { subject: "CST", number: "122" },
  ]);
  const later = violationsAfterRemoval({
    removedCourseId: courseKey({ subject: "CST", number: "120" }),
    terms: [fall, spring],
    transcriptSatisfiedIds: new Set(),
    completedCourseIds: new Set(),
  });
  assert.ok(later.some((message) => message === "CST 112 needs MATH 110 or CST 120 before Spring 2027."));
  assertHuman(later);

  const pair = snapshot("Spring 2027", TermSeason.SPRING, Date.parse("2027-01-11T00:00:00.000Z"), [
    { subject: "CST", number: "112" },
    { subject: "CST", number: "122" },
  ]);
  const satisfied = new Set([courseKey({ subject: "MATH", number: "110" })]);
  const lab = violationsAfterRemoval({
    removedCourseId: courseKey({ subject: "CST", number: "112" }),
    terms: [pair],
    transcriptSatisfiedIds: satisfied,
    completedCourseIds: satisfied,
  });
  assert.deepEqual(lab, ["CST 122 must be taken with CST 112 in Spring 2027."]);

  const lectureOnly = violationsAfterRemoval({
    removedCourseId: courseKey({ subject: "CST", number: "122" }),
    terms: [pair],
    transcriptSatisfiedIds: satisfied,
    completedCourseIds: satisfied,
  });
  assert.deepEqual(lectureOnly, []);
});

test("seeded test student plans, including Jordan's spring plan, pass validation", () => {
  const springNow = new Date("2026-11-04T15:00:00.000Z");
  const fallNow = new Date("2026-03-15T15:00:00.000Z");

  for (const student of testStudents) {
    const planned = plannedCoursesAfterReset(student, springNow);
    if (planned.length === 0) continue;
    const term = jordanSubmittedPlan(springNow).term;
    assert.deepEqual(checkPlan(planned, TermSeason[term.season], academicTermLabel(term), student.email), []);
  }

  const spring = jordanSubmittedPlan(springNow);
  assert.deepEqual(spring.term, { season: "SPRING", year: 2027 });
  assert.deepEqual(checkPlan(spring.courses, TermSeason.SPRING, "Spring 2027", "it.mid@example.test"), []);

  const fall = jordanSubmittedPlan(fallNow);
  assert.deepEqual(fall.term, { season: "FALL", year: 2026 });
  assert.deepEqual(checkPlan(fall.courses, TermSeason.FALL, "Fall 2026", "it.mid@example.test"), []);
});
