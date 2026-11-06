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
  assert.match(t14["Expected result"], /lecture can be saved alone/);
  assert.match(t14["Expected result"], /companion in another term is rejected/);
  assert.match(t14["Expected result"], /Saving the lab alone is refused/);
  assert.match(t14["Expected result"], /CST 122 must be taken with CST 112/);
  assert.match(t14["Expected result"], /no override note/);
  assert.match(t14["Expected result"], /Requires course override/);
  assert.doesNotMatch(t14["Expected result"], /does not enforce the pair/);
  assert.doesNotMatch(t14["Expected result"], /lets you add the lab alone/);
});

test("T-24 and G-02 say the missing pair is enforced", () => {
  const t24 = testRow("T24");
  assert.ok(t24);
  assert.match(t24["Expected result"], /Saving the lab alone is refused/);
  assert.match(t24["Expected result"], /Gap G-02 is resolved/);
  assert.doesNotMatch(t24["Expected result"], /known gap G-02/);

  const risks = seed.sections.find((section) => section.name === "Risks & Decisions");
  const gap = risks?.rows.find((item) => item.id === "G02");
  const values = gap?.values as Record<string, string> | undefined;
  assert.equal(values?.Status, "Approved");
  assert.match(values?.["Approved decision / evidence"] ?? "", /Catalog text is the requirement/);
  assert.doesNotMatch(values?.["Issue / risk"] ?? "", /are not enforced/);
});
