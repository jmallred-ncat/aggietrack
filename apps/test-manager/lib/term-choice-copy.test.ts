import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import seed from "../data/workbook.json";
import { importBaseline, readWorkspace } from "./database";
import { normalizeId } from "./links";
import { createPrisma } from "./prisma";

const previousFullCopy = "human-2026-11-06-in-progress";

function seededProcedure(id: string) {
  const tests = seed.sections.find((section) => section.name === "Tests");
  const row = tests?.rows.find((item) => normalizeId(item.id) === id);
  return (row?.values as Record<string, string>).Procedure;
}

async function openDatabase() {
  const directory = mkdtempSync(join(tmpdir(), "term-choice-copy-"));
  const db = createPrisma(`file:${join(directory, "isolated.db")}`);
  for (const migration of readdirSync(resolve("prisma/migrations")).filter((name) => !name.endsWith(".toml")).sort()) {
    for (const sql of readFileSync(resolve("prisma/migrations", migration, "migration.sql"), "utf8").split(";").filter((statement) => statement.trim())) {
      await db.$executeRawUnsafe(sql);
    }
  }
  return { directory, db };
}

function valuesOf(workspace: Awaited<ReturnType<typeof readWorkspace>>, section: string, id: string) {
  const row = workspace.sections.find((item) => item.name === section)?.rows.find((item) => item.id === id);
  assert.ok(row);
  return row;
}

