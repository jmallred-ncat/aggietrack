import assert from "node:assert/strict";
import { test } from "node:test";
import { Grade } from "./generated/prisma/client";
import { attemptCreditPhrase, resolveAttemptCredits } from "./attempt-credits";
import { progressInProgressRejection } from "./transcript-write";

test("a named course stores catalog credits, not a forged client value", () => {
    for (const catalogCredits of [1, 3, 4]) {
        const resolved = resolveAttemptCredits({
            courseId: "course-1",
            catalogCredits,
            clientCredits: 3,
        });

        assert.equal(resolved.ok, true);
        if (!resolved.ok) continue;
        assert.equal(resolved.credits, catalogCredits);
    }

    const forged = resolveAttemptCredits({
        courseId: "lab-1",
        catalogCredits: 1,
        clientCredits: 6,
    });
    assert.equal(forged.ok, true);
    if (forged.ok) assert.equal(forged.credits, 1);
});

test("missing catalog credits do not fall back to 3", () => {
    for (const catalogCredits of [null, 0, -1, 1.5]) {
        const resolved = resolveAttemptCredits({
            courseId: "course-1",
            catalogCredits,
            clientCredits: 3,
        });

        assert.equal(resolved.ok, false);
        if (resolved.ok) continue;
        assert.equal(resolved.error, "Course details unavailable.");
        assert.equal("credits" in resolved, false);
    }
});

test("progress cannot create an in-progress attempt", () => {
  assert.equal(
    progressInProgressRejection("IN_PROGRESS"),
    "A course is marked in progress only after your advisor approves the plan.",
  );
  assert.equal(progressInProgressRejection("COMPLETED"), null);
  assert.equal(Grade.C, "C");
});

test("a custom course keeps the credits the student entered", () => {
    for (const clientCredits of [1, 3, 4]) {
        const resolved = resolveAttemptCredits({
            courseId: null,
            catalogCredits: 3,
            clientCredits,
        });

        assert.equal(resolved.ok, true);
        if (!resolved.ok) continue;
        assert.equal(resolved.credits, clientCredits);
    }

    const invalid = resolveAttemptCredits({
        courseId: null,
        catalogCredits: null,
        clientCredits: 9,
    });
    assert.equal(invalid.ok, false);
    if (!invalid.ok) {
        assert.notEqual(invalid.error, "3");
    }
});

test("credit phrasing is singular for one credit", () => {
    assert.equal(attemptCreditPhrase(1), "1 credit");
    assert.equal(attemptCreditPhrase(3), "3 credits");
    assert.equal(attemptCreditPhrase(4), "4 credits");
});
