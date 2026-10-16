import assert from "node:assert/strict";
import { test } from "node:test";
import { assignedTo, myWork } from "./assignments";
import type { RecordRow, Workspace } from "./model";

const jay = { name: "Jay Allred", email: "jay@example.test" };
const ivy = { name: "Ivy Mitchell", email: "ivy@example.test" };

test("a person matches their name, their email, and a shared owner list", () => {
  assert.equal(assignedTo(jay, "Jay Allred"), true);
  assert.equal(assignedTo(ivy, "Mellonie Evans / Ivy Mitchell"), true);
  assert.equal(assignedTo({ name: "Melonie Evans", email: "mellonie@example.test" }, "Melonie Evans"), true);
  assert.equal(assignedTo({ name: "Someone Else", email: "ivy@example.test" }, "Ivy Mitchell (ivy@example.test)"), true);
  assert.equal(assignedTo({ name: "James Allred", email: "james@example.test" }, "Jay Allred"), false);
  assert.equal(assignedTo(jay, ""), false);
  assert.equal(assignedTo(jay, undefined), false);
});

test("my work keeps each person's tests, defects, and decisions", () => {
  const workspace = sample();
  const work = myWork(workspace, ivy);
  assert.deepEqual(work.tests.map(item => item.id), ["T-02", "T-09"]);
  assert.equal(work.tests[0].status, "Fail");
  assert.deepEqual(work.defects.map(item => item.id), ["D-01"]);
  assert.deepEqual(work.decisions.map(item => [item.id, item.reviewerOnly]), [["Q-02", false], ["Q-04", true], ["Q-03", true]]);
  const jays = myWork(workspace, jay);
  assert.deepEqual(jays.tests.map(item => item.id), []);
  assert.deepEqual(jays.defects.map(item => item.id), ["D-02"]);
  assert.deepEqual(jays.decisions.map(item => item.id), ["Q-01"]);
});

function sample(): Workspace {
  return {
    source: "test",
    history: [],
    sections: [
      { name: "Tests", headers: [], rows: [
        row("T-09", { Assignee: "Ivy Mitchell (ivy@example.test)", "Test / scenario": "Later case", Status: "Not run", Priority: "Low" }),
        row("T-02", { Assignee: "Ivy Mitchell (ivy@example.test)", "Test / scenario": "Failed case", Status: "Fail", Priority: "High" }),
        row("T-03", { Assignee: "Jay Allred (jay@example.test)", "Test / scenario": "Jay's case", Status: "Not run", Priority: "High" }, true),
        row("T-04", { Assignee: "", "Test / scenario": "Unassigned", Status: "Not run" }),
      ] },
      { name: "Defects", headers: [], rows: [
        row("D-01", { Owner: "Ivy Mitchell", Summary: "Reset email fails", Status: "New", Severity: "High" }),
        row("D-02", { Owner: "Jay Allred", Summary: "Closed item", Status: "Closed", Severity: "Low" }),
      ] },
      { name: "Risks & Decisions", headers: [], rows: [
        row("Q-01", { "Decision owner role": "Jay Allred", "Issue / risk": "Identity rules", Status: "Open", Reviewer: "" }),
        row("Q-02", { "Decision owner role": "Mellonie Evans / Ivy Mitchell", "Issue / risk": "Shared call", Status: "Open", Reviewer: "" }),
        row("Q-03", { "Decision owner role": "LaDarius Taylor", "Issue / risk": "Settled", Status: "Approved", Reviewer: "Ivy Mitchell" }),
        row("Q-04", { "Decision owner role": "LaDarius Taylor", "Issue / risk": "Needs a review", Status: "Open", Reviewer: "Ivy Mitchell" }),
      ] },
    ],
  };
}

function row(id: string, values: Record<string, string>, archived = false): RecordRow {
  return { id, sourceRow: 1, values, revision: 0, archived };
}
