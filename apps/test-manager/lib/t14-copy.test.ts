import assert from "node:assert/strict";
import { test } from "node:test";
import seed from "../data/workbook.json";

function testRow(id: string) {
  const tests = seed.sections.find((section) => section.name === "Tests");
  const row = tests?.rows.find((item) => item.id === id);
  return row?.values as Record<string, string> | undefined;
}

test("T-14 says a lab saved alone is refused with its lecture", () => {
  const t14 = testRow("T14");
  assert.ok(t14);
  assert.match(t14["Expected result"], /The pair in the same term is allowed/);
  assert.match(t14["Expected result"], /companion in another term, is rejected/);
  assert.match(t14["Expected result"], /Saving the lab alone is refused/);
  assert.match(t14["Expected result"], /CST 122 must be taken with CST 112/);
  assert.doesNotMatch(t14["Expected result"], /does not enforce the pair/);
  assert.doesNotMatch(t14["Expected result"], /lets you add the lab alone/);
});
