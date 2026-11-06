import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { academicTermLabel } from "./academic-term";
import { plannedAttempts } from "./frozen-transcript";
import { TermSeason, TranscriptStatus } from "./generated/prisma/client";
import { catalogCorequisiteEdge, catalogCorequisiteEdges } from "../prisma/seed/catalog-corequisites";
import { courseKey, concurrentPairs, courses as handbookCourses, type CourseRef } from "../prisma/seed/courses";
import { cstCatalogCourses, cstCatalogGroups, mergeCstCatalogConcurrentPairs } from "../prisma/seed/cst-catalog";
import { gecCatalogGroups, gecCourses, mergeGecConcurrentPairs } from "../prisma/seed/gec";
import { mergeMgmtConcurrentPairs, mgmtCatalogGroups, mgmtCourses } from "../prisma/seed/mgmt";
import type { PrerequisiteGroupSeed } from "../prisma/seed/prerequisite-text";
import {
  approveDecision,
  claimDraftPlan,
  courseOverrideNote,
  planRuleViolations,
  requiresCourseOverride,
  submitDecision,
  violationsAfterRemoval,
  type PlannedTermSnapshot,
  type RuleCourse,
  type RuleGroup,
} from "./plan-rules";
import { advisorReviewViolation, coursePrerequisitesNeedAdvisorReview } from "./prerequisites";
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

const groups = new Map<string, Array<RuleGroup & { note: string | null }>>();

function displayCode(course: CourseRef) {
  return `${course.subject} ${course.number}`;
}

function addGroup(
  course: CourseRef,
  isConcurrent: boolean,
  options: CourseRef[],
  note: string | null,
  fromCatalog: boolean,
) {
  const optionRows = options.flatMap((option) => {
    const id = courseKey(option);
    const info = meta.get(id);
    if (!info) return [];
    return [{ id, code: displayCode(option), isLab: info.isLab }];
  });
  if (optionRows.length === 0 && options.length > 0 && !note) return;
  const key = courseKey(course);
  const list = groups.get(key) ?? [];
  const signature = `${isConcurrent}|${fromCatalog}|${optionRows.map((option) => option.id).sort().join(",")}`;
  const existing = list.some((group) => {
    const current = `${group.isConcurrent}|${group.fromCatalog}|${group.options.map((option) => option.id).sort().join(",")}`;
    return current === signature;
  });
  if (existing) return;
  list.push({ isConcurrent, fromCatalog, options: optionRows, note });
  groups.set(key, list);
}

