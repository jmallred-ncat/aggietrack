import assert from "node:assert/strict";
import { test } from "node:test";
import { explain } from "./guide";

test("jargon fields have a plain explanation and everyday labels stay quiet", () => {
  assert.match(explain("Tests", "Environment")?.plain ?? "", /Preview/);
  assert.match(explain("Tests", "Status")?.plain ?? "", /Not run/);
  assert.match(explain("Defects", "Status")?.plain ?? "", /Closed/);
  assert.match(explain("Risks & Decisions", "Status")?.plain ?? "", /Deferred/);
  assert.equal(explain("Tests", "Summary"), undefined);
  assert.equal(explain("Tests", "Assignee"), undefined);
  assert.equal(explain("Course Catalog", "Credits"), undefined);
  assert.match(explain("Data", "Independent oracle / rule")?.plain ?? "", /answer key/);
});
