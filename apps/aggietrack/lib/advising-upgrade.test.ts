import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(root, "prisma", "migrations");
const releaseName = "20261108180000_release_canceled_availability";
const database = "aggietrack_upgrade_test";
const appUrl = `postgresql://aggietrack_test:aggietrack_test@127.0.0.1:5432/${database}`;

function sudoPsql(sql: string, databaseName = "postgres") {
    return execFileSync("sudo", ["-n", "-u", "postgres", "psql", "-d", databaseName, "-v", "ON_ERROR_STOP=1", "-c", sql], {
        encoding: "utf8",
    });
}

function appPsql(sql: string) {
    return execFileSync("psql", [appUrl, "-v", "ON_ERROR_STOP=1", "-At", "-c", sql], { encoding: "utf8" });
}

function canCreateDatabase() {
    try {
        sudoPsql("SELECT 1");
        execFileSync("psql", ["postgresql://aggietrack_test:aggietrack_test@127.0.0.1:5432/postgres", "-c", "SELECT 1"], { stdio: "ignore" });
        return true;
    } catch {
        return false;
    }
}

const upgradeReady = canCreateDatabase();

test("a canceled session can release its slot when upgrading from the prior meeting schema", { skip: upgradeReady ? false : "local PostgreSQL superuser is not available" }, () => {
    sudoPsql(`DROP DATABASE IF EXISTS ${database}`);
    sudoPsql(`CREATE DATABASE ${database} OWNER aggietrack_test`);
    try {
        const names = readdirSync(migrationsDir, { withFileTypes: true })
            .filter((entry) => entry.isDirectory() && entry.name !== releaseName)
            .map((entry) => entry.name)
            .sort();
        for (const name of names) {
            execFileSync("psql", [appUrl, "-v", "ON_ERROR_STOP=1", "-f", join(migrationsDir, name, "migration.sql")], { stdio: "ignore" });
        }
        const degreeId = appPsql(`SELECT id FROM "Degree" WHERE name = 'Bachelor of Science'`).trim();
        const departmentId = appPsql(`SELECT id FROM "Department" LIMIT 1`).trim();
        appPsql(`
            INSERT INTO "Program" (id, code, name, "shortName", "updatedAt", "degreeId", "departmentId", "totalCredits")
            VALUES ('prog-up', '9432', 'Upgrade Probe', 'UP', NOW(), '${degreeId}', '${departmentId}', 120);
            INSERT INTO "CatalogYear" (id, "programId", year, "updatedAt")
            VALUES ('cat-up', 'prog-up', 2025, NOW());
            INSERT INTO "user" (id, name, email, "emailVerified", "firstName", "lastName", role, "updatedAt")
            VALUES
              ('advisor-up', 'Sarah Martinez', 'advisor.upgrade@example.test', true, 'Sarah', 'Martinez', 'ADVISOR', NOW()),
              ('student-user-up', 'Avery Cole', 'avery.upgrade@example.test', true, 'Avery', 'Cole', 'STUDENT', NOW()),
              ('other-user-up', 'Jordan Hale', 'jordan.upgrade@example.test', true, 'Jordan', 'Hale', 'STUDENT', NOW());
            INSERT INTO "StudentProfile" (id, "userId", "catalogYearId", "advisorId", "updatedAt")
            VALUES
              ('student-up', 'student-user-up', 'cat-up', 'advisor-up', NOW()),
              ('other-up', 'other-user-up', 'cat-up', 'advisor-up', NOW());
            INSERT INTO "MeetingAvailability" (id, "advisorId", "startsAt", "endsAt", "durationMinutes", status, "updatedAt")
            VALUES ('slot-up', 'advisor-up', '2026-11-12 19:00:00', '2026-11-12 19:30:00', 30, 'OPEN', NOW());
            INSERT INTO "MeetingSession" (id, "studentId", "advisorId", "availabilityId", "startsAt", "endsAt", "durationMinutes", status, topic, "canceledAt", "updatedAt")
            VALUES ('session-up', 'student-up', 'advisor-up', 'slot-up', '2026-11-12 19:00:00', '2026-11-12 19:30:00', 30, 'CANCELED', 'Spring plan', NOW(), NOW());
            INSERT INTO "MeetingEvent" (id, "sessionId", "actorId", "actorName", "actorRole", kind, body)
            VALUES ('event-up', 'session-up', 'advisor-up', 'Sarah Martinez', 'ADVISOR', 'CANCELED', 'Faculty meeting.');
        `);
        let rejected = "";
        try {
            execFileSync("psql", [appUrl, "-v", "ON_ERROR_STOP=1", "-c", `UPDATE "MeetingSession" SET "availabilityId" = NULL WHERE status = 'CANCELED' AND "availabilityId" IS NOT NULL;`], { encoding: "utf8" });
        } catch (error) {
            const stderr = String((error as { stderr?: Buffer }).stderr ?? "");
            const stdout = String((error as { stdout?: Buffer }).stdout ?? "");
            rejected = `${stderr}\n${stdout}\n${error instanceof Error ? error.message : error}`;
        }
        assert.match(rejected, /violates not-null constraint/);

        execFileSync("psql", [appUrl, "-v", "ON_ERROR_STOP=1", "-f", join(migrationsDir, releaseName, "migration.sql")], { stdio: "ignore" });

    const released = appPsql(`
        SELECT s.status, s."availabilityId" IS NULL, s.topic, e.body, a.status
        FROM "MeetingSession" s
        JOIN "MeetingEvent" e ON e."sessionId" = s.id
        JOIN "MeetingAvailability" a ON a.id = 'slot-up'
        WHERE s.id = 'session-up'
    `).trim();
    assert.equal(released, "CANCELED|t|Spring plan|Faculty meeting.|OPEN");

    appPsql(`
        INSERT INTO "MeetingSession" (id, "studentId", "advisorId", "availabilityId", "startsAt", "endsAt", "durationMinutes", status, "updatedAt")
        VALUES ('session-next', 'other-up', 'advisor-up', 'slot-up', '2026-11-12 19:00:00', '2026-11-12 19:30:00', 30, 'CONFIRMED', NOW());
    `);
    const reused = appPsql(`SELECT count(*) FROM "MeetingSession" WHERE "availabilityId" = 'slot-up' OR id = 'session-up'`).trim();
    assert.equal(reused, "2");
    const file = readFileSync(join(migrationsDir, releaseName, "migration.sql"), "utf8");
    const dropAt = file.indexOf("DROP NOT NULL");
    const updateAt = file.indexOf('SET "availabilityId" = NULL');
    assert.ok(dropAt >= 0 && updateAt > dropAt);
    } finally {
        sudoPsql(`DROP DATABASE IF EXISTS ${database}`);
    }
});
