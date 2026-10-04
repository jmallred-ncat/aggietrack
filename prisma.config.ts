import "dotenv/config";
import { defineConfig } from "prisma/config";
import { getMigrateUrl } from "./prisma/migrate-url";

export default defineConfig({
  schema: "prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: getMigrateUrl(),
  },
});
