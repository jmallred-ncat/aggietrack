import { randomUUID } from "node:crypto";
import { BlobNotFoundError, del, get, head } from "@vercel/blob";
import type { PrismaClient } from "./generated/prisma/client";
import { normalizeId } from "./links";
import { getPrisma } from "./prisma";
import { imageKind, kindFromMime, kindFromName, maxScreenshotBytes, maxScreenshotsPerExecution, mimeForKind, ownsScreenshotPath, screenshotFileName, screenshotStorageConfigured, type ScreenshotKind, type ScreenshotView } from "./screenshot-rules";

export class ScreenshotError extends Error {}

export type BlobReader = {
  stat(pathname: string): Promise<{ size: number; contentType: string } | null>;
  read(pathname: string): Promise<Buffer | null>;
  remove(pathname: string): Promise<void>;
};

export function vercelBlobReader(): BlobReader {
  return {
    async stat(pathname) {
      try {
        const meta = await head(pathname);
        return { size: meta.size, contentType: meta.contentType };
      } catch (error) {
        if (error instanceof BlobNotFoundError) return null;
        throw error;
      }
    },
    async read(pathname) {
      const downloaded = await get(pathname, { access: "private", useCache: false });
      if (!downloaded || downloaded.statusCode !== 200 || !downloaded.stream) return null;
      return Buffer.from(await new Response(downloaded.stream).arrayBuffer());
    },
    async remove(pathname) {
      await del(pathname);
    },
  };
}

async function discard(store: BlobReader, pathname: string) {
  try { await store.remove(pathname); } catch { return; }
}

function toView(row: { id: string; testId: string; historySequence: number | null; fileName: string; contentType: string }): ScreenshotView | null {
  const kind = kindFromMime(row.contentType);
  if (!kind) return null;
  return { id: row.id, testId: row.testId, historySequence: row.historySequence, fileName: row.fileName, kind };
}

async function requireTest(db: PrismaClient, testId: string) {
  const id = normalizeId(testId);
  if (!/^T-\d{2,}$/.test(id)) throw new ScreenshotError("That test case does not exist.");
  const test = await db.workbookRecord.findUnique({ where: { section_id: { section: "Tests", id } } });
  if (!test) throw new ScreenshotError("That test case does not exist.");
  return id;
}

async function executionCount(db: PrismaClient, testId: string) {
  const rows = await db.executionScreenshot.findMany({ where: { testId }, select: { historySequence: true } });
  const sequences = rows.flatMap(row => row.historySequence === null ? [] : [row.historySequence]);
  const latest = sequences.length === 0 ? null : Math.max(...sequences);
  return rows.filter(row => row.historySequence === null || row.historySequence === latest).length;
}

export async function listScreenshotViews(db: PrismaClient = getPrisma()) {
  const rows = await db.executionScreenshot.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  return rows.flatMap(row => {
    const view = toView(row);
    return view ? [view] : [];
  });
}

export async function checkScreenshot(input: { testId: string; fileName: string; contentType: string; byteSize: number }, db: PrismaClient = getPrisma()) {
  const testId = await requireTest(db, input.testId);
  const fromMime = kindFromMime(input.contentType);
  const fromName = kindFromName(input.fileName);
  if ((!fromMime && !fromName) || (fromMime && fromName && fromMime !== fromName)) throw new ScreenshotError("Choose a PNG, JPG, or WebP image.");
  if (!Number.isFinite(input.byteSize) || input.byteSize <= 0) throw new ScreenshotError("Choose a PNG, JPG, or WebP image.");
  if (input.byteSize > maxScreenshotBytes) throw new ScreenshotError("Each screenshot must be 5 MB or smaller.");
  if (!screenshotStorageConfigured()) throw new ScreenshotError("Screenshot storage is not configured.");
  if (await executionCount(db, testId) >= maxScreenshotsPerExecution) throw new ScreenshotError("An execution can have up to 20 screenshots.");
  return { testId };
}

export async function prepareScreenshotUpload(pathname: string, clientPayload: string | null, db: PrismaClient = getPrisma()) {
  if (!screenshotStorageConfigured()) throw new ScreenshotError("Screenshot storage is not configured.");
  let testId = "";
  try {
    const payload = JSON.parse(clientPayload ?? "") as { testId?: unknown };
    if (payload && typeof payload.testId === "string") testId = payload.testId;
  } catch { testId = ""; }
  const id = await requireTest(db, testId);
  if (!ownsScreenshotPath(pathname, id) || !kindFromName(pathname)) throw new ScreenshotError("Choose a PNG, JPG, or WebP image.");
  if (await executionCount(db, id) >= maxScreenshotsPerExecution) throw new ScreenshotError("An execution can have up to 20 screenshots.");
  return id;
}

