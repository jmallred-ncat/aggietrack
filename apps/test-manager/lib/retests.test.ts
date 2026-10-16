import assert from "node:assert/strict";
import { test } from "node:test";
import { applyRetestFields, retestTests } from "./retests";
import type { Values } from "./model";

function row(id: string, values: Values, archived = false) {
  return { id, archived, values };
}

test("retests come from tests linked in either direction", () => {
  const tests = [
    row("T-01", { Status: "Not run", "Test / scenario": "Sign in", "Defect ID": "" }),
    row("T-02", { Status: "Pass", "Run date": "2026-10-12", "Evidence reference": "run-2", "Defect ID": "D-01", "Test / scenario": "Reset" }),
    row("T-03", { Status: "Fail", "Defect ID": "D-09", "Test / scenario": "Other" }),
    row("T-04", { Status: "Pass", "Defect ID": "D-01", "Test / scenario": "Hidden" }, true),
  ];
  const linked = retestTests(tests, "D-01", "T01, FR-01");
  assert.deepEqual(linked.map(item => item.id), ["T-01", "T-02"]);
  const defect: Values = { "Test / requirement IDs": "T01, FR-01" };
  const passed = applyRetestFields(defect, "D-01", tests);
  assert.equal(passed, true);
  assert.equal(defect["Retest ID"], "T-01, T-02");
  assert.equal(defect["Retest date"], "2026-10-12");
  assert.match(defect["Retest result / evidence"], /T-02 Pass on 2026-10-12/);
  assert.doesNotMatch(defect["Retest result / evidence"], /T-01/);
});
