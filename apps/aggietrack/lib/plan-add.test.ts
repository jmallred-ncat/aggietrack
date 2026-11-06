import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { catalogCorequisiteEdge, catalogCorequisiteEdges } from "../prisma/seed/catalog-corequisites";
import { courseKey, concurrentPairs, courses as handbookCourses, type CourseRef } from "../prisma/seed/courses";
import { cstCatalogCourses, cstCatalogGroups, mergeCstCatalogConcurrentPairs } from "../prisma/seed/cst-catalog";
import { gecCatalogGroups, gecCourses, mergeGecConcurrentPairs } from "../prisma/seed/gec";
import type { PrerequisiteGroupSeed } from "../prisma/seed/prerequisite-text";
import { TermSeason } from "./generated/prisma/client";
import { PLAN_SAVE_FAILED, announcePlanViolations } from "./plan-save";
import { planCourseSave, type AddCourseRecord, type PlanCourseSaveDecision, type PlanCourseSaveInput } from "./plan-add";
import {
    courseOverrideNote,
    planRuleViolations,
    requiresCourseOverride,
    submitDecision,
    type RuleGroup,
} from "./plan-rules";
import { plannerFailure, writePlannedCourses } from "./planner-write";
import { coursePrerequisitesNeedAdvisorReview } from "./prerequisites";

const rawEnum = /\b(FALL|SPRING|SUMMER_I|SUMMER_II|DRAFT|SUBMITTED|APPROVED|IN_PROGRESS|COMPLETED)\b/;
const pairSentence = "CST 122 must be taken with CST 112 in Spring 2027.";

const actionsSource = readFileSync(
    new URL("../app/(app)/student/(started)/planner/actions.ts", import.meta.url),
    "utf8",
);
const addPlannedCourseSource = actionsSource.slice(
    actionsSource.indexOf("export async function addPlannedCourse"),
    actionsSource.indexOf("export async function removePlannedCourse"),
);

type CatalogMeta = { isLab: boolean; offeredIn: TermSeason[]; credits: number };

const meta = new Map<string, CatalogMeta>();
for (const course of [...cstCatalogCourses, ...gecCourses, ...handbookCourses]) {
    const key = courseKey(course);
    const prior = meta.get(key);
    meta.set(key, {
        isLab: Boolean(course.isLab || prior?.isLab),
        offeredIn: course.offeredIn && course.offeredIn.length > 0 ? [...course.offeredIn] : prior?.offeredIn ?? [],
        credits: course.credits || prior?.credits || 0,
    });
}

const groups = new Map<string, Array<RuleGroup & { note: string | null }>>();

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
        return [{ id, code: `${option.subject} ${option.number}`, isLab: info.isLab }];
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
    const pairs = mergeCstCatalogConcurrentPairs(mergeGecConcurrentPairs(concurrentPairs));
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

loadGroups([...cstCatalogGroups, ...gecCatalogGroups]);

function record(course: CourseRef): AddCourseRecord {
    const id = courseKey(course);
    const info = meta.get(id);
    assert.ok(info, `${course.subject} ${course.number} is not in the catalog`);
    const stored = groups.get(id) ?? [];
    return {
        id,
        credits: info.credits,
        isLab: info.isLab,
        rule: {
            id,
            code: `${course.subject} ${course.number}`,
            isLab: info.isLab,
            offeredIn: info.offeredIn,
            groups: stored.map(({ isConcurrent, fromCatalog, options }) => ({ isConcurrent, fromCatalog, options })),
            prerequisitesNeedAdvisorReview: coursePrerequisitesNeedAdvisorReview(
                stored.map((group) => ({
                    isConcurrent: group.isConcurrent,
                    optionCount: group.options.length,
                    note: group.note,
                })),
            ),
        },
    };
}

const lecture = record({ subject: "CST", number: "112" });
const lab = record({ subject: "CST", number: "122" });
const unix = record({ subject: "CST", number: "130" });
const math = courseKey({ subject: "MATH", number: "110" });

function allowedCompanions(course: AddCourseRecord) {
    return new Set(
        course.rule.groups
            .filter((group) => group.isConcurrent)
            .flatMap((group) => group.options.map((option) => option.id)),
    );
}

function save(overrides: Partial<PlanCourseSaveInput> & Pick<PlanCourseSaveInput, "courseId" | "companionIds">): PlanCourseSaveDecision {
    const primary = [lecture, lab, unix].find((course) => course.id === overrides.courseId);
    assert.ok(primary);
    const companionRecords = (overrides.companionIds ?? [])
        .map((id) => [lecture, lab, unix].find((course) => course.id === id))
        .filter((course): course is AddCourseRecord => Boolean(course));
    const courses = [primary, ...companionRecords.filter((course) => course.id !== primary.id)];
    return planCourseSave({
        allowedCompanionIds: allowedCompanions(primary),
        courses,
        season: TermSeason.SPRING,
        termLabel: "Spring 2027",
        satisfiedCourseIds: new Set([math]),
        completedCourseIds: new Set([math]),
        sameTermCourseIds: new Set(),
        otherTermCourseIds: new Set(),
        onTranscriptIds: new Set(),
        ...overrides,
    });
}

