import assert from "node:assert/strict";
import { test } from "node:test";
import {
    catalogYearLabel,
    planCoursesLocked,
    planNoteRoleLabel,
    planTimestamp,
    plannedTermStatusLabel,
    plannedTermStatusVariant,
} from "./plan-status";

const rawEnum = /\b(DRAFT|SUBMITTED|APPROVED|RETURNED|IN_PROGRESS|STUDENT|ADVISOR|ADMIN)\b/;

test("plan statuses use the demo labels and badge variants", () => {
    assert.equal(plannedTermStatusLabel("DRAFT"), "Draft");
    assert.equal(plannedTermStatusVariant("DRAFT"), "secondary");
    assert.equal(plannedTermStatusLabel("SUBMITTED"), "Waiting for review");
    assert.equal(plannedTermStatusVariant("SUBMITTED"), "secondary");
    assert.equal(plannedTermStatusLabel("APPROVED"), "Approved");
    assert.equal(plannedTermStatusVariant("APPROVED"), "default");
    assert.equal(plannedTermStatusLabel("RETURNED"), "Changes requested");
    assert.equal(plannedTermStatusVariant("RETURNED"), "outline");
    assert.equal(plannedTermStatusLabel("NOPE"), "Status unavailable");
    assert.equal(plannedTermStatusVariant("NOPE"), "outline");
    for (const status of ["DRAFT", "SUBMITTED", "APPROVED", "RETURNED", "NOPE"]) {
        assert.doesNotMatch(plannedTermStatusLabel(status), rawEnum);
    }
});

test("only draft and returned plans can be edited", () => {
    assert.equal(planCoursesLocked("DRAFT"), false);
    assert.equal(planCoursesLocked("RETURNED"), false);
    assert.equal(planCoursesLocked("SUBMITTED"), true);
    assert.equal(planCoursesLocked("APPROVED"), true);
    assert.equal(planCoursesLocked("OTHER"), true);
});

test("roles and catalog years stay readable", () => {
    assert.equal(planNoteRoleLabel("STUDENT"), "Student");
    assert.equal(planNoteRoleLabel("ADVISOR"), "Advisor");
    assert.equal(planNoteRoleLabel("ADMIN"), "Admin");
    assert.equal(planNoteRoleLabel("OTHER"), "Team member");
    assert.equal(catalogYearLabel(2025), "2025–2026");
    assert.equal(catalogYearLabel(null), "Not set");
    assert.doesNotMatch(planNoteRoleLabel("STUDENT"), rawEnum);
});

test("timestamps use Eastern Time and do not print an ISO instant", () => {
    const label = planTimestamp("2026-11-06T03:45:00.000Z");
    assert.ok(label);
    assert.match(label!, /Nov 5, 2026/);
    assert.match(label!, /EST/);
    assert.doesNotMatch(label!, /T03:45/);
});
