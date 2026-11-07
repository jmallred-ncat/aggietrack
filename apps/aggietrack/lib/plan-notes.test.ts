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
    planNoteEventAction,
    planNoteTimestamp,
    planNoteTimestampTitle,
    planNotesAudienceDescription,
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
    assert.equal(shown.eventAction, null);
    assert.equal(shown.roleLabel, "Advisor");
    assert.equal(shown.body, "Please add the lab.");
    assert.doesNotMatch(JSON.stringify(shown), /\bRETURN\b/);
    const caption = presentPlanNote({
        id: "n2",
        body: "Plan submitted for review",
        kind: "NOTE",
        createdAt: new Date("2026-11-06T04:26:00.000Z"),
        authorName: "Avery Cole",
        authorRole: "STUDENT",
    });
    assert.equal(caption.eventAction, null);
    assert.equal(caption.body, "Plan submitted for review");
    assert.equal(planNoteEventAction("SUBMISSION", ""), "submitted");
    assert.equal(planNoteEventAction("SUBMISSION", "I added a note with the submission."), null);
    assert.equal(planNoteEventAction("APPROVAL", " "), "approved");
    assert.equal(planNoteEventAction("RETURN", ""), "changes");
    assert.equal(planNoteEventAction("NOTE", ""), null);
    const cursor = earlierNoteWhere({ createdAt: new Date("2026-11-06T03:45:00.000Z"), id: "n1" });
    assert.equal(cursor.OR.length, 2);
});

test("note times use Eastern Time, show the zone, and omit the current year", () => {
    const now = new Date("2026-11-07T05:00:00.000Z");
    assert.equal(planNoteTimestamp("2026-11-07T00:15:00.000Z", now), "Nov 6, 7:15 PM EST");
    assert.equal(planNoteTimestampTitle("2026-11-07T00:15:00.000Z"), "Nov 6, 2026, 7:15 PM EST");
    assert.equal(planNoteTimestamp("2025-11-07T00:15:00.000Z", now), "Nov 6, 2025, 7:15 PM EST");
    assert.equal(planNoteTimestamp("2026-07-06T23:15:00.000Z", now), "Jul 6, 7:15 PM EDT");
    assert.equal(planNoteTimestamp("not-a-date", now), null);
    const newYearEve = new Date("2027-01-01T03:30:00.000Z");
    assert.equal(planNoteTimestamp("2027-01-01T04:30:00.000Z", newYearEve), "Dec 31, 11:30 PM EST");
    assert.equal(planNoteTimestamp("2027-01-01T05:00:00.000Z", newYearEve), "Jan 1, 2027, 12:00 AM EST");
    assert.equal(planNotesAudienceDescription("student"), "You and your advisor can read these notes.");
    assert.equal(planNotesAudienceDescription("advisor"), "You and the student can read these notes.");
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