function loadGroups(seeds: PrerequisiteGroupSeed[]) {
  const pairs = mergeMgmtConcurrentPairs(
    mergeCstCatalogConcurrentPairs(mergeGecConcurrentPairs(concurrentPairs)),
  );
  const edges = catalogCorequisiteEdges(seeds);
  for (const [lecture, lab] of pairs) {
    addGroup(lecture, true, [lab], null, edges.has(catalogCorequisiteEdge(lecture, lab)));
    addGroup(lab, true, [lecture], null, edges.has(catalogCorequisiteEdge(lab, lecture)));
  }
  for (const group of seeds) {
    if (group.isConcurrent && group.options.length === 1) continue;
    addGroup(group.course, group.isConcurrent, group.options, group.note, group.isConcurrent);
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
    groups: (groups.get(key) ?? []).map(({ isConcurrent, fromCatalog, options }) => ({ isConcurrent, fromCatalog, options })),
    prerequisitesNeedAdvisorReview: coursePrerequisitesNeedAdvisorReview(
      (groups.get(key) ?? []).map((group) => ({
        isConcurrent: group.isConcurrent,
        optionCount: group.options.length,
        note: group.note,
      })),
    ),
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
  let status: "DRAFT" | "SUBMITTED" | "RETURNED" = "DRAFT";
  const courses = ["CST 130"];

  const updateMany = async (args: {
    where: { id: string; studentId: string; status: { in: Array<"DRAFT" | "RETURNED"> }; revision?: number };
    data: { status?: "SUBMITTED"; updatedAt?: Date; revision?: { increment: number } };
  }) => {
    assert.deepEqual(args.where.status, { in: ["DRAFT", "RETURNED"] });
    assert.equal(args.data.revision?.increment, 1);
    assert.equal(args.where.id, "plan-1");
    assert.equal(args.where.studentId, "student-1");
    if (status !== "DRAFT" && status !== "RETURNED") return { count: 0 };
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

test("a returned plan can still be edited until it is submitted again", async () => {
  let status: "RETURNED" | "SUBMITTED" = "RETURNED";
  const updateMany = async (args: {
    where: { status: { in: Array<"DRAFT" | "RETURNED"> }; revision?: number };
    data: { status?: "SUBMITTED"; revision?: { increment: number } };
  }) => {
    if (args.where.revision != null && args.where.revision !== 2) return { count: 0 };
    if (status !== "RETURNED") return { count: 0 };
    if (args.data.status === "SUBMITTED") status = "SUBMITTED";
    return { count: 1 };
  };
  const edited = await claimDraftPlan(updateMany, { id: "plan-1", studentId: "student-1", revision: 2 }, { updatedAt: new Date() });
  assert.equal(edited, true);
  const resubmitted = await claimDraftPlan(
    updateMany,
    { id: "plan-1", studentId: "student-1", revision: 2 },
    { status: "SUBMITTED", submittedAt: new Date() },
  );
  assert.equal(resubmitted, true);
  const after = await claimDraftPlan(updateMany, { id: "plan-1", studentId: "student-1", revision: 3 }, { updatedAt: new Date() });
  assert.equal(after, false);
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

test("CST 300 cannot be added while its prerequisite text is unresolved", () => {
  const course = ruleCourse({ subject: "CST", number: "300" });
  assert.equal(course.prerequisitesNeedAdvisorReview, true);
  assert.ok(course.groups.every((group) => group.options.length === 0));

  const violations = planRuleViolations({
    courses: [course],
    season: TermSeason.SPRING,
    termLabel: "Spring 2027",
    satisfiedCourseIds: new Set(),
    completedCourseIds: new Set(),
  });
  assert.ok(violations.includes(advisorReviewViolation("CST 300")));
  assert.ok(violations.every((message) => !/critical path|prerequisites,/i.test(message)));
  assertHuman(violations);

  const standing = ruleCourse({ subject: "CST", number: "317" });
  assert.equal(standing.prerequisitesNeedAdvisorReview, false);
  assert.deepEqual(planRuleViolations({
    courses: [standing],
    season: TermSeason.SPRING,
    termLabel: "Spring 2027",
    satisfiedCourseIds: new Set(),
    completedCourseIds: new Set(),
  }), []);
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

function springViolations(courses: CourseRef[], completed: CourseRef[] = []) {
  const completedIds = new Set(completed.map((course) => courseKey(course)));
  return planRuleViolations({
    courses: courses.map((course) => ruleCourse(course)),
    season: TermSeason.SPRING,
    termLabel: "Spring 2027",
    satisfiedCourseIds: completedIds,
    completedCourseIds: completedIds,
  });
}

test("catalog corequisites keep only the directions the catalog lists", () => {
  const crossSubject = [...cstCatalogGroups, ...gecCatalogGroups, ...mgmtCatalogGroups].flatMap((group) => {
    if (!group.isConcurrent) return [];
    return group.options
      .filter((option) => option.subject !== group.course.subject)
      .map((option) => `${displayCode(group.course)} -> ${displayCode(option)}`);
  });
  assert.deepEqual(crossSubject, ["PHYS 241 -> MATH 132"]);

  const cstLecture = ruleCourse({ subject: "CST", number: "112" });
  const cstLab = ruleCourse({ subject: "CST", number: "122" });
  assert.equal(cstLecture.groups.some((group) => group.fromCatalog && group.options.some((option) => option.code === "CST 122")), false);
  assert.equal(cstLab.groups.some((group) => group.fromCatalog && group.options.some((option) => option.code === "CST 112")), true);

  const survey = ruleCourse({ subject: "PHYS", number: "110" });
  const surveyLab = ruleCourse({ subject: "PHYS", number: "111" });
  assert.equal(survey.groups.some((group) => group.fromCatalog && group.options.some((option) => option.code === "PHYS 111")), true);
  assert.equal(surveyLab.groups.some((group) => group.fromCatalog && group.options.some((option) => option.code === "PHYS 110")), true);

  const physicalScience = ruleCourse({ subject: "CHEM", number: "100" });
  const physicalScienceLab = ruleCourse({ subject: "CHEM", number: "110" });
  assert.equal(physicalScience.groups.some((group) => group.fromCatalog && group.options.some((option) => option.code === "CHEM 110")), false);
  assert.equal(physicalScienceLab.groups.some((group) => group.fromCatalog && group.options.some((option) => option.code === "CHEM 100")), true);

  const generalPhysics = ruleCourse({ subject: "PHYS", number: "241" });
  const calculus = ruleCourse({ subject: "MATH", number: "132" });
  assert.equal(generalPhysics.groups.some((group) => group.fromCatalog && group.options.some((option) => option.code === "MATH 132")), true);
  assert.equal(calculus.groups.some((group) => group.fromCatalog && group.options.some((option) => option.code === "PHYS 241")), false);
});

test("a two-way catalog pair is refused in either direction on submit", () => {
  const math = { subject: "MATH", number: "110" };
  const lecture = { subject: "PHYS", number: "110" };
  const lab = { subject: "PHYS", number: "111" };
  const lectureAlone = springViolations([lecture], [math]);
  const labAlone = springViolations([lab], [math]);
  assert.ok(lectureAlone.includes("PHYS 110 must be taken with PHYS 111 in Spring 2027."));
  assert.ok(labAlone.includes("PHYS 111 must be taken with PHYS 110 in Spring 2027."));
  assert.equal(submitDecision({ courseCount: 1, violations: lectureAlone }).success, false);
  assert.equal(submitDecision({ courseCount: 1, violations: labAlone }).success, false);
  assertHuman(lectureAlone);
  assertHuman(labAlone);

  const together = springViolations([lecture, lab], [math]);
  assert.equal(submitDecision({ courseCount: 2, violations: together }).success, true);

  const completedLab = springViolations([lecture], [math, lab]);
  assert.equal(submitDecision({ courseCount: 1, violations: completedLab }).success, true);
  const completedLecture = springViolations([lab], [lecture]);
  assert.equal(submitDecision({ courseCount: 1, violations: completedLecture }).success, true);
});

test("a one-way lecture can be submitted without its lab", () => {
  const math = { subject: "MATH", number: "110" };
  const lecture = springViolations([{ subject: "CST", number: "112" }], [math]);
  assert.deepEqual(lecture, []);
  const lab = springViolations([{ subject: "CST", number: "122" }], [math]);
  assert.deepEqual(lab, ["CST 122 must be taken with CST 112 in Spring 2027."]);
  assert.equal(submitDecision({ courseCount: 1, violations: lab }).success, false);
});

test("PHYS 241 requires MATH 132 on submit", () => {
  const physics = { subject: "PHYS", number: "241" };
  const lab = { subject: "PHYS", number: "251" };
  const calculus = { subject: "MATH", number: "132" };
  const missingCalculus = springViolations([physics, lab]);
  assert.ok(missingCalculus.includes("PHYS 241 must be taken with MATH 132 in Spring 2027."));
  assert.equal(submitDecision({ courseCount: 2, violations: missingCalculus }).success, false);
  assertHuman(missingCalculus);

  const ready = springViolations([physics, lab, calculus], [{ subject: "MATH", number: "131" }]);
  assert.equal(submitDecision({ courseCount: 3, violations: ready }).success, true);

  const calculusAlone = springViolations([calculus], [{ subject: "MATH", number: "131" }]);
  assert.equal(calculusAlone.some((message) => message.includes("PHYS 241")), false);
});

test("a transfer companion allows the course and marks an override", () => {
  const lab = ruleCourse({ subject: "CST", number: "122" });
  const lectureId = courseKey({ subject: "CST", number: "112" });
  const mathId = courseKey({ subject: "MATH", number: "110" });
  const resident = new Map([[lectureId, "NCAT"], [mathId, "NCAT"]]);
  const transfer = new Map([[lectureId, "TRANSFER"], [mathId, "NCAT"]]);
  assert.equal(requiresCourseOverride(lab, new Set(), resident), false);
  assert.equal(requiresCourseOverride(lab, new Set(), transfer), true);
  assert.equal(requiresCourseOverride(lab, new Set([lectureId]), transfer), false);

  const survey = ruleCourse({ subject: "PHYS", number: "110" });
  const surveyLabId = courseKey({ subject: "PHYS", number: "111" });
  assert.equal(requiresCourseOverride(survey, new Set(), new Map([[surveyLabId, "TRANSFER"], [mathId, "NCAT"]])), true);
  const surveyLab = ruleCourse({ subject: "PHYS", number: "111" });
  assert.equal(requiresCourseOverride(surveyLab, new Set(), new Map([[courseKey({ subject: "PHYS", number: "110" }), "NCAT"]])), false);

  const allowed = springViolations(
    [{ subject: "CST", number: "122" }],
    [{ subject: "MATH", number: "110" }, { subject: "CST", number: "112" }],
  );
  assert.equal(submitDecision({ courseCount: 1, violations: allowed }).success, true);
  assert.equal(courseOverrideNote, "Requires course override");
  assert.doesNotMatch(courseOverrideNote, rawEnum);
  const plannerSource = readFileSync(
    new URL("../app/(app)/student/(started)/planner/PlanEditor.tsx", import.meta.url),
    "utf8",
  );
  assert.match(plannerSource, /courseOverrideNote/);
});
