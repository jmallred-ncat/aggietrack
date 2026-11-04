import assert from "node:assert/strict";
import { test } from "node:test";
import { Grade } from "./generated/prisma/client";
import {
    canClearAttempt,
    clearCompletionToast,
    completionGradeChoices,
    completionGradeLabel,
    gradeUpdatedToast,
    labelsNewlyMarkedComplete,
    markedCompleteToast,
    runAfterConfirmCloses,
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

test("grade and clear toasts use letter labels, not stored enums", () => {
    const grade = gradeUpdatedToast(completionGradeLabel(Grade.C));
    const minus = gradeUpdatedToast(completionGradeLabel(Grade.A_MINUS));
    const cleared = clearCompletionToast({
        subject: "CST",
        number: "130",
        anotherAttemptRemains: false,
    });
    const removed = clearCompletionToast({
        subject: "CST",
        number: "130",
        anotherAttemptRemains: true,
    });

    assert.equal(grade.title, "Grade updated");
    assert.equal(grade.description, "Saved as C.");
    assert.equal(minus.description, "Saved as A-.");
    assert.equal(cleared.title, "Completion cleared");
    assert.equal(cleared.description, "CST 130 is not completed.");
    assert.equal(removed.title, "Attempt removed");

    for (const message of [grade, minus, cleared, removed]) {
        assert.equal(`${message.title} ${message.description}`.includes("_"), false);
        assert.equal(`${message.title} ${message.description}`.includes("COMPLETED"), false);
    }
});

test("the first checkmark save names the course in a toast", () => {
    const labels = labelsNewlyMarkedComplete([
        { label: "CST 120", previous: "complete", next: "complete" },
        { label: "CST 130", previous: "", next: "complete" },
        { label: "MATH 110", previous: "transfer", next: "complete" },
        { label: "ENGL 100", previous: "", next: "transfer" },
        { label: "   ", previous: "", next: "complete" },
    ]);
    const one = markedCompleteToast(["CST 130"]);
    const two = markedCompleteToast(["CST 130", "MATH 110"]);

    assert.deepEqual(labels, ["CST 130", "MATH 110"]);
    assert.equal(markedCompleteToast([]), null);
    assert.equal(one?.title, "Marked complete");
    assert.equal(one?.description, "CST 130 is saved.");
    assert.equal(two?.description, "CST 130 and MATH 110 are saved.");
    assert.equal(`${one?.title} ${one?.description}`.includes("COMPLETED"), false);
});

test("a confirm closes before the save is scheduled", () => {
    const order: string[] = [];

    runAfterConfirmCloses(
        () => order.push("close"),
        () => order.push("save"),
        (save) => {
            order.push("scheduled");
            save();
        },
    );

    assert.deepEqual(order, ["close", "scheduled", "save"]);
});

test("a transcript save refreshes progress, the dashboard, and planner totals", () => {
    const targets = studentViewRefreshTargets();

    assert.ok(targets.some((target) => target.path === "/student/progress" && target.type === undefined));
    assert.ok(targets.some((target) => target.path === "/student/planner" && target.type === undefined));
    assert.ok(targets.some((target) => target.path === "/student" && target.type === undefined));
    assert.ok(targets.some((target) => target.path === "/student" && target.type === "layout"));
});
