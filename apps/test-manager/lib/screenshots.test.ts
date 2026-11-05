import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createPrisma } from "./prisma";
import { importBaseline, saveRecord } from "./database";
import { attachExecutionScreenshots, checkScreenshot, openScreenshot, prepareScreenshotUpload, registerScreenshot, ScreenshotError, type BlobReader } from "./screenshots";
import { formExecutionShots, imageKind, ownsScreenshotPath, savedExecutionShots, screenshotPathname, type ScreenshotView } from "./screenshot-rules";

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const webp = Buffer.alloc(16);
webp.write("RIFF", 0);
webp.write("WEBP", 8);
const gif = Buffer.from("GIF89a", "ascii");

function memoryStore(files: Map<string, { bytes: Buffer; contentType: string }>): BlobReader & { removed: string[] } {
  const removed: string[] = [];
  return {
    removed,
    async stat(pathname) {
      const file = files.get(pathname);
      return file ? { size: file.bytes.length, contentType: file.contentType } : null;
    },
    async read(pathname) {
      return files.get(pathname)?.bytes ?? null;
    },
    async remove(pathname) {
      removed.push(pathname);
      files.delete(pathname);
    },
  };
}

async function applyMigrations(db: ReturnType<typeof createPrisma>) {
  for (const migration of readdirSync(resolve("prisma/migrations")).filter(name => !name.endsWith(".toml")).sort()) {
    for (const sql of readFileSync(resolve("prisma/migrations", migration, "migration.sql"), "utf8").split(";").filter(statement => statement.trim())) await db.$executeRawUnsafe(sql);
  }
}

test("screenshot rules accept png, jpeg, and webp and keep paths inside the test", () => {
  assert.equal(imageKind(png), "PNG");
  assert.equal(imageKind(jpeg), "JPEG");
  assert.equal(imageKind(webp), "WebP");
  assert.equal(imageKind(gif), null);
  assert.equal(screenshotPathname("T-01", "../notes.png"), "executions/T-01/notes.png");
  assert.equal(ownsScreenshotPath("executions/T-01/notes.png", "T-01"), true);
  assert.equal(ownsScreenshotPath("executions/T-01/../test-manager.db", "T-01"), false);
  assert.equal(ownsScreenshotPath("executions/T-01/..", "T-01"), false);
  assert.equal(ownsScreenshotPath("test-manager.db", "T-01"), false);
  const saved: ScreenshotView[] = [
    { id: "a", testId: "T-01", historySequence: 4, fileName: "one.png", kind: "PNG" },
    { id: "b", testId: "T-01", historySequence: null, fileName: "two.jpg", kind: "JPEG" },
    { id: "c", testId: "T-02", historySequence: 9, fileName: "other.png", kind: "PNG" },
  ];
  assert.deepEqual(savedExecutionShots(saved, "T-01").map(shot => shot.id), ["a"]);
  assert.deepEqual(formExecutionShots(saved, "T-01").map(shot => shot.id), ["a", "b"]);
});

