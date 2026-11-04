import assert from "node:assert/strict";
import { test } from "node:test";
import seed from "../data/workbook.json";

function testRow(id: string) {
  const tests = seed.sections.find((section) => section.name === "Tests");
  const row = tests?.rows.find((item) => item.id === id);
  return row?.values as Record<string, string> | undefined;
}

test("T-11, T-15, T-41, and T-55 describe the plan-rule recheck", () => {
  const t11 = testRow("T11");
  const t15 = testRow("T15");
  const t41 = testRow("T41");
  const t55 = testRow("T55");
  assert.ok(t11 && t15 && t41 && t55);

  assert.match(t11.Procedure, /Remove CST 120 from Fall/);
  assert.match(t11["Expected result"], /CST 112 still needs CST 120 or MATH 110/);
  assert.match(t11["Expected result"], /Submit and approval/);
  assert.doesNotMatch(t11["Expected result"], /does not recheck/);

  assert.match(t15.Procedure, /Remove CST 112 and leave CST 122/);
  assert.match(t15["Expected result"], /CST 122 must be taken with CST 112/);
  assert.match(t15["Expected result"], /Removing the lab and leaving the lecture is allowed/);
  assert.doesNotMatch(t15["Expected result"], /submission does not check the pair/);

  assert.match(t41["Expected result"], /second tab is rejected/);
  assert.doesNotMatch(t41["Expected result"], /checked before the write transaction/);

  assert.match(t55.Procedure, /second tab/);
  assert.match(t55["Expected result"], /draft check runs inside the save/);
});
