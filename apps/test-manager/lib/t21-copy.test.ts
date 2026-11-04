import assert from "node:assert/strict";
import { test } from "node:test";
import seed from "../data/workbook.json";

test("T-21 tells the tester how to change a grade and clear one completion", () => {
    const tests = seed.sections.find((section) => section.name === "Tests");
    const row = tests?.rows.find((item) => item.id === "T21");
    const values = row?.values as Record<string, string> | undefined;
    const procedure = values?.Procedure ?? "";
    const expected = values?.["Expected result"] ?? "";

    assert.match(procedure, /grade menu/);
    assert.match(procedure, /Clear completion/);
    assert.match(procedure, /dialog closes as soon as the clear starts/);
    assert.match(procedure, /A- and B\+/);
    assert.match(expected, /2\.5% to 5% and back to 2\.5%/);
    assert.doesNotMatch(expected, /stuck at zero/);
});
