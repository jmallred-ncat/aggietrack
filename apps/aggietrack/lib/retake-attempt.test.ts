import assert from "node:assert/strict";
import { test } from "node:test";
import { Grade } from "./generated/prisma/client";
import {
    addAttemptGradeText,
    chooseAddAttemptGrade,
    confirmAddAttempt,
    creditFactLabel,
    openAddAttempt,
    resolveAttemptCredits,
} from "./retake-attempt";

test("opening Add attempt does not write and does not invent a C", () => {
    const opened = openAddAttempt();

    assert.equal(opened.open, true);
    assert.equal(opened.pending, false);
    assert.equal(opened.grade, null);
    assert.notEqual(opened.grade, Grade.C);

    const unconfirmed = confirmAddAttempt(opened, {
        courseId: "cst-122",
        clientCredits: 3,
        catalogCredits: 1,
    });

    assert.equal(unconfirmed.write, false);
    if (unconfirmed.write) return;
    assert.equal(unconfirmed.reason, "grade");
    assert.equal(unconfirmed.draft.open, true);
    assert.equal(unconfirmed.draft.pending, false);
    assert.equal(unconfirmed.draft.grade, null);
});

test("a chosen retake grade is stored as that grade, with a human label", () => {
    const grades = [Grade.A_MINUS, Grade.F, Grade.W, Grade.TR, Grade.C] as const;

    for (const grade of grades) {
        const decision = confirmAddAttempt(
            chooseAddAttemptGrade(openAddAttempt(), grade),
            { courseId: "cst-130", clientCredits: 3, catalogCredits: 3 },
        );

        assert.equal(decision.write, true);
        if (!decision.write) continue;
        assert.equal(decision.grade, grade);
        assert.equal(decision.status, "COMPLETED");
        assert.equal(decision.draft.open, false);
        assert.equal(decision.draft.pending, true);
        assert.equal(decision.credits, 3);

        const label = addAttemptGradeText(grade);
        assert.equal(label.includes("_"), false);
        if (grade.includes("_")) assert.notEqual(label, grade);
        if (grade === Grade.A_MINUS) assert.equal(label, "A-");
        if (grade === Grade.F) assert.equal(label, "F");
        if (grade === Grade.W) assert.equal(label, "W");
        if (grade === Grade.TR) assert.equal(label, "TR");
    }
});

test("a named retake keeps catalog credits for labs and other courses", () => {
    const lab = resolveAttemptCredits({ courseId: "phys-111", clientCredits: 3, catalogCredits: 1 });
    const lecture = resolveAttemptCredits({ courseId: "cst-130", clientCredits: 1, catalogCredits: 3 });
    const four = resolveAttemptCredits({ courseId: "phys-241", clientCredits: 3, catalogCredits: 4 });
    const missing = resolveAttemptCredits({ courseId: "cst-130", clientCredits: 3, catalogCredits: null });
    const forged = confirmAddAttempt(chooseAddAttemptGrade(openAddAttempt(), Grade.B), {
        courseId: "phys-111",
        clientCredits: 3,
        catalogCredits: 1,
    });

    assert.deepEqual(lab, { ok: true, credits: 1 });
    assert.deepEqual(lecture, { ok: true, credits: 3 });
    assert.deepEqual(four, { ok: true, credits: 4 });
    assert.deepEqual(missing, { ok: false, code: "course-unavailable" });
    assert.equal(creditFactLabel(1), "1 credit");
    assert.equal(creditFactLabel(4), "4 credits");
    assert.equal(forged.write, true);
    if (forged.write) assert.equal(forged.credits, 1);

    const blocked = confirmAddAttempt(chooseAddAttemptGrade(openAddAttempt(), Grade.A), {
        courseId: "cst-130",
        clientCredits: 3,
        catalogCredits: null,
    });
    assert.equal(blocked.write, false);
    if (!blocked.write) {
        assert.equal(blocked.reason, "course-unavailable");
        assert.equal(blocked.draft.pending, false);
        assert.equal(blocked.draft.grade, Grade.A);
    }
});

test("a custom course keeps the credits the student entered", () => {
    const one = resolveAttemptCredits({ courseId: null, clientCredits: 1, catalogCredits: 3 });
    const four = resolveAttemptCredits({ courseId: "", clientCredits: 4, catalogCredits: null });
    const transfer = confirmAddAttempt(chooseAddAttemptGrade(openAddAttempt(), Grade.TR), {
        courseId: null,
        clientCredits: 4,
        catalogCredits: 3,
    });

    assert.deepEqual(one, { ok: true, credits: 1 });
    assert.deepEqual(four, { ok: true, credits: 4 });
    assert.equal(transfer.write, true);
    if (transfer.write) {
        assert.equal(transfer.credits, 4);
        assert.equal(transfer.grade, Grade.TR);
    }
});
