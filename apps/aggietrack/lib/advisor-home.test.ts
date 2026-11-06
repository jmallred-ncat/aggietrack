import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { advisorPlanIdFromPath } from "./plan-crumb";

function source(path: string) {
    return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("the advisor dashboard uses the review queue, not a student clone", () => {
    const page = source("../app/(app)/advisor/page.tsx");
    assert.match(page, /Welcome back,/);
    assert.match(page, />Dashboard</);
    assert.match(page, /xl:grid-cols-4/);
    assert.doesNotMatch(page, /md:grid-cols-4/);
    assert.match(page, /Needs your review/);
    assert.match(page, /None waiting/);
    assert.match(page, /Waiting on students/);
    assert.match(page, /None returned/);
    assert.match(page, /This term/);
    assert.match(page, /None approved/);
    assert.match(page, /Assigned to you/);
    assert.match(page, /Oldest submissions first\./);
    assert.match(page, /No plans waiting for review/);
    assert.match(page, /See all waiting plans/);
    assert.match(page, /\/advisor\/students\?status=waiting/);
    assert.match(page, /No students assigned yet/);
    assert.match(page, /Students assigned to you will appear here\./);
    assert.match(page, /No notes yet/);
    assert.match(page, /Recent notes/);
    assert.match(page, /These students have a returned plan to update\./);
    assert.match(page, /Dashboard could not be loaded/);
    assert.doesNotMatch(page, /Degree Completion|Cumulative GPA/);
});

test("roster filters wrap and the students table waits for room", () => {
    const controls = source("../app/(app)/advisor/students/RosterControls.tsx");
    const page = source("../app/(app)/advisor/students/page.tsx");
    assert.match(controls, /flex flex-wrap gap-4/);
    assert.match(controls, /min-w-\[220px\]/);
    assert.match(controls, /Name or student ID/);
    assert.doesNotMatch(controls, /md:grid-cols-4/);
    assert.match(page, /hidden xl:block/);
    assert.match(page, /xl:hidden/);
    assert.doesNotMatch(page, /hidden md:block|md:hidden/);
    assert.match(page, /table-fixed/);
    assert.match(page, /align-top/);
    assert.match(page, /students match these filters/);
    assert.doesNotMatch(page, /TableCaption|Students assigned to you for/);
});

test("review plan uses the term crumb, a course badge, and a pin readout", () => {
    const page = source("../app/(app)/advisor/plans/[plannedTermId]/page.tsx");
    const crumbs = source("../app/(app)/dashboard-breadcrumbs.tsx");
    const editor = source("../app/(app)/student/(started)/planner/PlanEditor.tsx");
    const navigation = source("../app/(app)/student/(started)/planner/PlannerNavigation.tsx");
    assert.match(page, /SetPlanCrumb/);
    assert.match(page, /text-base font-medium text-foreground/);
    assert.match(page, /font-mono whitespace-nowrap/);
    assert.match(page, /w-\[8rem\]/);
    assert.match(page, /minmax\(280px,1fr\)/);
    assert.match(crumbs, /usePlanCrumb/);
    assert.match(editor, /block text-pretty">\{course\.title\}/);
    assert.match(navigation, /min-w-0/);
    assert.match(navigation, /shrink-0/);
});

test("a plan breadcrumb id comes from the path and is not treated as a term", () => {
    assert.equal(advisorPlanIdFromPath("/advisor/plans/cm123"), "cm123");
    assert.equal(advisorPlanIdFromPath("/advisor/plans/cm123?from=%2Fadvisor%2Fstudents"), "cm123");
    assert.equal(advisorPlanIdFromPath("/advisor/plans"), null);
    assert.equal(advisorPlanIdFromPath("/advisor/students"), null);
    assert.equal(advisorPlanIdFromPath(null), null);
});
