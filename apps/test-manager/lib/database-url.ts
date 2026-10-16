import { copyFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

export const runtimeDatabasePath = "/tmp/test-manager.db";

export function usesRuntimeDatabase() {
  return process.env.VERCEL === "1" && process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build";
}

export function ensureRuntimeDatabaseFile() {
  if (!usesRuntimeDatabase() || existsSync(runtimeDatabasePath)) return;
  const bundled = join(process.cwd(), "prisma", "test-manager.db");
  if (existsSync(bundled)) copyFileSync(bundled, runtimeDatabasePath);
}

export function databaseUrl() {
  // The deployment bundle is read-only. Keep the seeded database there and write to a copy.
  if (usesRuntimeDatabase()) {
    ensureRuntimeDatabaseFile();
    return `file:${runtimeDatabasePath}`;
  }
  const configured = process.env.TEST_MANAGER_DATABASE_URL;
  if (configured && !configured.startsWith("file:")) throw new Error("TEST_MANAGER_DATABASE_URL must be a SQLite file URL.");
  return `file:${resolve(configured?.slice(5) ?? "prisma/test-manager.db")}`;
}
