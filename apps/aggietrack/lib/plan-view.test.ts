import assert from "node:assert/strict";
import { test } from "node:test";
import {
    applyAddedCourses,
    applyMovedCourse,
    applyRemovedCourse,
    plannerMutationPaths,
    termCreditLabel,
    termCreditTotal,
    type PlanCourseRef,
    type TermCourseList,
} from "./plan-view";

const cst130: PlanCourseRef = { plannedCourseId: "row-cst-130", id: "cst-130", credits: 3 };
const math110: PlanCourseRef = { plannedCourseId: "row-math-110", id: "math-110", credits: 4 };
const engl100: PlanCourseRef = { plannedCourseId: "row-engl-100", id: "engl-100", credits: 3 };
const lab: PlanCourseRef = { plannedCourseId: "row-lab", id: "cst-122", credits: 1 };
const phys: PlanCourseRef = { plannedCourseId: "row-phys", id: "phys-225", credits: 1 };

const empty: TermCourseList = { id: null, courses: [] };

test("a saved course replaces the empty term without waiting for a reload", () => {
    assert.equal(empty.courses.length, 0);

    const saved = applyAddedCourses(empty, {
        planId: "spring-2027",
        courses: [cst130],
    });

    assert.equal(saved.id, "spring-2027");
    assert.deepEqual(saved.courses.map((course) => course.id), ["cst-130"]);
    assert.equal(termCreditTotal(saved.courses), 3);
    assert.equal(termCreditLabel(termCreditTotal(saved.courses)), "3 credits");
});

test("adding another course keeps the ones already shown and updates the total", () => {
    const first = applyAddedCourses(empty, { planId: "spring-2027", courses: [cst130] });
    const second = applyAddedCourses(first, { planId: "other", courses: [math110] });

    assert.equal(second.id, "spring-2027");
    assert.deepEqual(second.courses.map((course) => course.id), ["cst-130", "math-110"]);
    assert.equal(termCreditLabel(termCreditTotal(second.courses)), "7 credits");
});

test("adding a course that is already on the term does not count it twice", () => {
    const saved = applyAddedCourses(
        { id: "spring-2027", courses: [cst130] },
        { planId: "spring-2027", courses: [{ ...cst130, plannedCourseId: "duplicate" }] },
    );

    assert.equal(saved.courses.length, 1);
    assert.equal(saved.courses[0]?.plannedCourseId, "row-cst-130");
    assert.equal(termCreditTotal(saved.courses), 3);
});

test("removing a course drops it from the open term and the credit total", () => {
    const saved = applyAddedCourses(empty, {
        planId: "spring-2027",
        courses: [cst130, math110],
    });
    const removed = applyRemovedCourse(saved, cst130.plannedCourseId);

    assert.equal(removed.id, "spring-2027");
    assert.deepEqual(removed.courses.map((course) => course.id), ["math-110"]);
    assert.equal(termCreditLabel(termCreditTotal(removed.courses)), "4 credits");
});

test("removing the last course leaves the term empty at 0 credits", () => {
    const saved = applyAddedCourses(empty, { planId: "spring-2027", courses: [cst130] });
    const removed = applyRemovedCourse(saved, cst130.plannedCourseId);

    assert.deepEqual(removed.courses, []);
    assert.equal(termCreditLabel(termCreditTotal(removed.courses)), "0 credits");
});

test("removing an unknown row leaves the term unchanged", () => {
    const saved = applyAddedCourses(empty, { planId: "spring-2027", courses: [cst130] });
    const removed = applyRemovedCourse(saved, "missing");

    assert.deepEqual(removed, saved);
});

test("moving a course updates both terms' lists and credit totals", () => {
    const plans = {
        spring: applyAddedCourses(empty, {
            planId: "spring",
            courses: [cst130, math110, lab],
        }),
        fall: { id: "fall", courses: [engl100] },
    };

    const moved = applyMovedCourse(plans, {
        fromTermId: "spring",
        toTermId: "fall",
        toPlanId: "fall",
        plannedCourseId: cst130.plannedCourseId,
    });

    assert.deepEqual(moved.spring?.courses.map((course) => course.id), ["math-110", "cst-122"]);
    assert.deepEqual(moved.fall?.courses.map((course) => course.id), ["engl-100", "cst-130"]);
    assert.equal(termCreditLabel(termCreditTotal(moved.spring?.courses ?? [])), "5 credits");
    assert.equal(termCreditLabel(termCreditTotal(moved.fall?.courses ?? [])), "6 credits");
    assert.equal(
        termCreditTotal(moved.spring?.courses ?? []) + termCreditTotal(moved.fall?.courses ?? []),
        termCreditTotal(plans.spring.courses) + termCreditTotal(plans.fall.courses),
    );
});

test("moving onto a term that does not exist yet creates that term's total", () => {
    const plans = {
        spring: { id: "spring", courses: [cst130, phys] },
    };
    const moved = applyMovedCourse(plans, {
        fromTermId: "spring",
        toTermId: "summer",
        toPlanId: "summer",
        plannedCourseId: phys.plannedCourseId,
    });

    assert.equal(termCreditLabel(termCreditTotal(moved.spring?.courses ?? [])), "3 credits");
    assert.equal(moved.summer?.id, "summer");
    assert.equal(termCreditLabel(termCreditTotal(moved.summer?.courses ?? [])), "1 credit");
});

test("moving a course onto a term that already has it does not double the total", () => {
    const plans = {
        spring: { id: "spring", courses: [cst130] },
        fall: { id: "fall", courses: [{ ...cst130, plannedCourseId: "already" }] },
    };
    const moved = applyMovedCourse(plans, {
        fromTermId: "spring",
        toTermId: "fall",
        toPlanId: "fall",
        plannedCourseId: cst130.plannedCourseId,
    });

    assert.deepEqual(moved.spring?.courses, []);
    assert.equal(moved.fall?.courses.length, 1);
    assert.equal(termCreditTotal(moved.fall?.courses ?? []), 3);
});

test("a term header total uses the courses on that term", () => {
    const courses = [
        { credits: 3 },
        { credits: 3 },
        { credits: 4 },
        { credits: 2 },
    ];
    assert.equal(termCreditTotal(courses), 12);
    assert.equal(termCreditLabel(12), "12 credits");
    assert.equal(termCreditLabel(1), "1 credit");
    assert.equal(termCreditLabel(0), "0 credits");
});

test("planner saves refresh the dashboard and the progress page", () => {
    assert.ok(plannerMutationPaths.includes("/student"));
    assert.ok(plannerMutationPaths.includes("/student/progress"));
    assert.ok(plannerMutationPaths.includes("/student/planner"));
});