test("the term-choice revision updates only the three procedures", async () => {
  const { directory, db } = await openDatabase();
  try {
    await importBaseline(db);
    await db.importMetadata.update({ where: { key: "copy-revision" }, data: { value: previousFullCopy } });

    const t01 = await db.workbookRecord.findUniqueOrThrow({ where: { section_id: { section: "Tests", id: "T-01" } } });
    const t01values = {
      ...(t01.values as Record<string, string>),
      Procedure: "1. Choose **Plan the next term**.\n2. Choose **Spring 2027**.",
      "Expected result": "User kept the T-01 expected result.",
      Status: "Pass",
      "Actual result": "Tester kept this result",
      Tester: "Avery Tester",
      "Run date": "2026-11-01",
      "Evidence reference": "notes/t01",
      "Run / build / environment": "Preview build 9",
      Assignee: "Known (known@example.test)",
    };
    await db.workbookRecord.update({ where: { section_id: { section: "Tests", id: "T-01" } }, data: { values: t01values, revision: 4 } });

    const t56 = await db.workbookRecord.findUniqueOrThrow({ where: { section_id: { section: "Tests", id: "T-56" } } });
    const t56values = { ...(t56.values as Record<string, string>), Procedure: "Choose **Plan Fall 2026**.", Status: "Blocked", Tester: "Casey", "Actual result": "Waiting on the clock" };
    await db.workbookRecord.update({ where: { section_id: { section: "Tests", id: "T-56" } }, data: { values: t56values, revision: 2 } });

    const t79 = await db.workbookRecord.findUniqueOrThrow({ where: { section_id: { section: "Tests", id: "T-79" } } });
    const t79values = { ...(t79.values as Record<string, string>), Procedure: "Choose **Plan the next term**.", Status: "Fail", "Run date": "2026-10-30", Assignee: "Jordan (jordan@example.test)" };
    await db.workbookRecord.update({ where: { section_id: { section: "Tests", id: "T-79" } }, data: { values: t79values, revision: 3 } });

    const t02 = await db.workbookRecord.findUniqueOrThrow({ where: { section_id: { section: "Tests", id: "T-02" } } });
    const t02values = { ...(t02.values as Record<string, string>), Procedure: "User wrote this T-02 procedure.", "Expected result": "User wrote this T-02 result.", Status: "Blocked", Tester: "Casey" };
    await db.workbookRecord.update({ where: { section_id: { section: "Tests", id: "T-02" } }, data: { values: t02values, revision: 5 } });

    const defect = await db.workbookRecord.findUniqueOrThrow({ where: { section_id: { section: "Defects", id: "D-01" } } });
    const defectValues = {
      ...(defect.values as Record<string, string>),
      Summary: "User summary stays.",
      "Steps and inputs": "User repro: open the old dialog.",
      "Expected result": "User expected the card to contain the footer.",
      "Actual result": "User saw the footer overflow.",
      Status: "Open",
    };
    await db.workbookRecord.update({ where: { section_id: { section: "Defects", id: "D-01" } }, data: { values: defectValues, revision: 6 } });

    await db.recordHistory.create({
      data: {
        section: "Tests",
        recordId: "T-01",
        savedAt: "2026-11-01T00:00:00.000Z",
        values: t01values,
        actorId: "actor-1",
        actorEmail: "tester@example.test",
      },
    });

    const workspace = await readWorkspace(db);
    const nextT01 = valuesOf(workspace, "Tests", "T-01");
    assert.equal(nextT01.values.Procedure, seededProcedure("T-01"));
    assert.equal((nextT01.values.Procedure.match(/choose \*\*Spring 2027\*\*/g) ?? []).length, 1);
    assert.doesNotMatch(nextT01.values.Procedure, /Plan the next term/);
    assert.equal(nextT01.values["Expected result"], "User kept the T-01 expected result.");
    assert.equal(nextT01.values.Status, "Pass");
    assert.equal(nextT01.values["Actual result"], "Tester kept this result");
    assert.equal(nextT01.values.Tester, "Avery Tester");
    assert.equal(nextT01.values["Run date"], "2026-11-01");
    assert.equal(nextT01.values["Evidence reference"], "notes/t01");
    assert.equal(nextT01.values["Run / build / environment"], "Preview build 9");
    assert.equal(nextT01.values.Assignee, "Known (known@example.test)");
    assert.equal(nextT01.revision, 4);

    const nextT56 = valuesOf(workspace, "Tests", "T-56");
    assert.equal(nextT56.values.Procedure, seededProcedure("T-56"));
    assert.match(nextT56.values.Procedure, /choose \*\*Fall 2026\*\*/);
    assert.match(nextT56.values.Procedure, /choose \*\*Spring 2027\*\*/);
    assert.match(nextT56.values.Procedure, /Summer 2026, Summer I 2026, Summer II 2026, and Fall 2026/);
    assert.equal(nextT56.values.Status, "Blocked");
    assert.equal(nextT56.values.Tester, "Casey");
    assert.equal(nextT56.values["Actual result"], "Waiting on the clock");
    assert.equal(nextT56.revision, 2);

    const nextT79 = valuesOf(workspace, "Tests", "T-79");
    assert.equal(nextT79.values.Procedure, seededProcedure("T-79"));
    assert.match(nextT79.values.Procedure, /choose \*\*Spring 2027\*\*/);
    assert.match(nextT79.values.Procedure, /choose \*\*Fall 2026\*\*/);
    assert.equal(nextT79.values.Status, "Fail");
    assert.equal(nextT79.values["Run date"], "2026-10-30");
    assert.equal(nextT79.values.Assignee, "Jordan (jordan@example.test)");
    assert.equal(nextT79.revision, 3);

    const nextT02 = valuesOf(workspace, "Tests", "T-02");
    assert.equal(nextT02.values.Procedure, "User wrote this T-02 procedure.");
    assert.equal(nextT02.values["Expected result"], "User wrote this T-02 result.");
    assert.equal(nextT02.values.Status, "Blocked");
    assert.equal(nextT02.values.Tester, "Casey");
    assert.equal(nextT02.revision, 5);

    const nextDefect = valuesOf(workspace, "Defects", "D-01");
    assert.equal(nextDefect.values.Summary, "User summary stays.");
    assert.equal(nextDefect.values["Steps and inputs"], "User repro: open the old dialog.");
    assert.equal(nextDefect.values["Expected result"], "User expected the card to contain the footer.");
    assert.equal(nextDefect.values["Actual result"], "User saw the footer overflow.");
    assert.equal(nextDefect.values.Status, "Open");
    assert.equal(nextDefect.revision, 6);

    assert.equal(workspace.history.length, 1);
    assert.equal(workspace.history[0]?.recordId, "T-01");
    assert.equal(workspace.history[0]?.actorEmail, "tester@example.test");
    assert.equal((workspace.history[0]?.values as Record<string, string>)["Actual result"], "Tester kept this result");
    assert.equal((await db.importMetadata.findUniqueOrThrow({ where: { key: "copy-revision" } })).value, "human-2026-11-07-term-choice");

    const again = await readWorkspace(db);
    assert.equal(valuesOf(again, "Tests", "T-02").values.Procedure, "User wrote this T-02 procedure.");
    assert.equal(valuesOf(again, "Defects", "D-01").values["Actual result"], "User saw the footer overflow.");
    assert.equal(again.history.length, 1);
  } finally {
    await db.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("a fresh workbook already contains the term-choice procedures", async () => {
  const { directory, db } = await openDatabase();
  try {
    await importBaseline(db);
    const workspace = await readWorkspace(db);
    assert.equal(valuesOf(workspace, "Tests", "T-01").values.Procedure, seededProcedure("T-01"));
    assert.equal((seededProcedure("T-01").match(/choose \*\*Spring 2027\*\*/g) ?? []).length, 1);
    assert.equal(valuesOf(workspace, "Tests", "T-56").values.Procedure, seededProcedure("T-56"));
    assert.equal(valuesOf(workspace, "Tests", "T-79").values.Procedure, seededProcedure("T-79"));

    const t02 = valuesOf(workspace, "Tests", "T-02");
    const defect = valuesOf(workspace, "Defects", "D-01");
    await db.workbookRecord.update({
      where: { section_id: { section: "Tests", id: "T-02" } },
      data: { values: { ...t02.values, Procedure: "Fresh user procedure.", "Expected result": "Fresh user result." } },
    });
    await db.workbookRecord.update({
      where: { section_id: { section: "Defects", id: "D-01" } },
      data: { values: { ...defect.values, "Steps and inputs": "Fresh user repro.", "Actual result": "Fresh user actual." } },
    });

    const again = await readWorkspace(db);
    assert.equal(valuesOf(again, "Tests", "T-02").values.Procedure, "Fresh user procedure.");
    assert.equal(valuesOf(again, "Tests", "T-02").values["Expected result"], "Fresh user result.");
    assert.equal(valuesOf(again, "Defects", "D-01").values["Steps and inputs"], "Fresh user repro.");
    assert.equal(valuesOf(again, "Defects", "D-01").values["Actual result"], "Fresh user actual.");
    assert.equal(valuesOf(again, "Tests", "T-01").values.Procedure, seededProcedure("T-01"));
  } finally {
    await db.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
});
