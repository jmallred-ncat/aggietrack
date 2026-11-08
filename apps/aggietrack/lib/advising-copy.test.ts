import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { advisorCancelLabel, advisorCancelSuccess, advisorChangeNoteHelper, advisorRescheduleLabel, advisorRescheduleSuccess, groupOpenSlots, meetingSuccessText, studentBookingNoteHelper } from "./advising-copy";
import { personName } from "./plan-status";
import type { OpenSlotChoice } from "./advising-types";

function slot(id: string, heading: string, label: string, accessible: string): OpenSlotChoice {
    return {
        id,
        dateHeading: heading,
        slotLabel: label,
        accessibleName: accessible,
        fullTimestamp: `${heading}, ${label} EST`,
        durationMinutes: 30,
        durationLabel: "30 minutes",
        iso: "2026-12-03T21:30:00.000Z",
    };
}

test("same-clock times on different days stay in separate date headings", () => {
    const groups = groupOpenSlots([
        slot("dec3", "Thursday, December 3, 2026", "4:30–5:00 PM", "Thursday, December 3, 4:30 to 5:00 PM Eastern Time"),
        slot("dec10", "Thursday, December 10, 2026", "4:30–5:00 PM", "Thursday, December 10, 4:30 to 5:00 PM Eastern Time"),
    ]);
    assert.deepEqual(groups.map((group) => group.heading), ["Thursday, December 3, 2026", "Thursday, December 10, 2026"]);
    assert.equal(groups[0]?.slots[0]?.accessibleName, "Thursday, December 3, 4:30 to 5:00 PM Eastern Time");
    assert.notEqual(groups[0]?.slots[0]?.accessibleName, groups[1]?.slots[0]?.accessibleName);
});

test("availability success is Times added only after the save succeeds", () => {
    assert.equal(meetingSuccessText({ ok: true }, "Times added"), "Times added");
    assert.equal(meetingSuccessText({ ok: true }, "Time added"), "Time added");
    assert.equal(meetingSuccessText({ ok: false, code: "failed", title: "That time is in the past", description: "Add a time that has not started yet." }, "Times added"), null);
});

test("advisor cancel saves the note without claiming who can see it", () => {
    const saved = "Session canceled. Your note was saved.";
    assert.equal(advisorCancelSuccess(), saved);
    assert.equal(saved.includes("can see"), false);
    const success = () => advisorCancelSuccess();
    for (const studentName of ["Avery Cole", "Former user", "former user", "", undefined]) {
        assert.equal(meetingSuccessText({ ok: true, studentName }, success), saved);
    }
    assert.equal(meetingSuccessText({ ok: false, code: "failed", title: "This session is unavailable", description: "It does not exist or you do not have access to it." }, success), null);
    const emptyUser = { firstName: "", lastName: " ", name: "" };
    const deletedUser = null;
    assert.equal(personName(emptyUser), "Former user");
    assert.equal(personName(deletedUser), "Former user");
    assert.equal(meetingSuccessText({ ok: true, studentName: personName(emptyUser) }, success), saved);
    assert.equal(meetingSuccessText({ ok: true, studentName: personName(deletedUser) }, success), saved);
});

test("advisor change copy asks for a note without promising who can read it", () => {
    const helper = "Required. Add a note explaining this change.";
    assert.equal(advisorChangeNoteHelper, helper);
    assert.equal(advisorCancelLabel, "Why are you canceling?");
    assert.equal(advisorRescheduleLabel, "Why are you rescheduling?");
    assert.equal(advisorRescheduleSuccess, "Session rescheduled");
    assert.equal(studentBookingNoteHelper, "Your advisor can read this note.");
    for (const sentence of [helper, advisorRescheduleSuccess, advisorCancelSuccess()]) {
        assert.equal(sentence.includes("can see"), false);
        assert.equal(sentence.includes("can read"), false);
        assert.equal(sentence.includes("will see"), false);
    }
    const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
    const board = readFileSync(join(root, "apps/aggietrack/components/advising/advisor-board.tsx"), "utf8");
    const student = readFileSync(join(root, "apps/aggietrack/components/advising/student-board.tsx"), "utf8");
    const card = readFileSync(join(root, "apps/aggietrack/components/advising/session-card.tsx"), "utf8");
    const rules = readFileSync(join(root, "docs/agt-17-design-rules.md"), "utf8");
    assert.match(board, /aria-describedby="advisor-change-note-help"/);
    assert.match(board, /id="advisor-change-note-help"/);
    assert.match(board, /aria-describedby="advisor-move-note-help"/);
    assert.match(board, /id="advisor-move-note-help"/);
    assert.match(board, /label=\{advisorCancelLabel\}/);
    assert.match(board, /\{advisorRescheduleLabel\}/);
    assert.match(board, /success=\{advisorCancelSavedSuccess\}/);
    assert.match(board, /advisorRescheduleSuccess/);
    assert.doesNotMatch(board, /They will see your note/);
    assert.doesNotMatch(board, /The student can read this note/);
    assert.doesNotMatch(board, /can see your note/);
    assert.match(student, /studentBookingNoteHelper/);
    assert.match(student, /advisorRescheduleSuccess/);
    assert.match(card, /notice\.body/);
    assert.doesNotMatch(rules, /They will see your note/);
    assert.doesNotMatch(rules, /The student can read this note/);
    assert.match(rules, /Required\. Add a note explaining this change\./);
    assert.match(rules, /aria-describedby/);
});
