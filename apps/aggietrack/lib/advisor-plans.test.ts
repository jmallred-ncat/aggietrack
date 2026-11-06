import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { advisorPlanUpdatedLabel, advisorPlansSummary, sortAdvisorPlans, type AdvisorPlanOrder } from "./advisor-plans";

function plan(partial: Partial<AdvisorPlanOrder> & Pick<AdvisorPlanOrder, "id" | "status">): AdvisorPlanOrder {
    return { submittedAt: null, reviewedAt: null, updatedAt: null, ...partial };
}

test("waiting plans come first, oldest submission first, then returned plans", () => {
    const rows = [
        plan({ id: "draft", status: "DRAFT", updatedAt: 50 }),
        plan({ id: "late", status: "SUBMITTED", submittedAt: 20 }),
        plan({ id: "approved", status: "APPROVED", reviewedAt: 40, updatedAt: 40 }),
        plan({ id: "early", status: "SUBMITTED", submittedAt: 10 }),
        plan({ id: "returned-new", status: "RETURNED", reviewedAt: 30, updatedAt: 30 }),
        plan({ id: "undated", status: "SUBMITTED" }),
        plan({ id: "returned-old", status: "RETURNED", reviewedAt: 5, updatedAt: 5 }),
    ];
    assert.deepEqual(sortAdvisorPlans(rows).map((item) => item.id), [
        "early",
        "late",
        "undated",
        "returned-new",
        "returned-old",
        "draft",
        "approved",
    ]);
});

test("plan list dates are calendar days without a clock or a status code", () => {
    const submitted = advisorPlanUpdatedLabel(plan({
        id: "s",
        status: "SUBMITTED",
        submittedAt: "2026-11-06T03:45:00.000Z",
    }));
    assert.equal(submitted, "Submitted Nov 5, 2026");
    assert.doesNotMatch(submitted, /EST|AM|PM|T03:45|SUBMITTED/);
    assert.equal(advisorPlanUpdatedLabel(plan({
        id: "r",
        status: "RETURNED",
        reviewedAt: "2026-11-06T03:45:00.000Z",
    })), "Returned Nov 5, 2026");
    assert.equal(advisorPlanUpdatedLabel(plan({
        id: "a",
        status: "APPROVED",
        reviewedAt: "2026-11-06T15:00:00.000Z",
    })), "Reviewed Nov 6, 2026");
    assert.equal(advisorPlanUpdatedLabel(plan({ id: "d", status: "DRAFT" })), "Not submitted");
});

test("the plans summary counts plans and how many are waiting", () => {
    assert.equal(advisorPlansSummary(1, 1), "1 plan · 1 waiting for review");
    assert.equal(advisorPlansSummary(4, 2), "4 plans · 2 waiting for review");
    assert.equal(advisorPlansSummary(0, 0), "0 plans · 0 waiting for review");
});

test("the plans page uses the students stack, a table from xl, and no dashboard tiles", () => {
    const page = readFileSync(new URL("../app/(app)/advisor/plans/page.tsx", import.meta.url), "utf8");
    const loading = readFileSync(new URL("../app/(app)/advisor/plans/loading.tsx", import.meta.url), "utf8");
    const review = readFileSync(new URL("../app/(app)/advisor/plans/[plannedTermId]/page.tsx", import.meta.url), "utf8");
    assert.match(page, /not-typeset flex flex-col gap-6 py-6/);
    assert.match(page, /text-3xl font-bold text-balance sm:text-4xl/);
    assert.match(page, />Plans</);
    assert.match(page, /Term plans for the students assigned to you\. Open a plan to review it or leave a note\./);
    assert.match(page, /hidden xl:block/);
    assert.match(page, /space-y-4 xl:hidden/);
    assert.doesNotMatch(page, /hidden md:block|md:hidden/);
    assert.match(page, /<TableHead className="w-\[26%\]">Student<\/TableHead>/);
    assert.match(page, /<TableHead className="w-\[16%\]">Term<\/TableHead>/);
    assert.match(page, /<TableHead className="w-\[22%\]">Status<\/TableHead>/);
    assert.match(page, /<TableHead className="w-\[20%\]">Updated<\/TableHead>/);
    assert.match(page, /<TableHead className="w-\[16%\]">Action<\/TableHead>/);
    assert.match(page, /Empty className="border"/);
    assert.match(page, /plannedTermStatusLabel\(plan\.status\)/);
    assert.match(page, /advisorPlanUpdatedLabel\(plan\)/);
    assert.match(page, /Review plan/);
    assert.match(page, /View plan/);
    assert.match(page, /encodeURIComponent\(plansReturn\)/);
    assert.match(page, /const plansReturn = "\/advisor\/plans"/);
    assert.doesNotMatch(page, /\{plan\.status\}/);
    assert.doesNotMatch(page, /xl:grid-cols-4|Needs your review/);
    assert.match(loading, /flex flex-col gap-6 py-6/);
    assert.match(review, /advisorReturnTarget\(query\.from\)/);
    assert.match(review, /\{back\.label\}/);
});
