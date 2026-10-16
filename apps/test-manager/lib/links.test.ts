import assert from "node:assert/strict";
import { test } from "node:test";
import { idForms, normalizeId, parseLinks } from "./links";

test("record ids use one form for each family", () => {
  for (const value of ["FR-1", "FR-01", "FR1", "FR01", "fr-1"]) assert.equal(normalizeId(value), "FR-01");
  for (const value of ["NFR-11", "NFR11", "nfr-011"]) assert.equal(normalizeId(value), "NFR-11");
  for (const value of ["D1", "D-1", "D01", "D-01", "d1"]) assert.equal(normalizeId(value), "D-01");
  for (const value of ["T1", "T-01", "T01"]) assert.equal(normalizeId(value), "T-01");
  assert.equal(normalizeId("T10"), "T-10");
  assert.equal(normalizeId("FR-10"), "FR-10");
  assert.equal(normalizeId("Q1"), "Q-01");
  assert.equal(normalizeId("G-12"), "G-12");
  assert.equal(normalizeId("R-1"), "R-01");
  assert.equal(normalizeId("ACCT 201"), "ACCT 201");
  assert.equal(normalizeId("Project title"), "Project title");
});

test("link text and ranges collapse to the canonical ids", () => {
  assert.deepEqual(parseLinks("|FR-1||FR-8|"), ["FR-01", "FR-08"]);
  assert.deepEqual(parseLinks("FR01; FR-8"), ["FR-01", "FR-08"]);
  assert.deepEqual(parseLinks("D-1, d01"), ["D-01"]);
  assert.deepEqual(parseLinks("T1-T3"), ["T-01", "T-02", "T-03"]);
  assert.deepEqual(parseLinks("T-01-T-03"), ["T-01", "T-02", "T-03"]);
  assert.deepEqual(parseLinks("T01-T05"), ["T-01", "T-02", "T-03", "T-04", "T-05"]);
  assert.deepEqual(parseLinks("FR-1-FR-3"), ["FR-01", "FR-02", "FR-03"]);
  assert.deepEqual(parseLinks("T31; T32 load repeat; T38"), ["T-31", "T-32", "load", "repeat", "T-38"]);
  assert.match(idForms("FR-1"), /FR01/);
  assert.match(idForms("D01"), /D-1/);
});
