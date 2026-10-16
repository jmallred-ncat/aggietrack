import "dotenv/config";
import { defineConfig } from "prisma/config";
import { databaseUrl } from "./lib/database-url";
import { existsSync, mkdirSync, openSync, closeSync } from "node:fs";
import { dirname } from "node:path";
// Prisma's SQLite migration engine requires the parent/file to exist here.
const url = databaseUrl();
const path = url.slice(5);
mkdirSync(dirname(path), { recursive: true });
if (!existsSync(path)) closeSync(openSync(path, "wx"));
export default defineConfig({ schema: "prisma/schema.prisma", migrations: { path: "prisma/migrations", seed: "node --import tsx prisma/seed.ts" }, datasource: { url } });
