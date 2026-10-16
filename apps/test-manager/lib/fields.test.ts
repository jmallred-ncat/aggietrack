import assert from "node:assert/strict";
import { test } from "node:test";
import { environmentValue, joinItems, joinOwners, joinPair, joinSteps, parseItems, parseOwners, parseSteps, presentDefectPeople, splitPair } from "./fields";

test("numbered steps and semicolon items keep their stored shape", () => {
  const steps = "1. Register from the public page.\n2. Follow /enter to /onboarding; select Information Technology 2025.";
  assert.deepEqual(parseSteps(steps), ["Register from the public page.", "Follow /enter to /onboarding; select Information Technology 2025."]);
  assert.equal(joinSteps(parseSteps(steps)), steps);
  const items = "program INFO 0432, catalog 2025; CST 130 (3 credits)";
  assert.deepEqual(parseItems(items), ["program INFO 0432, catalog 2025", "CST 130 (3 credits)"]);
  assert.equal(joinItems(parseItems(items)), items);
});

test("owners normalize spelling and environment values stay in the closed set", () => {
  assert.deepEqual(parseOwners("Melonie Evans / Ivy Mitchell"), ["Mellonie Evans", "Ivy Mitchell"]);
  assert.equal(joinOwners(parseOwners("Jay Allred")), "Jay Allred");
  assert.equal(environmentValue("preview"), "Preview");
  assert.equal(environmentValue("Local"), "Local");
  assert.equal(environmentValue("run-1 / build-abc / local"), "run-1 / build-abc / local");
});

test("compound reviewer and retest values split into a name and a date", () => {
  assert.deepEqual(splitPair("Ivy Mitchell / 2026-10-12"), { left: "Ivy Mitchell", right: "2026-10-12" });
  assert.deepEqual(splitPair("Leave blank for Jay"), { left: "", right: "" });
  assert.equal(joinPair("Ivy Mitchell", "2026-10-12"), "Ivy Mitchell / 2026-10-12");
  assert.equal(joinPair("", ""), "");
});

test("a defect creator moves into found by and the assignee stays empty", () => {
  assert.deepEqual(presentDefectPeople({ Owner: "Ivy Mitchell", "Found by": "" }), { Owner: "", "Found by": "Ivy Mitchell" });
  assert.deepEqual(presentDefectPeople({ Owner: "Ivy Mitchell", "Found by": "James Allred" }), { Owner: "Ivy Mitchell", "Found by": "James Allred" });
  assert.deepEqual(presentDefectPeople({ Owner: "", "Found by": "" }), { Owner: "", "Found by": "" });
});
