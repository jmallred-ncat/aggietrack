import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { createPrisma } from "./prisma";
import { importBaseline, readWorkspace, saveRecord, setArchived } from "./database";

test("workbook import, execution history, live coverage, and persistence", async () => {
  const directory = mkdtempSync(join(tmpdir(), "test-manager-"));
  const url = `file:${join(directory, "isolated.db")}`;
  let db = createPrisma(url);
  try {
    // Apply the checked-in migration to an isolated file via the same Prisma adapter.
    for (const migration of readdirSync(resolve("prisma/migrations")).filter(name => !name.endsWith(".toml")).sort()) {
      for (const sql of readFileSync(resolve("prisma/migrations", migration, "migration.sql"), "utf8").split(";").filter(sql => sql.trim())) await db.$executeRawUnsafe(sql);
    }
    await importBaseline(db);
    await importBaseline(db);
    let workspace = await readWorkspace(db);
    assert.equal(workspace.sections.length, 7);
    const tests = workspace.sections.find(section => section.name === "Tests")!;
    assert.equal(tests.rows.length, 62);
    assert.equal(workspace.sections.find(section => section.name === "Course Catalog")!.rows.length, 202);
    assert(tests.rows.every(row => row.values.Status === "Not run"));
    const original = tests.rows.find(row => row.id === "T-01")!;
    assert.match(original.values["Test / scenario"], /Sign up/);
    assert.equal(workspace.sections.find(section => section.name === "Risks & Decisions")!.rows.find(row => row.id === "Q-01")!.values["Issue / risk"], "Sign-in rules do not match the requirement");
    await assert.rejects(saveRecord("Tests", "T01", { ...original.values, Status: "Pass" }, original.revision, db), /required/);
    const pass = { ...original.values, Status: "Pass", "Actual result": "Verified persistence and isolation", Tester: "Synthetic tester", "Run date": "2026-10-12", "Evidence reference": "isolated/run-1/T01", "Run / build / environment": "Local" };
    await saveRecord("Tests", "T01", pass, original.revision, db, { id: "verified-actor", email: "tester@example.test" });
    const executed = (await readWorkspace(db)).sections.find(section => section.name === "Tests")!.rows.find(row => row.id === "T-01")!;
    await assert.rejects(saveRecord("Tests", "T01", { ...executed.values, Assignee: "Stranger (stranger@example.test)" }, executed.revision, db, undefined, ["Known (known@example.test)"]), /team member/);
    await saveRecord("Tests", "T01", { ...executed.values, Assignee: "Known (known@example.test)" }, executed.revision, db, undefined, ["Known (known@example.test)"]);
    await assert.rejects(saveRecord("Tests", "T01", pass, original.revision, db), /changed/);
    await importBaseline(db);
    workspace = await readWorkspace(db);
    assert.equal(workspace.sections.find(section => section.name === "Tests")!.rows[0].values.Status, "Pass");
    assert.equal(workspace.sections.find(section => section.name === "Traceability")!.rows.find(row => row.id === "FR-01")!.values["Passed count"], "1");
    assert.equal(workspace.sections.find(section => section.name === "Tests")!.rows.find(row => row.id === "T-01")!.values.Assignee, "Known (known@example.test)");
    assert.equal(workspace.history.filter(row => row.recordId === "T-01").length, 3);
    const execution = workspace.history.find(row => row.recordId === "T-01" && row.actorId === "verified-actor");
    assert.equal(execution?.actorEmail, "tester@example.test");
    await saveRecord("Tests", "T63", { ...original.values, "Test ID": "T63", "Requirement IDs": "NFR-1", Status: "Not run" }, null, db);
    workspace = await readWorkspace(db);
    const nfr = workspace.sections.find(section => section.name === "Traceability")!.rows.find(row => row.id === "NFR-01")!;
    assert(nfr.values["Mapped test IDs"].includes("T-63"));
    const fr = workspace.sections.find(section => section.name === "Traceability")!.rows.find(row => row.id === "FR-01")!;
    assert(!fr.values["Mapped test IDs"].includes("T63"));
    await assert.rejects(saveRecord("Tests", "T64", { ...original.values, "Test ID": "T64", "Requirement IDs": "FR-99" }, null, db), /valid FR/);
    await assert.rejects(saveRecord("Tests", "T65", { ...original.values, "Test ID": "T65", "Defect ID": "D99" }, null, db), /does not exist/);
    await saveRecord("Tests", "t-66", { ...original.values, "Test ID": "T66", "Requirement IDs": "FR01; FR-8", "Defect ID": "D-1", Status: "Not run" }, null, db);
    const aliased = (await readWorkspace(db)).sections.find(section => section.name === "Tests")!.rows.find(row => row.id === "T-66")!;
    assert.equal(aliased.values["Test ID"], "T-66");
    assert.equal(aliased.values["Requirement IDs"], "FR-01, FR-08");
    assert.equal(aliased.values["Defect ID"], "D-01");
    assert((await readWorkspace(db)).sections.find(section => section.name === "Traceability")!.rows.find(row => row.id === "FR-01")!.values["Mapped test IDs"].includes("T-66"));
    const defect = workspace.sections.find(section => section.name === "Defects")!.rows[0];
    await assert.rejects(saveRecord("Defects", defect.id, { ...defect.values, Status: "Closed", "Retest result / evidence": "", "Regression / closure approval": "" }, defect.revision, db), /closure approval/);
    await assert.rejects(saveRecord("Defects", "D-02", { ...defect.values, "Defect ID": "D-02", "Test / requirement IDs": "T-63", "Found by": "Ivy Mitchell", Status: "Closed", "Regression / closure approval": "Jay Allred" }, null, db), /pass/);
    const course = workspace.sections.find(section => section.name === "Course Catalog")!.rows.find(row => row.id === "ACCT 201")!;
    await saveRecord("Course Catalog", course.id, { ...course.values, "Actual title": "Principles of Accounting" }, course.revision, db);
    assert.equal((await readWorkspace(db)).sections.find(section => section.name === "Course Catalog")!.rows.find(row => row.id === "ACCT 201")!.values["Actual title"], "Principles of Accounting");
    await assert.rejects(saveRecord("Course Catalog", "NEW 101", { ...course.values, "Course code": "NEW 101" }, null, db), /created/);
    const created = (await readWorkspace(db)).sections.find(section => section.name === "Tests")!.rows.find(row => row.id === "T-63")!;
    await setArchived("Tests", "T63", true, created.revision, db, { id: "verified-actor", email: "tester@example.test" });
    assert.equal((await readWorkspace(db)).sections.find(section => section.name === "Tests")!.rows.find(row => row.id === "T-63")!.archived, true);
    assert(!(await readWorkspace(db)).sections.find(section => section.name === "Traceability")!.rows.find(row => row.id === "NFR-01")!.values["Mapped test IDs"].includes("T-63"));
    const archived = (await readWorkspace(db)).sections.find(section => section.name === "Tests")!.rows.find(row => row.id === "T-63")!;
    await setArchived("Tests", "T63", false, archived.revision, db);
    assert((await readWorkspace(db)).sections.find(section => section.name === "Traceability")!.rows.find(row => row.id === "NFR-01")!.values["Mapped test IDs"].includes("T-63"));
    await db.importMetadata.delete({ where: { key: "id-format" } });
    await db.workbookRecord.update({ where: { section_id: { section: "Tests", id: "T-01" } }, data: { id: "T01" } });
    assert.equal((await readWorkspace(db)).sections.find(section => section.name === "Tests")!.rows.find(row => row.id === "T-01")!.values.Status, "Pass");
    await db.$disconnect();
    db = createPrisma(url);
    assert.equal((await readWorkspace(db)).sections.find(section => section.name === "Tests")!.rows[0].values.Status, "Pass");
  } finally { await db.$disconnect(); rmSync(directory, { recursive: true, force: true }); }
});

