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
    assert.equal(tests.rows.length, 86);
    assert.match(tests.rows.find(row => row.id === "T-90")!.values.Procedure, /Book this session\?/);
    const meeting = tests.rows.find(row => row.id === "T-90")!;
    await db.workbookRecord.update({
        where: { section_id: { section: "Tests", id: "T-90" } },
        data: { values: { ...meeting.values, Procedure: "Edited procedure stays." } },
    });
    const kept = (await readWorkspace(db)).sections.find(section => section.name === "Tests")!.rows.find(row => row.id === "T-90")!;
    assert.equal(kept.values.Procedure, "Edited procedure stays.");
    assert.equal(workspace.sections.find(section => section.name === "Course Catalog")!.rows.length, 202);
    const alreadyPassed = new Set(["T-63", "T-64", "T-65", "T-66", "T-67", "T-69", "T-70", "T-71", "T-72"]);
    assert(tests.rows.every(row => (alreadyPassed.has(row.id) ? row.values.Status === "Pass" : row.values.Status === "Not run")));
    const original = tests.rows.find(row => row.id === "T-01")!;
    assert.match(tests.rows.find(row => row.id === "T-74")!.values.Procedure, /Approve plan/);
    assert.match(original.values["Test / scenario"], /Sign up/);
    assert.equal(workspace.sections.find(section => section.name === "Risks & Decisions")!.rows.find(row => row.id === "Q-01")!.values["Issue / risk"], "Sign-in rules do not match the requirement");
    const q12 = workspace.sections.find(section => section.name === "Risks & Decisions")!.rows.find(row => row.id === "Q-12")!;
    assert.equal(q12.values["Affected tests"], "T-31, T-32, T-38");
    assert.equal(q12.values["Affected requirements"], "NFR-02, NFR-09");
    assert.equal(q12.values["Issue / risk"], "Whether 500 people at once is realistic");
    await saveRecord("Risks & Decisions", "Q-12", { ...q12.values, "Affected tests": "T31; T32 load repeat; T38", "Approved decision / evidence": "Mellonie approved the 500-person target." }, q12.revision, db);
    const savedQ12 = (await readWorkspace(db)).sections.find(section => section.name === "Risks & Decisions")!.rows.find(row => row.id === "Q-12")!;
    assert.equal(savedQ12.values["Affected tests"], "T-31, T-32, T-38");
    assert.equal(savedQ12.values["Approved decision / evidence"], "Mellonie approved the 500-person target.");
    assert.equal(savedQ12.values["Issue / risk"], "Whether 500 people at once is realistic");
    await assert.rejects(saveRecord("Risks & Decisions", "Q-12", { ...savedQ12.values, "Affected tests": "T-31, T-99, load" }, savedQ12.revision, db), /Affected tests: T-99 does not exist/);
    const teammate = { ...savedQ12.values, "Affected tests": "T-31, load, T-32, repeat, T-40", Status: "Approved", "Approved decision / evidence": "Keep the teammate note." };
    await db.workbookRecord.update({ where: { section_id: { section: "Risks & Decisions", id: "Q-12" } }, data: { values: teammate } });
    await db.importMetadata.delete({ where: { key: "link-repair" } });
    const repaired = (await readWorkspace(db)).sections.find(section => section.name === "Risks & Decisions")!.rows.find(row => row.id === "Q-12")!;
    assert.equal(repaired.values["Affected tests"], "T-31, T-32, T-40");
    assert.equal(repaired.values.Status, "Approved");
    assert.equal(repaired.values["Approved decision / evidence"], "Keep the teammate note.");
    assert.equal(repaired.values["Issue / risk"], "Whether 500 people at once is realistic");
    assert.equal(repaired.revision, savedQ12.revision);
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
    await saveRecord("Tests", "T80", { ...original.values, "Test ID": "T80", "Requirement IDs": "NFR-1", Status: "Not run" }, null, db);
    workspace = await readWorkspace(db);
    const nfr = workspace.sections.find(section => section.name === "Traceability")!.rows.find(row => row.id === "NFR-01")!;
    assert(nfr.values["Mapped test IDs"].includes("T-80"));
    const fr = workspace.sections.find(section => section.name === "Traceability")!.rows.find(row => row.id === "FR-01")!;
    assert(!fr.values["Mapped test IDs"].includes("T80"));
    await assert.rejects(saveRecord("Tests", "T81", { ...original.values, "Test ID": "T81", "Requirement IDs": "FR-99" }, null, db), /valid FR/);
    await assert.rejects(saveRecord("Tests", "T82", { ...original.values, "Test ID": "T82", "Defect ID": "D99" }, null, db), /does not exist/);
    await saveRecord("Tests", "t-83", { ...original.values, "Test ID": "T83", "Requirement IDs": "FR01; FR-8", "Defect ID": "D-1", Status: "Not run" }, null, db);
    const aliased = (await readWorkspace(db)).sections.find(section => section.name === "Tests")!.rows.find(row => row.id === "T-83")!;
    assert.equal(aliased.values["Test ID"], "T-83");
    assert.equal(aliased.values["Requirement IDs"], "FR-01, FR-08");
    assert.equal(aliased.values["Defect ID"], "D-01");
    assert((await readWorkspace(db)).sections.find(section => section.name === "Traceability")!.rows.find(row => row.id === "FR-01")!.values["Mapped test IDs"].includes("T-83"));
    const defect = workspace.sections.find(section => section.name === "Defects")!.rows[0];
    await assert.rejects(saveRecord("Defects", defect.id, { ...defect.values, Status: "Closed", "Retest result / evidence": "", "Regression / closure approval": "" }, defect.revision, db), /closure approval/);
    await assert.rejects(saveRecord("Defects", "D-02", { ...defect.values, "Defect ID": "D-02", "Test / requirement IDs": "T-80", "Found by": "Ivy Mitchell", Status: "Closed", "Regression / closure approval": "Jay Allred" }, null, db), /pass/);
    const course = workspace.sections.find(section => section.name === "Course Catalog")!.rows.find(row => row.id === "ACCT 201")!;
    await saveRecord("Course Catalog", course.id, { ...course.values, "Actual title": "Principles of Accounting" }, course.revision, db);
    assert.equal((await readWorkspace(db)).sections.find(section => section.name === "Course Catalog")!.rows.find(row => row.id === "ACCT 201")!.values["Actual title"], "Principles of Accounting");
    await assert.rejects(saveRecord("Course Catalog", "NEW 101", { ...course.values, "Course code": "NEW 101" }, null, db), /created/);
    const created = (await readWorkspace(db)).sections.find(section => section.name === "Tests")!.rows.find(row => row.id === "T-80")!;
    await setArchived("Tests", "T80", true, created.revision, db, { id: "verified-actor", email: "tester@example.test" });
    assert.equal((await readWorkspace(db)).sections.find(section => section.name === "Tests")!.rows.find(row => row.id === "T-80")!.archived, true);
    assert(!(await readWorkspace(db)).sections.find(section => section.name === "Traceability")!.rows.find(row => row.id === "NFR-01")!.values["Mapped test IDs"].includes("T-80"));
    const archived = (await readWorkspace(db)).sections.find(section => section.name === "Tests")!.rows.find(row => row.id === "T-80")!;
    await setArchived("Tests", "T80", false, archived.revision, db);
    assert((await readWorkspace(db)).sections.find(section => section.name === "Traceability")!.rows.find(row => row.id === "NFR-01")!.values["Mapped test IDs"].includes("T-80"));
    await db.importMetadata.delete({ where: { key: "id-format" } });
    await db.workbookRecord.update({ where: { section_id: { section: "Tests", id: "T-01" } }, data: { id: "T01" } });
    assert.equal((await readWorkspace(db)).sections.find(section => section.name === "Tests")!.rows.find(row => row.id === "T-01")!.values.Status, "Pass");
    await db.$disconnect();
    db = createPrisma(url);
    assert.equal((await readWorkspace(db)).sections.find(section => section.name === "Tests")!.rows[0].values.Status, "Pass");
  } finally { await db.$disconnect(); rmSync(directory, { recursive: true, force: true }); }
});