function rowsAfterSave(existing: readonly string[], decision: PlanCourseSaveDecision) {
    if (!decision.success) return [...existing];
    return [...existing, ...decision.creatingIds];
}

function assertHuman(message: string) {
    assert.match(message, /\.$/);
    assert.doesNotMatch(message, rawEnum);
    assert.doesNotMatch(message, /P\d{4}|Prisma|corequisite/i);
}

test("saving a lab alone is rejected", () => {
    const existing = [math];
    const decision = save({ courseId: lab.id, companionIds: [] });
    assert.equal(decision.success, false);
    if (!decision.success) {
        assert.equal(decision.error, pairSentence);
        assert.deepEqual(decision.violations, [pairSentence]);
        assertHuman(decision.error);
    }
    assert.deepEqual(rowsAfterSave(existing, decision), [math]);
});

test("saving a lecture and its lab together is accepted", () => {
    const decision = save({ courseId: lecture.id, companionIds: [lab.id] });
    assert.equal(decision.success, true);
    if (decision.success) {
        assert.deepEqual(decision.creatingIds, [lecture.id, lab.id]);
        assert.equal(decision.credits, 4);
    }
    assert.deepEqual(rowsAfterSave([], decision), [lecture.id, lab.id]);
});

test("a lab is accepted when its lecture is already completed", () => {
    const decision = save({
        courseId: lab.id,
        companionIds: [],
        satisfiedCourseIds: new Set([math, lecture.id]),
        completedCourseIds: new Set([math, lecture.id]),
    });
    assert.equal(decision.success, true);
    if (decision.success) {
        assert.deepEqual(decision.creatingIds, [lab.id]);
        assert.equal(decision.credits, 1);
    }
    assert.deepEqual(rowsAfterSave([lecture.id], decision), [lecture.id, lab.id]);
});

test("a lab is accepted when its lecture is already on the same term", () => {
    const decision = save({
        courseId: lab.id,
        companionIds: [],
        sameTermCourseIds: new Set([lecture.id]),
    });
    assert.equal(decision.success, true);
    if (decision.success) {
        assert.deepEqual(decision.creatingIds, [lab.id]);
    }
});

test("a lab is rejected when its lecture is on a different term", () => {
    const existing = [math, lecture.id];
    const alone = save({
        courseId: lab.id,
        companionIds: [],
        satisfiedCourseIds: new Set([math, lecture.id]),
        otherTermCourseIds: new Set([lecture.id]),
    });
    assert.equal(alone.success, false);
    if (!alone.success) {
        assert.equal(alone.error, pairSentence);
        assertHuman(alone.error);
    }
    assert.deepEqual(rowsAfterSave(existing, alone), existing);

    const requestedTogether = save({
        courseId: lab.id,
        companionIds: [lecture.id],
        satisfiedCourseIds: new Set([math, lecture.id]),
        otherTermCourseIds: new Set([lecture.id]),
    });
    assert.equal(requestedTogether.success, false);
    if (!requestedTogether.success) {
        assert.equal(requestedTogether.error, pairSentence);
    }
    assert.deepEqual(rowsAfterSave(existing, requestedTogether), existing);
});

test("a lecture can be saved without its lab", () => {
    const decision = save({ courseId: lecture.id, companionIds: [] });
    assert.equal(decision.success, true);
    if (decision.success) {
        assert.deepEqual(decision.creatingIds, [lecture.id]);
        assert.equal(decision.credits, lecture.credits);
    }
});

test("the missing pair is a sonner sentence and does not show a raw term enum", () => {
    const notices = announcePlanViolations([
        pairSentence,
        "CST 112 needs MATH 110 or CST 120 before Spring 2027.",
    ]);
    assert.deepEqual(notices.sonner, [pairSentence]);
    assert.deepEqual(notices.alert, ["CST 112 needs MATH 110 or CST 120 before Spring 2027."]);
    assertHuman(notices.sonner[0] ?? "");
});

