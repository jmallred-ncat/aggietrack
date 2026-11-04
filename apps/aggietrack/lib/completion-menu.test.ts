import assert from "node:assert/strict";
import { test } from "node:test";
import { Grade } from "./generated/prisma/client";
import {
    canClearAttempt,
    completionGradeChoices,
    completionGradeLabel,
    startClearCompletion,
} from "./completion-menu";
import { studentViewRefreshTargets } from "./plan-view";

test("grade choices use letter labels and never enum names", () => {
    const choices = completionGradeChoices();
    const minus = choices.find((choice) => choice.value === Grade.A_MINUS);
    const plus = choices.find((choice) => choice.value === Grade.B_PLUS);

    assert.equal(minus?.label, "A-");
    assert.equal(plus?.label, "B+");
    assert.equal(completionGradeLabel(Grade.A_MINUS), "A-");
    assert.equal(completionGradeLabel(Grade.B_PLUS), "B+");
    assert.equal(completionGradeLabel(null), "Grade");

    for (const choice of choices) {
        assert.equal(choice.label.includes("_"), false, choice.value);
        if (choice.value.includes("_")) {
            assert.notEqual(choice.label, choice.value);
        }
    }
});

test("a single completed attempt can be cleared", () => {
    assert.equal(canClearAttempt({ status: "COMPLETED" }), true);
    assert.equal(canClearAttempt({ status: "IN_PROGRESS" }), false);

    const cleared = startClearCompletion(
        [{ id: "cst-130", status: "COMPLETED" }],
        "cst-130",
    );

    assert.equal(cleared.dialogOpen, false);
    assert.equal(cleared.completed, false);
    assert.deepEqual(cleared.attempts, []);
});

test("clearing one attempt leaves the other completion in place", () => {
    const cleared = startClearCompletion(
        [
            { id: "first", status: "COMPLETED" },
            { id: "second", status: "COMPLETED" },
        ],
        "first",
    );

    assert.equal(cleared.dialogOpen, false);
    assert.equal(cleared.completed, true);
    assert.deepEqual(cleared.attempts.map((attempt) => attempt.id), ["second"]);
});

test("a transcript save refreshes progress, the dashboard, and planner totals", () => {
    const targets = studentViewRefreshTargets();

    assert.ok(targets.some((target) => target.path === "/student/progress" && target.type === undefined));
    assert.ok(targets.some((target) => target.path === "/student/planner" && target.type === undefined));
    assert.ok(targets.some((target) => target.path === "/student" && target.type === undefined));
    assert.ok(targets.some((target) => target.path === "/student" && target.type === "layout"));
});
