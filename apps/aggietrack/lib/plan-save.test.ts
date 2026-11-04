import assert from "node:assert/strict";
import { test } from "node:test";
import { PLAN_SAVE_DEADLINE_MS, PLAN_SAVE_FAILED, finishPlanSave, type PlanSaveResult } from "./plan-save";

test("add and remove finish within the 15 second deadline", async () => {
    assert.equal(PLAN_SAVE_DEADLINE_MS, 15_000);
    const started = Date.now();
    const added = await finishPlanSave(async () => ({ success: true as const, added: "CST 130" }));
    const removed = await finishPlanSave(async () => ({ success: true as const, removed: "CST 130" }));
    assert.ok(Date.now() - started < PLAN_SAVE_DEADLINE_MS);
    assert.equal(added.status, "saved");
    assert.equal(removed.status, "saved");
    if (added.status === "saved") assert.equal(added.result.added, "CST 130");
    if (removed.status === "saved") assert.equal(removed.result.removed, "CST 130");
});

test("a save that returns before the deadline is applied", async () => {
    const outcome = await finishPlanSave(
        () => new Promise<PlanSaveResult>((resolve) => setTimeout(() => resolve({ success: true }), 20)),
        { deadlineMs: PLAN_SAVE_DEADLINE_MS },
    );
    assert.equal(outcome.status, "saved");
});

test("a failed save shows the error toast and leaves the screen on the database plan", async () => {
    const database = ["MATH 110"];
    let screen = [...database];
    const outcome = await finishPlanSave(() => new Promise<PlanSaveResult>(() => {}), { deadlineMs: 30 });
    if (outcome.status === "saved") screen = [...screen, "CST 130"];
    else screen = [...database];

    assert.equal(outcome.status, "failed");
    if (outcome.status === "failed") {
        assert.equal(outcome.message, PLAN_SAVE_FAILED);
        assert.equal(outcome.message, "Couldn't save, try again");
        assert.equal(outcome.sonner, true);
        assert.equal(outcome.refresh, true);
        assert.doesNotMatch(outcome.message, /P\d{4}|DRAFT|SUBMITTED|Prisma/);
    }
    assert.deepEqual(screen, database);
});

test("a thrown database error does not show the raw code", async () => {
    const outcome = await finishPlanSave(async () => {
        throw new Error("Transaction already closed. P2028 PlannedTermStatus.DRAFT");
    });
    assert.equal(outcome.status, "failed");
    if (outcome.status === "failed") {
        assert.equal(outcome.message, "Couldn't save, try again");
        assert.equal(outcome.sonner, true);
        assert.equal(outcome.refresh, true);
    }
});

test("a returned save failure refreshes and does not change the plan", async () => {
    const database = ["MATH 110"];
    let screen = [...database];
    const outcome = await finishPlanSave(async () => ({ success: false as const, error: PLAN_SAVE_FAILED }));
    if (outcome.status === "saved") screen = [...screen, "CST 130"];
    else screen = [...database];
    assert.equal(outcome.status, "failed");
    if (outcome.status === "failed") {
        assert.equal(outcome.message, PLAN_SAVE_FAILED);
        assert.equal(outcome.sonner, true);
        assert.equal(outcome.refresh, true);
    }
    assert.deepEqual(screen, database);
});

test("a late save refreshes again after the deadline", async () => {
    let late = 0;
    const outcome = await finishPlanSave(
        () => new Promise<PlanSaveResult>((resolve) => setTimeout(() => resolve({ success: true }), 60)),
        { deadlineMs: 20, onLate: () => { late += 1; } },
    );
    assert.equal(outcome.status, "failed");
    await new Promise((resolve) => setTimeout(resolve, 70));
    assert.equal(late, 1);
});

test("a rule violation stays on the alert and does not use the save-failed toast", async () => {
    const outcome = await finishPlanSave(async () => ({
        success: false as const,
        error: "CST 112 needs CST 120 before Spring 2027.",
        violations: ["CST 112 needs CST 120 before Spring 2027."],
    }));
    assert.equal(outcome.status, "violations");
    if (outcome.status === "violations") {
        assert.match(outcome.violations[0] ?? "", /CST 112/);
    }
});