test("a repeated companion id is saved once and leaves no duplicate row", () => {
    const decision = save({
        courseId: lecture.id,
        companionIds: [lab.id, lab.id, lecture.id, lab.id],
    });
    assert.equal(decision.success, true);
    if (decision.success) {
        assert.deepEqual(decision.creatingIds, [lecture.id, lab.id]);
        assert.equal(new Set(decision.creatingIds).size, decision.creatingIds.length);
        assert.equal(decision.credits, 4);
    }
    assert.deepEqual(rowsAfterSave([math], decision), [math, lecture.id, lab.id]);
});

test("an unrelated companion sent with CST 112 or CST 122 is rejected", () => {
    const existing = [math];
    const withLecture = save({ courseId: lecture.id, companionIds: [unix.id] });
    const withLab = save({ courseId: lab.id, companionIds: [unix.id, unix.id] });
    for (const decision of [withLecture, withLab]) {
        assert.equal(decision.success, false);
        if (!decision.success) {
            assert.equal(decision.error, "That course could not be added with its corequisite.");
            assert.equal(decision.violations, undefined);
            assert.doesNotMatch(decision.error, rawEnum);
        }
        assert.deepEqual(rowsAfterSave(existing, decision), existing);
    }
});

test("more than 8 companion ids are rejected", () => {
    const existing = [math];
    const eight = save({ courseId: lecture.id, companionIds: Array(8).fill(lab.id) });
    assert.equal(eight.success, true);
    if (eight.success) {
        assert.deepEqual(eight.creatingIds, [lecture.id, lab.id]);
        assert.equal(eight.credits, 4);
    }

    const nine = save({ courseId: lecture.id, companionIds: Array(9).fill(lab.id) });
    assert.equal(nine.success, false);
    if (!nine.success) {
        assert.equal(nine.error, "That course could not be added.");
        assert.doesNotMatch(nine.error, rawEnum);
    }
    assert.deepEqual(rowsAfterSave(existing, nine), existing);
});

test("CST 112 and CST 122 together save as 4 credits", () => {
    assert.equal(lecture.credits, 3);
    assert.equal(lab.credits, 1);
    const decision = save({ courseId: lecture.id, companionIds: [lab.id] });
    assert.equal(decision.success, true);
    if (decision.success) {
        assert.deepEqual(decision.creatingIds, [lecture.id, lab.id]);
        assert.equal(decision.credits, lecture.credits + lab.credits);
        assert.equal(decision.credits, 4);
    }
    assert.deepEqual(rowsAfterSave([], decision), [lecture.id, lab.id]);
});

