import assert from "node:assert/strict";
import test from "node:test";
import { advisorCancelSuccess, groupOpenSlots, meetingSuccessText } from "./advising-copy";
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

test("advisor cancel names a real recipient and does not confirm a failed save", () => {
    const success = (result: { ok: true; studentName?: string }) => advisorCancelSuccess(result.studentName);
    assert.equal(meetingSuccessText({ ok: true, studentName: "Avery Cole" }, success), "Session canceled. Avery Cole can see your note.");
    assert.equal(meetingSuccessText({ ok: false, code: "failed", title: "This session is unavailable", description: "It does not exist or you do not have access to it." }, success), null);
    for (const missing of ["", "  ", null, undefined, "Former user", "former user", "  Former   user "]) {
        assert.equal(advisorCancelSuccess(missing), "Session canceled. Your note was saved.");
        assert.equal(advisorCancelSuccess(missing).includes("Former user"), false);
    }
    const emptyUser = { firstName: "", lastName: " ", name: "" };
    const deletedUser = null;
    assert.equal(personName(emptyUser), "Former user");
    assert.equal(personName(deletedUser), "Former user");
    assert.equal(advisorCancelSuccess(personName(emptyUser)), "Session canceled. Your note was saved.");
    assert.equal(advisorCancelSuccess(personName(deletedUser)), "Session canceled. Your note was saved.");
    assert.equal(meetingSuccessText({ ok: true, studentName: "Former user" }, success), "Session canceled. Your note was saved.");
    assert.equal(meetingSuccessText({ ok: true }, success), "Session canceled. Your note was saved.");
});
