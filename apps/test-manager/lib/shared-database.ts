import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { get } from "@vercel/blob";
import { put } from "@vercel/blob";
import { applyHumanCopy, normalizeStoredIds } from "./database";
import { ensureRuntimeDatabaseFile, runtimeDatabasePath, usesRuntimeDatabase } from "./database-url";
import { getPrisma, resetPrisma } from "./prisma";

const pathname = "test-manager.db";
let publishedHash: string | undefined;
let depth = 0;
let queue: Promise<void> = Promise.resolve();
const resets: Array<() => void> = [];

export function onSharedDatabaseReset(reset: () => void) {
  resets.push(reset);
}

function shared() {
  return usesRuntimeDatabase() && Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function hash(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

function enqueue<T>(task: () => Promise<T>) {
  const run = queue.then(task, task);
  queue = run.then(() => undefined, () => undefined);
  return run;
}

async function readRemote() {
  const downloaded = await get(pathname, { access: "private", useCache: false });
  if (!downloaded || downloaded.statusCode !== 200 || !downloaded.stream) return null;
  return Buffer.from(await new Response(downloaded.stream).arrayBuffer());
}

async function addColumn(sql: string) {
  try {
    await getPrisma().$executeRawUnsafe(sql);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/duplicate column/i.test(message)) throw error;
  }
}

async function ensureLiveSchema() {
  await addColumn(`ALTER TABLE "WorkbookRecord" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false`);
  await addColumn(`ALTER TABLE "RecordHistory" ADD COLUMN "actorId" TEXT`);
  await addColumn(`ALTER TABLE "RecordHistory" ADD COLUMN "actorEmail" TEXT`);
  await addColumn(`ALTER TABLE "user" ADD COLUMN "role" TEXT`);
  await addColumn(`ALTER TABLE "user" ADD COLUMN "banned" BOOLEAN DEFAULT false`);
  await addColumn(`ALTER TABLE "user" ADD COLUMN "banReason" TEXT`);
  await addColumn(`ALTER TABLE "user" ADD COLUMN "banExpires" DATETIME`);
  await addColumn(`ALTER TABLE "user" ADD COLUMN "organizationRole" TEXT NOT NULL DEFAULT ''`);
  await addColumn(`ALTER TABLE "user" ADD COLUMN "responsibilities" TEXT NOT NULL DEFAULT ''`);
  await addColumn(`ALTER TABLE "session" ADD COLUMN "impersonatedBy" TEXT`);
}

async function pull() {
  const remote = await readRemote();
  if (!remote) {
    ensureRuntimeDatabaseFile();
    publishedHash = undefined;
    await persist();
    return;
  }
  const next = hash(remote);
  if (next === publishedHash) return;
  await resetPrisma();
  for (const reset of resets) reset();
  writeFileSync(runtimeDatabasePath, remote);
  publishedHash = next;
}

async function persist() {
  await getPrisma().$executeRawUnsafe("PRAGMA wal_checkpoint(TRUNCATE)");
  const bytes = readFileSync(runtimeDatabasePath);
  const next = hash(bytes);
  if (next === publishedHash) return;
  await put(pathname, bytes, { access: "private", addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 0, contentType: "application/octet-stream" });
  publishedHash = next;
}

// One shared file so a sign-in on one instance is still there for the next request.
export async function withSharedDatabase<T>(work: () => Promise<T>) {
  if (!shared()) return work();
  if (depth > 0) return work();
  return enqueue(async () => {
    depth += 1;
    try {
      await pull();
      await ensureLiveSchema();
      await normalizeStoredIds();
      await applyHumanCopy();
      try { return await work(); }
      finally { await persist(); }
    } finally { depth -= 1; }
  });
}

export async function prepareDatabase() {
  if (!shared()) return;
  if (depth > 0) return;
  await enqueue(() => pull());
}