export async function registerScreenshot(input: { testId: string; pathname: string; fileName: string; actor: { id: string; email: string } }, store: BlobReader, db: PrismaClient = getPrisma()) {
  const testId = await requireTest(db, input.testId);
  if (!ownsScreenshotPath(input.pathname, testId)) throw new ScreenshotError("That screenshot could not be saved.");
  const existing = await db.executionScreenshot.findFirst({ where: { testId, pathname: input.pathname }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  if (existing) {
    const view = toView(existing);
    if (!view) throw new ScreenshotError("That screenshot could not be saved.");
    return view;
  }
  const meta = await store.stat(input.pathname);
  if (!meta) throw new ScreenshotError("That screenshot did not finish uploading.");
  if (meta.size > maxScreenshotBytes) {
    await discard(store, input.pathname);
    throw new ScreenshotError("Each screenshot must be 5 MB or smaller.");
  }
  const bytes = await store.read(input.pathname);
  const kind = bytes ? imageKind(bytes) : null;
  if (!bytes || !kind || bytes.length > maxScreenshotBytes) {
    await discard(store, input.pathname);
    throw new ScreenshotError("Choose a PNG, JPG, or WebP image.");
  }
  if (await executionCount(db, testId) >= maxScreenshotsPerExecution) {
    await discard(store, input.pathname);
    throw new ScreenshotError("An execution can have up to 20 screenshots.");
  }
  const created = await db.executionScreenshot.create({
    data: {
      id: randomUUID(),
      testId,
      pathname: input.pathname,
      fileName: screenshotFileName(input.fileName),
      contentType: mimeForKind(kind),
      byteSize: bytes.length,
      uploadedById: input.actor.id,
      uploadedByEmail: input.actor.email,
    },
  });
  const view = toView(created);
  if (!view) throw new ScreenshotError("That screenshot could not be saved.");
  return view;
}

export async function attachExecutionScreenshots(testId: string, db: PrismaClient = getPrisma()) {
  const id = normalizeId(testId);
  const latest = await db.recordHistory.findFirst({ where: { section: "Tests", recordId: id }, orderBy: { sequence: "desc" } });
  if (!latest) return;
  await db.$transaction(async tx => {
    const rows = await tx.executionScreenshot.findMany({ where: { testId: id } });
    const drafts = rows.filter(row => row.historySequence === null);
    const older = rows.flatMap(row => row.historySequence !== null && row.historySequence !== latest.sequence ? [row.historySequence] : []);
    const previous = older.length === 0 ? null : Math.max(...older);
    const attached = new Set(rows.filter(row => row.historySequence === latest.sequence).map(row => row.pathname));
    if (previous !== null) {
      for (const row of rows) {
        if (row.historySequence !== previous || attached.has(row.pathname)) continue;
        await tx.executionScreenshot.create({
          data: {
            id: randomUUID(),
            testId: id,
            historySequence: latest.sequence,
            pathname: row.pathname,
            fileName: row.fileName,
            contentType: row.contentType,
            byteSize: row.byteSize,
            createdAt: row.createdAt,
            uploadedById: row.uploadedById,
            uploadedByEmail: row.uploadedByEmail,
          },
        });
        attached.add(row.pathname);
      }
    }
    if (drafts.length > 0) await tx.executionScreenshot.updateMany({ where: { id: { in: drafts.map(row => row.id) } }, data: { historySequence: latest.sequence } });
  });
}

const screenshotId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function openScreenshot(id: string, store: BlobReader, db: PrismaClient = getPrisma()) {
  if (!screenshotId.test(id)) return null;
  const row = await db.executionScreenshot.findUnique({ where: { id } });
  if (!row) return null;
  const kind = kindFromMime(row.contentType);
  if (!kind || !ownsScreenshotPath(row.pathname, row.testId)) return null;
  const bytes = await store.read(row.pathname);
  if (!bytes || imageKind(bytes) !== kind) return null;
  return { bytes, contentType: mimeForKind(kind as ScreenshotKind), fileName: row.fileName };
}
