import "dotenv/config";
import { defineConfig } from "prisma/config";

function getMigrateUrl() {
    const raw = process.env.DATABASE_URL_UNPOOLED
        ?? process.env.POSTGRES_URL_NON_POOLING
        ?? process.env.DIRECT_URL
        ?? process.env.DATABASE_URL;

    if (!raw) {
        return raw;
    }

    try {
        const url = new URL(raw);
        url.searchParams.delete("channel_binding");
        return url.toString();
    } catch {
        return raw;
    }
}

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
