import assert from "node:assert/strict";
import { test } from "node:test";
import seed from "../data/workbook.json";

function testRow(id: string) {
  const tests = seed.sections.find((section) => section.name === "Tests");
  const row = tests?.rows.find((item) => item.id === id);
  return row?.values as Record<string, string> | undefined;
}

test("T-33 and T-34 describe the 30 minute idle sign-out", () => {
  const t33 = testRow("T33");
  const t34 = testRow("T34");
  assert.ok(t33 && t34);

  assert.match(t33.Procedure, /28 minutes/);
  assert.match(t33.Procedure, /Dismissing it does not start the 30 minutes over/);
  assert.match(t33.Procedure, /background refresh does not count/);
  assert.match(t33["Expected result"], /signed out after 30 minutes with no activity/);
  assert.match(t33["Pass criterion"], /sign-in page/);

  assert.match(t34.Procedure, /minute 20/);
  assert.match(t34.Procedure, /minute 35/);
  assert.match(t34.Procedure, /50 minutes 1 second/);
  assert.match(t34.Procedure, /background refresh does not/);
  assert.match(t34["Expected result"], /starts the 30 minutes over/);
  assert.match(t34["Expected result"], /signed out after 30 minutes with no activity/);
  assert.match(t34["Pass criterion"], /2 minutes before/);
});
