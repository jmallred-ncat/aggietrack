import { normalizeId } from "./links";

export const maxScreenshotBytes = 5 * 1024 * 1024;
export const maxScreenshotsPerExecution = 20;
export const screenshotKinds = ["PNG", "JPEG", "WebP"] as const;
export type ScreenshotKind = (typeof screenshotKinds)[number];
export type ScreenshotView = {
  id: string;
  testId: string;
  historySequence: number | null;
  fileName: string;
  kind: ScreenshotKind;
};

const mimeByKind: Record<ScreenshotKind, string> = { PNG: "image/png", JPEG: "image/jpeg", WebP: "image/webp" };

export function mimeForKind(kind: ScreenshotKind) {
  return mimeByKind[kind];
}

export function kindFromMime(value: string) {
  const mime = value.toLowerCase().split(";")[0]?.trim();
  if (mime === "image/png") return "PNG";
  if (mime === "image/jpeg" || mime === "image/jpg") return "JPEG";
  if (mime === "image/webp") return "WebP";
  return null;
}

export function kindFromName(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "png") return "PNG";
  if (extension === "jpg" || extension === "jpeg") return "JPEG";
  if (extension === "webp") return "WebP";
  return null;
}

export function imageKind(bytes: Uint8Array): ScreenshotKind | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "PNG";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "JPEG";
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "WebP";
  return null;
}

export function screenshotFileName(name: string) {
  const base = name.split(/[/\\]/).pop()?.replace(/[\u0000-\u001f]/g, "").trim() || "screenshot";
  return base.slice(0, 120) || "screenshot";
}

export function screenshotPathname(testId: string, fileName: string) {
  const base = screenshotFileName(fileName);
  const cleaned = base.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "screenshot";
  return `executions/${testId}/${cleaned}`;
}

export function ownsScreenshotPath(pathname: string, testId: string) {
  const prefix = `executions/${testId}/`;
  if (!pathname.startsWith(prefix)) return false;
  const rest = pathname.slice(prefix.length);
  return rest.length > 0 && rest.length <= 180 && !rest.includes("..") && /^[A-Za-z0-9._-]+$/.test(rest);
}

function forTest(shots: ScreenshotView[], testId: string) {
  const id = normalizeId(testId);
  return shots.filter(shot => normalizeId(shot.testId) === id);
}

export function latestScreenshotSequence(shots: ScreenshotView[], testId: string) {
  const sequences = forTest(shots, testId).flatMap(shot => shot.historySequence === null ? [] : [shot.historySequence]);
  return sequences.length === 0 ? null : Math.max(...sequences);
}

export function savedExecutionShots(shots: ScreenshotView[], testId: string) {
  const sequence = latestScreenshotSequence(shots, testId);
  if (sequence === null) return [];
  return forTest(shots, testId).filter(shot => shot.historySequence === sequence);
}

export function currentExecutionShots(shots: ScreenshotView[], testId: string) {
  const sequence = latestScreenshotSequence(shots, testId);
  return forTest(shots, testId).filter(shot => shot.historySequence === null || shot.historySequence === sequence);
}

export function formExecutionShots(shots: ScreenshotView[], testId: string) {
  return currentExecutionShots(shots, testId);
}

const executedStatuses = new Set(["Pass", "Fail", "Blocked"]);

export function pendingHistorySequence(entries: { sequence: number; status?: string; archived?: string }[]) {
  const open = entries.filter(entry => entry.archived !== "Yes" && entry.archived !== "No");
  const executed = open.filter(entry => entry.status !== undefined && executedStatuses.has(entry.status));
  const pool = executed.length > 0 ? executed : open;
  return pool.length === 0 ? null : Math.max(...pool.map(entry => entry.sequence));
}

export function historyExecutionShots(shots: ScreenshotView[], testId: string, sequence: number, includePending = false) {
  return forTest(shots, testId).filter(shot => shot.historySequence === sequence || (includePending && shot.historySequence === null));
}

export function screenshotStorageConfigured() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return true;
  return Boolean(process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID);
}
