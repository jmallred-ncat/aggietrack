import assert from "node:assert/strict";
import { test } from "node:test";
import seed from "../data/workbook.json";

function testRow(id: string) {
  const tests = seed.sections.find((section) => section.name === "Tests");
  const row = tests?.rows.find((item) => item.id === id);
  return row?.values as Record<string, string> | undefined;
}

test("T-25, T-32, T-37, and T-61 tell the tester how to fail or delay a save", () => {
  const t25 = testRow("T25");
  const t32 = testRow("T32");
  const t37 = testRow("T37");
  const t61 = testRow("T61");
  assert.ok(t25 && t32 && t37 && t61);

  assert.match(t25.Procedure, /Next save fails/);
  assert.match(t25.Procedure, /Next save waits 16 seconds/);
  assert.match(t25["Expected result"], /Couldn't save, try again/);
  assert.match(t25["Expected result"], /matches what was actually saved/);

  assert.match(t32.Procedure, /Next save works/);
  assert.match(t32["Expected result"], /within 15 seconds/);

  assert.match(t37.Procedure, /Next save waits 16 seconds/);
  assert.match(t37.Procedure, /Next save fails/);
  assert.match(t37.Procedure, /Couldn't save, try again/);

  assert.match(t61.Procedure, /Next save fails/);
  assert.match(t61.Procedure, /CST 112 with CST 122/);
  assert.match(t61["Expected result"], /lecture row is not left behind/);
  assert.match(t61["Expected result"], /Couldn't save, try again/);
});
