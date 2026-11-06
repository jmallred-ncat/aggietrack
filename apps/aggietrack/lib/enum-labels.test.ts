import assert from "node:assert/strict";
import { test } from "node:test";
import { Grade, PlannedTermStatus, TranscriptStatus, TranscriptSource } from "./generated/prisma/browser";
import { gradeLabel, planStatusLabel, transcriptStatusLabel, transcriptSourceLabel } from "./enum-labels";

test("every Grade enum value has a human label", () => {
  for (const grade of Object.values(Grade)) {
    const label = gradeLabel(grade);
    assert.ok(label, `Grade ${grade} should have a label`);
    assert.ok(!label.includes("_"), `Grade label "${label}" should not contain underscore`);
  }
});

test("gradeLabel returns em dash for null", () => {
  const label = gradeLabel(null);
  assert.equal(label, "—");
});

test("every TranscriptStatus enum value has a human label", () => {
  for (const status of Object.values(TranscriptStatus)) {
    const label = transcriptStatusLabel(status);
    assert.ok(label, `TranscriptStatus ${status} should have a label`);
    assert.ok(!label.includes("_"), `TranscriptStatus label "${label}" should not contain underscore`);
  }
});

test("every TranscriptSource enum value has a human label", () => {
  for (const source of Object.values(TranscriptSource)) {
    const label = transcriptSourceLabel(source);
    assert.ok(label, `TranscriptSource ${source} should have a label`);
    assert.ok(!label.includes("_"), `TranscriptSource label "${label}" should not contain underscore`);
  }
});

test("plan status uses one set of words and never a raw enum", () => {
  assert.equal(planStatusLabel(PlannedTermStatus.DRAFT), "Draft");
  assert.equal(planStatusLabel(PlannedTermStatus.SUBMITTED), "Waiting for review");
  assert.equal(planStatusLabel(PlannedTermStatus.APPROVED), "Approved");
  assert.equal(planStatusLabel("RETURNED"), "Status unavailable");
  assert.equal(planStatusLabel("SUBMITTED_LATE"), "Status unavailable");

  for (const status of Object.values(PlannedTermStatus)) {
    const label = planStatusLabel(status);
    assert.equal(label.includes("_"), false);
    assert.notEqual(label, status);
  }
});

test("grade labels are correct", () => {
  assert.equal(gradeLabel(Grade.A), "A");
  assert.equal(gradeLabel(Grade.A_MINUS), "A-");
  assert.equal(gradeLabel(Grade.B_PLUS), "B+");
  assert.equal(gradeLabel(Grade.B), "B");
  assert.equal(gradeLabel(Grade.B_MINUS), "B-");
  assert.equal(gradeLabel(Grade.C_PLUS), "C+");
  assert.equal(gradeLabel(Grade.C), "C");
  assert.equal(gradeLabel(Grade.C_MINUS), "C-");
  assert.equal(gradeLabel(Grade.D_PLUS), "D+");
  assert.equal(gradeLabel(Grade.D), "D");
  assert.equal(gradeLabel(Grade.F), "F");
  assert.equal(gradeLabel(Grade.P), "P");
  assert.equal(gradeLabel(Grade.TR), "TR");
  assert.equal(gradeLabel(Grade.W), "W");
  assert.equal(gradeLabel(Grade.I), "I");
});
