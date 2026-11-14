import assert from "node:assert/strict";
import { test } from "node:test";
import { Grade } from "./generated/prisma/client";
import {
    addAttemptWrite,
    chooseAddAttemptGrade,
    confirmAddAttempt,
    keepAddAttemptChoice,
    openAddAttempt,
} from "./add-attempt";

test("opening add attempt does not write a grade and does not preselect C", () => {
    const opened = openAddAttempt();

    assert.equal(opened.open, true);
    assert.equal(opened.pending, false);
    assert.equal(opened.grade, null);
    assert.equal(addAttemptWrite(opened), null);
    assert.notEqual(opened.grade, Grade.C);
});

test("confirming without a grade does not write", () => {
    const opened = openAddAttempt();
    const confirmed = confirmAddAttempt(opened);

    assert.equal(confirmed.ok, false);
    if (confirmed.ok) return;
    assert.equal(confirmed.draft.open, true);
    assert.equal(confirmed.draft.pending, false);
    assert.equal(addAttemptWrite(confirmed.draft), null);
});

test("the chosen grade is what would be saved, including A-, F, W, and TR", () => {
    const cases = [
        { grade: Grade.A_MINUS, label: "A-" },
        { grade: Grade.F, label: "F" },
        { grade: Grade.W, label: "Withdrawn (W)" },
        { grade: Grade.TR, label: "Transfer credit (TR)" },
        { grade: Grade.C, label: "C" },
    ] as const;

    for (const item of cases) {
        const opened = openAddAttempt();
        assert.equal(addAttemptWrite(opened), null);

        const chosen = chooseAddAttemptGrade(opened, item.grade);
        assert.equal(addAttemptWrite(chosen), null, "choosing a grade still waits for confirm");

        const confirmed = confirmAddAttempt(chosen);
        assert.equal(confirmed.ok, true);
        if (!confirmed.ok) continue;
        assert.equal(confirmed.grade, item.grade);
        assert.equal(confirmed.label, item.label);
        assert.equal(confirmed.label.includes("_"), false);
        assert.equal(confirmed.draft.open, false);
        assert.equal(confirmed.draft.pending, true);
        assert.equal(addAttemptWrite(confirmed.draft), item.grade);
    }
});

test("a failed save keeps the chosen grade for another try", () => {
    const confirmed = confirmAddAttempt(chooseAddAttemptGrade(openAddAttempt(), Grade.A_MINUS));
    assert.equal(confirmed.ok, true);
    if (!confirmed.ok) return;

    const kept = keepAddAttemptChoice(confirmed.draft);
    assert.equal(kept.pending, false);
    assert.equal(addAttemptWrite(kept), null);

    const reopened = openAddAttempt(kept.grade);
    assert.equal(reopened.grade, Grade.A_MINUS);
    assert.equal(addAttemptWrite(reopened), null);

    const again = confirmAddAttempt(reopened);
    assert.equal(again.ok, true);
    if (!again.ok) return;
    assert.equal(again.grade, Grade.A_MINUS);
    assert.equal(again.label, "A-");
});
