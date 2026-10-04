import "dotenv/config";
import pg from "pg";
import { getMigrateUrl } from "./migrate-url";

const connectionString = getMigrateUrl();
if (!connectionString) {
    throw new Error("No database URL is set for migrations.");
}

const client = new pg.Client({
    connectionString,
    connectionTimeoutMillis: 60_000,
    query_timeout: 60_000,
});

await client.connect();
await client.query("SELECT 1");

// Prisma Migrate waits only 10s for this lock. A session left by a killed deploy holds it until it is ended.
const stale = await client.query(`
    SELECT pg_terminate_backend(pid) AS terminated
    FROM pg_locks
    WHERE locktype = 'advisory'
      AND classid = 0
      AND objid = 72707369
      AND granted
      AND pid <> pg_backend_pid()
`);

await client.end();

const ended = stale.rowCount ?? 0;
if (ended > 0) {
    console.log(`Ended ${ended} stale migration lock${ended === 1 ? "" : "s"}.`);
}
