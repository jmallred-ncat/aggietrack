import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "./generated/prisma/client";
import { databaseUrl } from "./database-url";
export function createPrisma(url = databaseUrl()) {
  mkdirSync(dirname(url.slice(5)), { recursive: true });
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
}
const globalForPrisma = globalThis as unknown as { testManagerPrisma?: PrismaClient };
if (process.env.NODE_ENV !== "production" && globalForPrisma.testManagerPrisma) {
  void globalForPrisma.testManagerPrisma.$disconnect();
  globalForPrisma.testManagerPrisma = undefined;
}
export function getPrisma() { return globalForPrisma.testManagerPrisma ??= createPrisma(); }
export async function resetPrisma() {
  if (!globalForPrisma.testManagerPrisma) return;
  await globalForPrisma.testManagerPrisma.$disconnect();
  globalForPrisma.testManagerPrisma = undefined;
}
