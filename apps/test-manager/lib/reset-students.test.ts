import assert from "node:assert/strict";
import { test } from "node:test";
import { resetAllSummary, resetTestAccounts, type ResetTarget } from "./reset-students";

const students: ResetTarget[] = [
  { email: "it.start@example.test", name: "Avery Cole" },
  { email: "it.mid@example.test", name: "Jordan Hale" },
  { email: "it.late@example.test", name: "Riley Brooks" },
  { email: "it.retake-f-to-pass@example.test", name: "Taylor Morgan" },
  { email: "it.retake-c-to-a@example.test", name: "Casey Parker" },
  { email: "it.diverse-grades@example.test", name: "Alex Rivera" },
  { email: "it.over-credits@example.test", name: "Morgan Lee" },
];

test("reset all keeps going when one student fails and names that student", async () => {
  const calls: string[] = [];
  const frozen = new Set<string>();
  async function resetOne(email: string) {
    calls.push(email);
    if (email === "it.over-credits@example.test" && frozen.has(email)) throw new Error("Unique constraint failed");
    frozen.add(email);
  }

  const first = await resetTestAccounts(students, resetOne);
  assert.equal(first.failed.length, 0);
  assert.equal(first.succeeded.length, 7);
  assert.equal(resetAllSummary(first), "Reset 7 of 7 students");

  const second = await resetTestAccounts(students, async email => {
    calls.push(email);
    if (email === "it.over-credits@example.test") throw new Error("Unique constraint failed");
  });
  assert.equal(second.succeeded.length, 6);
  assert.deepEqual(second.failed.map(student => student.name), ["Morgan Lee"]);
  assert.equal(resetAllSummary(second), "Reset 6 of 7 students. Failed: Morgan Lee");
  assert.equal(calls.length, 14);
});

test("reset all succeeds on the second pass when reset replaces frozen data", async () => {
  const store = new Map<string, number>();
  async function resetOne(email: string) {
    store.set(email, (store.get(email) ?? 0) + 1);
  }
  const first = await resetTestAccounts(students, resetOne);
  const second = await resetTestAccounts(students, resetOne);
  assert.equal(resetAllSummary(first), "Reset 7 of 7 students");
  assert.equal(resetAllSummary(second), "Reset 7 of 7 students");
  assert.deepEqual([...store.values()], [2, 2, 2, 2, 2, 2, 2]);
});