test("a failed lab insert leaves no half pair on the plan", async () => {
    const decision = save({ courseId: lecture.id, companionIds: [lab.id] });
    assert.equal(decision.success, true);
    if (!decision.success) return;

    const plan = [math];
    const snapshot = plan.slice();
    const attempted: string[] = [];
    try {
        await writePlannedCourses(
            decision.creatingIds,
            (id) => id === lab.id,
            { mode: "fail" },
            async (id) => {
                attempted.push(id);
                plan.push(id);
                return id;
            },
        );
        assert.fail("the lab insert should fail");
    } catch (error) {
        plan.splice(0, plan.length, ...snapshot);
        const failure = plannerFailure(error);
        assert.equal(failure?.error, PLAN_SAVE_FAILED);
        assert.equal(failure?.error, "Couldn't save, try again");
        assert.doesNotMatch(failure?.error ?? "", rawEnum);
    }

    assert.deepEqual(attempted, [lecture.id]);
    assert.deepEqual(plan, [math]);
    assert.ok(addPlannedCourseSource.indexOf("planCourseSave(") >= 0);
    assert.ok(addPlannedCourseSource.indexOf("planCourseSave(") < addPlannedCourseSource.indexOf("prisma.$transaction"));
    assert.match(addPlannedCourseSource, /writePlannedCourses\(\s*decision\.creatingIds/);
    assert.match(actionsSource, /z\.array\(z\.string\(\)\.min\(1\)\)\.max\(8\)/);
    assert.match(addPlannedCourseSource, /if \(!decision\.success\)/);
});

const survey = record({ subject: "PHYS", number: "110" });
const surveyLab = record({ subject: "PHYS", number: "111" });
const generalPhysics = record({ subject: "PHYS", number: "241" });
const generalPhysicsLab = record({ subject: "PHYS", number: "251" });
const calculus = record({ subject: "MATH", number: "132" });

function saveCourses(
    primary: AddCourseRecord,
    companions: readonly AddCourseRecord[],
    overrides: Partial<PlanCourseSaveInput> = {},
) {
    return planCourseSave({
        courseId: primary.id,
        companionIds: companions.map((course) => course.id),
        allowedCompanionIds: allowedCompanions(primary),
        courses: [primary, ...companions],
        season: TermSeason.SPRING,
        termLabel: "Spring 2027",
        satisfiedCourseIds: new Set([math]),
        completedCourseIds: new Set([math]),
        sameTermCourseIds: new Set(),
        otherTermCourseIds: new Set(),
        onTranscriptIds: new Set(),
        ...overrides,
    });
}

test("a two-way pair rejects either course saved alone", () => {
    const lectureAlone = saveCourses(survey, []);
    const labAlone = saveCourses(surveyLab, []);
    assert.equal(lectureAlone.success, false);
    assert.equal(labAlone.success, false);
    if (!lectureAlone.success && !labAlone.success) {
        assert.ok(lectureAlone.violations?.includes("PHYS 110 must be taken with PHYS 111 in Spring 2027."));
        assert.ok(labAlone.violations?.includes("PHYS 111 must be taken with PHYS 110 in Spring 2027."));
        assertHuman(lectureAlone.error);
        assertHuman(labAlone.error);
    }
    assert.deepEqual(rowsAfterSave([math], lectureAlone), [math]);
    assert.deepEqual(rowsAfterSave([math], labAlone), [math]);

    const together = saveCourses(survey, [surveyLab]);
    assert.equal(together.success, true);
    if (together.success) {
        assert.deepEqual(together.creatingIds, [survey.id, surveyLab.id]);
    }
});

test("PHYS 241 without MATH 132 is rejected", () => {
    const withLab = saveCourses(generalPhysics, [generalPhysicsLab]);
    assert.equal(withLab.success, false);
    if (!withLab.success) {
        assert.ok(withLab.violations?.includes("PHYS 241 must be taken with MATH 132 in Spring 2027."));
        assertHuman(withLab.error);
    }
    assert.deepEqual(rowsAfterSave([], withLab), []);

    const calculusAlone = saveCourses(calculus, [], {
        satisfiedCourseIds: new Set([courseKey({ subject: "MATH", number: "131" })]),
        completedCourseIds: new Set([courseKey({ subject: "MATH", number: "131" })]),
    });
    assert.equal(calculusAlone.success, true);
    if (!calculusAlone.success) return;
    const violations = planRuleViolations({
        courses: [calculus.rule],
        season: TermSeason.SPRING,
        termLabel: "Spring 2027",
        satisfiedCourseIds: new Set([courseKey({ subject: "MATH", number: "131" })]),
        completedCourseIds: new Set([courseKey({ subject: "MATH", number: "131" })]),
    });
    assert.equal(violations.some((message) => message.includes("PHYS 241")), false);
});

test("a completed A&T companion allows the course with no override note", () => {
    const decision = save({
        courseId: lab.id,
        companionIds: [],
        satisfiedCourseIds: new Set([math, lecture.id]),
        completedCourseIds: new Set([math, lecture.id]),
    });
    assert.equal(decision.success, true);
    assert.equal(requiresCourseOverride(lab.rule, new Set(), new Map([[lecture.id, "NCAT"]])), false);
    const violations = planRuleViolations({
        courses: [lab.rule],
        season: TermSeason.SPRING,
        termLabel: "Spring 2027",
        satisfiedCourseIds: new Set([math, lecture.id]),
        completedCourseIds: new Set([math, lecture.id]),
    });
    assert.equal(submitDecision({ courseCount: 1, violations }).success, true);
});

test("a transfer companion allows the course and the planner says Requires course override", () => {
    const decision = save({
        courseId: lab.id,
        companionIds: [],
        satisfiedCourseIds: new Set([math, lecture.id]),
        completedCourseIds: new Set([math, lecture.id]),
    });
    assert.equal(decision.success, true);
    if (decision.success) assert.deepEqual(decision.creatingIds, [lab.id]);
    assert.equal(requiresCourseOverride(lab.rule, new Set(), new Map([[lecture.id, "TRANSFER"]])), true);
    assert.equal(courseOverrideNote, "Requires course override");
    assert.doesNotMatch(courseOverrideNote, rawEnum);

    const otherDirection = saveCourses(survey, [], {
        satisfiedCourseIds: new Set([math, surveyLab.id]),
        completedCourseIds: new Set([math, surveyLab.id]),
    });
    assert.equal(otherDirection.success, true);
    assert.equal(
        requiresCourseOverride(survey.rule, new Set(), new Map([[surveyLab.id, "TRANSFER"], [math, "NCAT"]])),
        true,
    );
    const violations = planRuleViolations({
        courses: [survey.rule],
        season: TermSeason.SPRING,
        termLabel: "Spring 2027",
        satisfiedCourseIds: new Set([math, surveyLab.id]),
        completedCourseIds: new Set([math, surveyLab.id]),
    });
    assert.equal(submitDecision({ courseCount: 1, violations }).success, true);
    assert.equal(violations.some((message) => message.includes("must be taken with")), false);
});
