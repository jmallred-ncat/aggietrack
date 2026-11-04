import assert from "node:assert/strict";
import { test } from "node:test";
import { approveIfAssigned, type PlanAssignment } from "./plan-approval-authz";

function submittedPlan(advisorId: string | null, status = "SUBMITTED"): PlanAssignment & { id: string } {
    return {
        id: "plan-1",
        status,
        student: { advisorId },
    };
}

test("an advisor who is not assigned to the student is refused and nothing is saved", async () => {
    let saved = false;
    const result = await approveIfAssigned({
        advisorId: "advisor-a",
        plan: submittedPlan("advisor-b"),
        persist: async () => {
            saved = true;
            return true;
        },
    });

    assert.deepEqual(result, {
        success: false,
        error: "You can only approve a plan for a student assigned to you.",
    });
    assert.equal(saved, false);
    if (!result.success) {
        assert.equal(result.error.includes("_"), false);
    }
});

test("a student with no advisor is refused", async () => {
    let saved = false;
    const result = await approveIfAssigned({
        advisorId: "advisor-a",
        plan: submittedPlan(null),
        persist: async () => {
            saved = true;
            return true;
        },
    });

    assert.deepEqual(result, {
        success: false,
        error: "You can only approve a plan for a student assigned to you.",
    });
    assert.equal(saved, false);
});

test("an assigned advisor approves the submitted plan", async () => {
    const saved: string[] = [];
    const result = await approveIfAssigned({
        advisorId: "advisor-a",
        plan: submittedPlan("advisor-a"),
        persist: async (plan) => {
            saved.push(plan.id);
            return true;
        },
    });

    assert.deepEqual(result, { success: true });
    assert.deepEqual(saved, ["plan-1"]);
});

test("an assigned advisor cannot approve a plan that is not waiting", async () => {
    let saved = false;
    const result = await approveIfAssigned({
        advisorId: "advisor-a",
        plan: submittedPlan("advisor-a", "DRAFT"),
        persist: async () => {
            saved = true;
            return true;
        },
    });

    assert.deepEqual(result, {
        success: false,
        error: "That term plan is not waiting for your review.",
    });
    assert.equal(saved, false);
});

test("a missing plan is refused before anything is saved", async () => {
    let saved = false;
    const result = await approveIfAssigned({
        advisorId: "advisor-a",
        plan: null,
        persist: async () => {
            saved = true;
            return true;
        },
    });

    assert.equal(result.success, false);
    assert.equal(saved, false);
});

test("a failed save does not count as approval", async () => {
    const result = await approveIfAssigned({
        advisorId: "advisor-a",
        plan: submittedPlan("advisor-a"),
        persist: async () => false,
    });

    assert.deepEqual(result, {
        success: false,
        error: "That term plan is not waiting for your review.",
    });
});