test("execution screenshots stay private to the test and attach to history", async () => {
  const previous = process.env.BLOB_READ_WRITE_TOKEN;
  process.env.BLOB_READ_WRITE_TOKEN = "test-token";
  const directory = mkdtempSync(join(tmpdir(), "test-manager-shots-"));
  const db = createPrisma(`file:${join(directory, "isolated.db")}`);
  try {
    await applyMigrations(db);
    await importBaseline(db);
    const originalRow = await db.workbookRecord.findUniqueOrThrow({ where: { section_id: { section: "Tests", id: "T-01" } } });
    const original = originalRow.values as Record<string, string>;
    const executed = { ...original, Status: "Pass", "Actual result": "Saw the signed-in home page", Tester: "Synthetic tester", "Run date": "2026-11-05", "Evidence reference": "notes/run-1", "Run / build / environment": "Local" };
    await saveRecord("Tests", "T-01", executed, originalRow.revision, db, { id: "actor-1", email: "tester@example.test" });
    const files = new Map<string, { bytes: Buffer; contentType: string }>([
      ["executions/T-01/home.png", { bytes: png, contentType: "image/png" }],
      ["executions/T-01/home-again.jpg", { bytes: jpeg, contentType: "image/jpeg" }],
      ["executions/T-01/wide.webp", { bytes: webp, contentType: "image/webp" }],
      ["executions/T-01/anim.gif", { bytes: gif, contentType: "image/gif" }],
      ["executions/T-01/huge.png", { bytes: png, contentType: "image/png" }],
    ]);
    const store = memoryStore(files);
    store.stat = async pathname => {
      if (pathname === "executions/T-01/huge.png") return { size: 5 * 1024 * 1024 + 1, contentType: "image/png" };
      const file = files.get(pathname);
      return file ? { size: file.bytes.length, contentType: file.contentType } : null;
    };
    await assert.rejects(checkScreenshot({ testId: "T-01", fileName: "anim.gif", contentType: "image/gif", byteSize: gif.length }, db), /PNG, JPG, or WebP/);
    await assert.rejects(checkScreenshot({ testId: "T-01", fileName: "home.jpg", contentType: "image/png", byteSize: png.length }, db), /PNG, JPG, or WebP/);
    await assert.rejects(checkScreenshot({ testId: "T-01", fileName: "home.png", contentType: "image/png", byteSize: 5 * 1024 * 1024 + 1 }, db), /5 MB/);
    await assert.rejects(prepareScreenshotUpload("executions/T-02/home.png", JSON.stringify({ testId: "T-01" }), db), /PNG, JPG, or WebP/);
    await assert.rejects(prepareScreenshotUpload("executions/T-01/../test-manager.db", JSON.stringify({ testId: "T-01" }), db), /PNG, JPG, or WebP/);
    const first = await registerScreenshot({ testId: "T01", pathname: "executions/T-01/home.png", fileName: "folder/home.png", actor: { id: "actor-1", email: "tester@example.test" } }, store, db);
    const second = await registerScreenshot({ testId: "T-01", pathname: "executions/T-01/wide.webp", fileName: "wide.webp", actor: { id: "actor-1", email: "tester@example.test" } }, store, db);
    assert.equal(first.kind, "PNG");
    assert.equal(second.kind, "WebP");
    assert.equal(first.fileName, "home.png");
    assert.equal(JSON.stringify(first).includes("pathname"), false);
    assert.equal(JSON.stringify(first).includes("image/"), false);
    assert.equal(first.historySequence, null);
    await assert.rejects(registerScreenshot({ testId: "T-01", pathname: "executions/T-01/anim.gif", fileName: "anim.gif", actor: { id: "actor-1", email: "tester@example.test" } }, store, db), /PNG, JPG, or WebP/);
    assert.deepEqual(store.removed, ["executions/T-01/anim.gif"]);
    await assert.rejects(registerScreenshot({ testId: "T-01", pathname: "executions/T-01/huge.png", fileName: "huge.png", actor: { id: "actor-1", email: "tester@example.test" } }, store, db), /5 MB/);
    const saved = (await db.workbookRecord.findUniqueOrThrow({ where: { section_id: { section: "Tests", id: "T-01" } } })).values as Record<string, string>;
    assert.equal(saved["Evidence reference"], "notes/run-1");
    await saveRecord("Tests", "T-01", { ...executed, "Test / scenario": "Updated wording only" }, 1, db, { id: "actor-1", email: "tester@example.test" });
    assert.equal(await db.executionScreenshot.count({ where: { historySequence: null } }), 2);
    await attachExecutionScreenshots("T-01", db);
    const attached = await db.executionScreenshot.findMany({ where: { testId: "T-01" }, orderBy: { fileName: "asc" } });
    assert.equal(attached.length, 2);
    assert.equal(new Set(attached.map(row => row.historySequence)).size, 1);
    const firstSequence = attached[0]?.historySequence ?? 0;
    const again = await registerScreenshot({ testId: "T-01", pathname: "executions/T-01/home-again.jpg", fileName: "home-again.jpg", actor: { id: "actor-1", email: "tester@example.test" } }, store, db);
    assert.equal(again.kind, "JPEG");
    const current = (await db.workbookRecord.findUniqueOrThrow({ where: { section_id: { section: "Tests", id: "T-01" } } }));
    await saveRecord("Tests", "T-01", { ...executed, "Evidence reference": "notes/run-2" }, current.revision, db, { id: "actor-1", email: "tester@example.test" });
    await attachExecutionScreenshots("T-01", db);
    const rows = await db.executionScreenshot.findMany({ where: { testId: "T-01" } });
    assert.equal(rows.filter(row => row.historySequence === firstSequence).length, 2);
    const latest = Math.max(...rows.flatMap(row => row.historySequence === null ? [] : [row.historySequence]));
    assert.equal(rows.filter(row => row.historySequence === latest).length, 3);
    const kept = (await db.workbookRecord.findUniqueOrThrow({ where: { section_id: { section: "Tests", id: "T-01" } } })).values as Record<string, string>;
    assert.equal(kept["Evidence reference"], "notes/run-2");
    const opened = await openScreenshot(first.id, store, db);
    assert.equal(opened?.contentType, "image/png");
    assert.deepEqual(opened?.bytes, png);
    assert.equal(await openScreenshot("not-a-screenshot", store, db), null);
    assert.equal(await openScreenshot("00000000-0000-4000-8000-000000000000", store, db), null);
    const views: ScreenshotView[] = rows.flatMap(row => row.historySequence === null ? [] : [{ id: row.id, testId: row.testId, historySequence: row.historySequence, fileName: row.fileName, kind: row.contentType === "image/png" ? "PNG" as const : row.contentType === "image/jpeg" ? "JPEG" as const : "WebP" as const }]);
    assert.equal(savedExecutionShots(views, "T-01").length, 3);
    for (let index = 0; index < 17; index += 1) {
      const pathname = `executions/T-01/extra-${index}.png`;
      files.set(pathname, { bytes: png, contentType: "image/png" });
      await registerScreenshot({ testId: "T-01", pathname, fileName: `extra-${index}.png`, actor: { id: "actor-1", email: "tester@example.test" } }, store, db);
    }
    await assert.rejects(checkScreenshot({ testId: "T-01", fileName: "one-more.png", contentType: "image/png", byteSize: png.length }, db), /20 screenshots/);
    const before = await db.executionScreenshot.count({ where: { pathname: "executions/T-01/home.png" } });
    const duplicate = await registerScreenshot({ testId: "T-01", pathname: "executions/T-01/home.png", fileName: "home.png", actor: { id: "actor-1", email: "tester@example.test" } }, store, db);
    assert.equal(duplicate.kind, "PNG");
    assert.equal(await db.executionScreenshot.count({ where: { pathname: "executions/T-01/home.png" } }), before);
  } finally {
    if (previous === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = previous;
    await db.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("missing blob configuration is reported without a token value", async () => {
  const previous = process.env.BLOB_READ_WRITE_TOKEN;
  const oidc = process.env.VERCEL_OIDC_TOKEN;
  const store = process.env.BLOB_STORE_ID;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.VERCEL_OIDC_TOKEN;
  delete process.env.BLOB_STORE_ID;
  const directory = mkdtempSync(join(tmpdir(), "test-manager-shots-config-"));
  const db = createPrisma(`file:${join(directory, "isolated.db")}`);
  try {
    await applyMigrations(db);
    await importBaseline(db);
    await assert.rejects(checkScreenshot({ testId: "T-01", fileName: "home.png", contentType: "image/png", byteSize: 12 }, db), (error: unknown) => {
      assert.ok(error instanceof ScreenshotError);
      assert.equal(error.message, "Screenshot storage is not configured.");
      assert.equal(error.message.includes("vercel_blob"), false);
      return true;
    });
  } finally {
    if (previous === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = previous;
    if (oidc === undefined) delete process.env.VERCEL_OIDC_TOKEN;
    else process.env.VERCEL_OIDC_TOKEN = oidc;
    if (store === undefined) delete process.env.BLOB_STORE_ID;
    else process.env.BLOB_STORE_ID = store;
    await db.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
});
