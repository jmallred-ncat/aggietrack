import assert from "node:assert/strict";
import { test } from "node:test";
import {
    appendPlanNote,
    checkedNoteBody,
    earlierNoteWhere,
    NOTE_MAX_LENGTH,
    NOTE_PAGE_SIZE,
    pagePlanNotes,
    planEventLabel,
    planNoteDenial,
    presentPlanNote,
    sortPlanNotes,
} from "./plan-notes";

const plan = { id: "plan-1", studentUserId: "student-user", advisorId: "advisor-user" };

test("only the owning student and assigned advisor can use a plan thread", () => {
    assert.equal(planNoteDenial({ id: "student-user", role: "STUDENT" }, plan), null);
    assert.equal(planNoteDenial({ id: "advisor-user", role: "ADVISOR" }, plan), null);
    assert.ok(planNoteDenial({ id: "other", role: "STUDENT" }, plan));
    assert.ok(planNoteDenial({ id: "advisor-user", role: "ADMIN" }, plan));
    assert.ok(planNoteDenial({ id: "admin", role: "ADMIN" }, plan));
    assert.ok(planNoteDenial({ id: "advisor-user", role: "ADVISOR" }, { ...plan, advisorId: "someone-else" }));
    assert.equal(
        planNoteDenial({ id: "student-user", role: "STUDENT" }, null),
        planNoteDenial({ id: "stranger", role: "ADVISOR" }, plan),
    );
});

test("notes stay within 2,000 characters and pages of 20", () => {
    assert.equal(checkedNoteBody("   ", "note").ok, false);
    assert.equal(checkedNoteBody("x".repeat(NOTE_MAX_LENGTH), "note").ok, true);
    assert.equal(checkedNoteBody("x".repeat(NOTE_MAX_LENGTH + 1), "comment").ok, false);
    assert.equal(NOTE_PAGE_SIZE, 20);
    const rows = Array.from({ length: 21 }, (_, index) => ({
        id: String(index).padStart(2, "0"),
        createdAt: new Date(Date.UTC(2026, 10, 1, 0, index)),
    }));
    const page = pagePlanNotes([...rows].reverse());
    assert.equal(page.notes.length, 20);
    assert.equal(page.notes[0]?.id, "01");
    assert.equal(page.notes.at(-1)?.id, "20");
    assert.ok(page.earlierCursor?.endsWith("|01"));
});

test("notes sort oldest first and events never expose the pin or a raw kind", () => {
    const sorted = sortPlanNotes([
        { id: "b", createdAt: "2026-11-06T00:00:00.000Z" },
        { id: "a", createdAt: "2026-11-06T00:00:00.000Z" },
        { id: "c", createdAt: "2026-11-05T00:00:00.000Z" },
    ]);
    assert.deepEqual(sorted.map((note) => note.id), ["c", "a", "b"]);
    assert.equal(planEventLabel("SUBMISSION"), "Plan submitted for review");
    assert.equal(planEventLabel("APPROVAL"), "Plan approved");
    assert.equal(planEventLabel("NOTE"), null);
    const shown = presentPlanNote({
        id: "n1",
        body: "Please add the lab.",
        kind: "RETURN",
        createdAt: new Date("2026-11-06T03:45:00.000Z"),
        authorName: "Sarah Martinez",
        authorRole: "ADVISOR",
    });
    assert.equal(shown.badge, "Changes requested");
    assert.equal(shown.roleLabel, "Advisor");
    assert.equal(shown.body, "Please add the lab.");
    assert.doesNotMatch(JSON.stringify(shown), /\bRETURN\b/);
    const cursor = earlierNoteWhere({ createdAt: new Date("2026-11-06T03:45:00.000Z"), id: "n1" });
    assert.equal(cursor.OR.length, 2);
});

test("the same request posts one note", async () => {
    const notes: Array<{ id: string; plannedTermId: string; requestId: string }> = [];
    const tx = {
        planNote: {
            findUnique: async (args: { where: { authorId_requestId: { requestId: string } } }) =>
                notes.find((note) => note.requestId === args.where.authorId_requestId.requestId) ?? null,
            create: async (args: { data: { plannedTermId: string; requestId: string } }) => {
                const note = { id: `note-${notes.length + 1}`, plannedTermId: args.data.plannedTermId, requestId: args.data.requestId };
                notes.push(note);
                return note;
            },
        },
    };
    const first = await appendPlanNote(tx, {
        plan,
        viewer: { id: "student-user", role: "STUDENT" },
        authorName: "Jordan Hale",
        body: "  Can I swap the lab?  ",
        requestId: "req-1",
    });
    const second = await appendPlanNote(tx, {
        plan,
        viewer: { id: "student-user", role: "STUDENT" },
        authorName: "Jordan Hale",
        body: "Can I swap the lab?",
        requestId: "req-1",
    });
    assert.equal(first.success && first.noteId, "note-1");
    assert.equal(second.success && "idempotent" in second && second.idempotent, true);
    assert.equal(notes.length, 1);
});
