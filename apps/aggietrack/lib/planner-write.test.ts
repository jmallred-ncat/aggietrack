import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PLAN_SAVE_FAILED } from "./plan-save";
import {
    PLAN_TRANSACTION_TIMEOUT_MS,
    friendlyPlannerError,
    planTransactionOptions,
    plannerWriteFaultValue,
    takePlannerWriteFault,
    waitForPlannerFault,
    writePlannedCourses,
} from "./planner-write";

const actionsSource = readFileSync(
    new URL("../app/(app)/student/(started)/planner/actions.ts", import.meta.url),
    "utf8",
);

test("planner writes use a 10 second interactive transaction and keep the draft claim", () => {
    assert.equal(PLAN_TRANSACTION_TIMEOUT_MS, 10_000);
    assert.deepEqual(planTransactionOptions(), { timeout: 10_000 });
    assert.equal(actionsSource.match(/planTransactionOptions\(\)/g)?.length, 4);
    assert.match(actionsSource, /claimDraftPlan/);
    assert.match(actionsSource, /violationsForRemoval/);
    assert.match(actionsSource, /writePlannedCourses/);
    assert.match(actionsSource, /takePlannerWriteFault/);
});

test("an injected lab-insert failure leaves neither row", async () => {
    const rows: string[] = [];
    const inserted: string[] = [];
    await assert.rejects(async () => {
        const snapshot = rows.slice();
        try {
            await writePlannedCourses(
                ["cst-112", "cst-122"],
                (id) => id === "cst-122",
                { mode: "fail" },
                async (id) => {
                    inserted.push(id);
                    rows.push(id);
                    return id;
                },
            );
        } catch (error) {
            rows.splice(0, rows.length, ...snapshot);
            throw error;
        }
    });
    assert.deepEqual(inserted, ["cst-112"]);
    assert.deepEqual(rows, []);
});

test("a failed single-course insert leaves no row", async () => {
    const rows: string[] = [];
    await assert.rejects(() => writePlannedCourses(
        ["cst-130"],
        () => false,
        { mode: "fail" },
        async (id) => {
            rows.push(id);
            return id;
        },
    ));
    assert.deepEqual(rows, []);
});

test("a lecture and lab without a fault are both inserted", async () => {
    const rows = await writePlannedCourses(
        ["cst-112", "cst-122"],
        (id) => id === "cst-122",
        null,
        async (id) => id,
    );
    assert.deepEqual(rows, ["cst-112", "cst-122"]);
});

test("production ignores a planner write fault", async () => {
    let reads = 0;
    let clears = 0;
    const failed = await takePlannerWriteFault("production", "student-1", {
        read: async () => {
            reads += 1;
            return "fail";
        },
        clear: async () => {
            clears += 1;
            return true;
        },
    });
    const delayed = await takePlannerWriteFault("production", "student-1", {
        read: async () => {
            reads += 1;
            return "delay:16";
        },
        clear: async () => {
            clears += 1;
            return true;
        },
    });
    assert.equal(failed, null);
    assert.equal(delayed, null);
    assert.equal(reads, 0);
    assert.equal(clears, 0);
});

test("preview consumes the next fail or delay once", async () => {
    const stored = { value: "fail" as string | null };
    const fault = await takePlannerWriteFault("preview", "student-1", {
        read: async () => stored.value,
        clear: async (_id, raw) => {
            if (stored.value !== raw) return false;
            stored.value = null;
            return true;
        },
    });
    assert.deepEqual(fault, { mode: "fail" });
    const again = await takePlannerWriteFault("preview", "student-1", {
        read: async () => stored.value,
        clear: async () => true,
    });
    assert.equal(again, null);

    const waited: number[] = [];
    await waitForPlannerFault({ mode: "delay", seconds: 16 }, async (ms) => {
        waited.push(ms);
    });
    assert.deepEqual(waited, [16_000]);
    assert.deepEqual(plannerWriteFaultValue("delay", undefined), { ok: true, value: "delay:16" });
});

test("prisma errors become sentences without codes or enums", () => {
    const unique = Object.assign(new Error("Unique constraint failed on the fields: (`plannedTermId`,`courseId`) P2002 PlannedTermStatus.DRAFT"), { code: "P2002" });
    const missing = Object.assign(new Error("An operation failed because it depends on one or more records that were required but not found. P2025"), { code: "P2025" });
    const timedOut = Object.assign(new Error("Transaction already closed. The timeout for this transaction was 10000 ms. P2028"), { code: "P2028" });
    const sentences = [friendlyPlannerError(unique), friendlyPlannerError(missing), friendlyPlannerError(timedOut), friendlyPlannerError(new Error("PlannedTermStatus.SUBMITTED"))];
    assert.deepEqual(sentences, [
        "That course is already on this term plan.",
        "That course is no longer on this plan.",
        PLAN_SAVE_FAILED,
        PLAN_SAVE_FAILED,
    ]);
    for (const sentence of sentences) {
        assert.doesNotMatch(sentence, /P\d{4}/);
        assert.doesNotMatch(sentence, /DRAFT|SUBMITTED|APPROVED|Prisma|plannedTermId/);
    }
});
