import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { migrateEnvForScratch } from "./advising-test-target";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const prismaBin = join(appRoot, "node_modules/.bin/prisma");
const migrationsDir = join(appRoot, "prisma/migrations");
const releaseName = "20261108180000_release_canceled_availability";
const repairName = "20261108193000_repair_canceled_availability";
const canonicalSha = "cfbc68d4bcc5c35044022a16e05c5beb0a24f7f9048b9ab30d5964df58053fbc";

function sqlText(name: string) {
    return readFileSync(join(migrationsDir, name, "migration.sql"), "utf8");
}

function assertLocalDatabase(url: string) {
    const parsed = new URL(url);
    const name = parsed.pathname.replace(/^\//, "");
    assert.ok(parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost");
    assert.notEqual(name, "aggietrack_agt17");
    assert.match(name, /^aggietrack_repair_/);
    return name;
}

function sudoPsql(sql: string, databaseName = "postgres") {
    return execFileSync("sudo", ["-n", "-u", "postgres", "psql", "-d", databaseName, "-v", "ON_ERROR_STOP=1", "-c", sql], {
        encoding: "utf8",
    });
}

function psql(url: string, sql: string) {
    assertLocalDatabase(url);
    return execFileSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-At", "-c", sql], { encoding: "utf8" }).trim();
}

function psqlFile(url: string, file: string, prelude = "") {
    assertLocalDatabase(url);
    const script = `${prelude}\n\\i '${file.replaceAll("'", "''")}'\n`;
    return execFileSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-f", "-"], { encoding: "utf8", input: script });
}

function psqlAllows(url: string, sql: string) {
    assertLocalDatabase(url);
    try {
        const stdout = execFileSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-At", "-c", sql], { encoding: "utf8" });
        return { ok: true, text: stdout };
    } catch (error) {
        const failed = error as { stderr?: Buffer; stdout?: Buffer; message?: string };
        return { ok: false, text: `${failed.stderr?.toString() ?? ""}\n${failed.stdout?.toString() ?? ""}\n${failed.message ?? ""}` };
    }
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

const ready = canCreateDatabase();

function recreate(name: string) {
    assert.match(name, /^aggietrack_repair_/);
    sudoPsql(`DROP DATABASE IF EXISTS "${name}"`);
    sudoPsql(`CREATE DATABASE "${name}" OWNER aggietrack_test`);
}

function databaseUrl(name: string) {
    const url = `postgresql://aggietrack_test:aggietrack_test@127.0.0.1:5432/${name}`;
    assertLocalDatabase(url);
    return url;
}

function makeProbe(name: string) {
    const probe = join("/tmp", name);
    rmSync(probe, { recursive: true, force: true });
    mkdirSync(probe, { recursive: true });
    execFileSync("cp", ["-a", join(appRoot, "prisma"), probe]);
    execFileSync("cp", [join(appRoot, "prisma7.config.ts"), join(probe, "prisma7.config.ts")]);
    symlinkSync(join(appRoot, "node_modules"), join(probe, "node_modules"));
    return probe;
}

function hideMigration(probe: string, name: string) {
    const from = join(probe, "prisma/migrations", name);
    const to = join("/tmp", `${probe.split("/").pop()}-held-${name}`);
    rmSync(to, { recursive: true, force: true });
    execFileSync("mv", [from, to]);
    return to;
}

function restoreMigration(held: string, probe: string, name: string) {
    execFileSync("mv", [held, join(probe, "prisma/migrations", name)]);
}

function runPrisma(probe: string, url: string, args: string[]) {
    assertLocalDatabase(url);
    const env = migrateEnvForScratch(url, process.env);
    try {
        const stdout = execFileSync(prismaBin, [...args, "--config", join(probe, "prisma7.config.ts")], {
            cwd: probe,
            env,
            encoding: "utf8",
        });
        return { code: 0, text: stdout.replaceAll(url, "postgresql://[local]") };
    } catch (error) {
        const failed = error as { status?: number; stderr?: Buffer; stdout?: Buffer; message?: string };
        const text = `${failed.stdout?.toString() ?? ""}\n${failed.stderr?.toString() ?? ""}\n${failed.message ?? ""}`.replaceAll(url, "postgresql://[local]");
        return { code: failed.status ?? 1, text };
    }
}

function preflight(url: string) {
    const gate = psql(url, `
        SELECT CASE
            WHEN to_regclass('public."MeetingSession"') IS NULL THEN 'initial-empty'
            WHEN to_regclass('public."_prisma_migrations"') IS NULL THEN 'initial-empty'
            ELSE 'check'
        END
    `);
    if (gate !== "check") return gate;
    return psql(url, `
        SELECT CASE
            WHEN EXISTS (
                SELECT 1 FROM "_prisma_migrations"
                WHERE migration_name = '${releaseName}'
                  AND finished_at IS NULL
                  AND rolled_back_at IS NULL
            ) THEN 'blocked-failed-release'
            WHEN NOT EXISTS (
                SELECT 1 FROM "_prisma_migrations"
                WHERE migration_name = '${releaseName}'
                  AND finished_at IS NOT NULL
                  AND rolled_back_at IS NULL
            )
            AND EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'MeetingSession'
                  AND column_name = 'availabilityId'
                  AND is_nullable = 'NO'
            )
            AND EXISTS (
                SELECT 1 FROM "MeetingSession"
                WHERE status = 'CANCELED' AND "availabilityId" IS NOT NULL
            ) THEN 'blocked-canceled-before-release'
            ELSE 'ok'
        END
    `);
}

function seedPeople(url: string) {
    const degree = psql(url, `SELECT id FROM "Degree" WHERE name = 'Bachelor of Science'`);
    const department = psql(url, `SELECT id FROM "Department" LIMIT 1`);
    assert.ok(degree && department);
    psql(url, `
        INSERT INTO "Program" (id, code, name, "shortName", "updatedAt", "degreeId", "departmentId", "totalCredits")
        VALUES ('prog-r', '9432', 'Repair Probe', 'RP', NOW(), '${degree}', '${department}', 120);
        INSERT INTO "CatalogYear" (id, "programId", year, "updatedAt")
        VALUES ('cat-r', 'prog-r', 2025, NOW());
        INSERT INTO "user" (id, name, email, "emailVerified", "firstName", "lastName", role, "updatedAt")
        VALUES
          ('advisor-r', 'Probe Advisor', 'advisor.repair@example.test', true, 'Probe', 'Advisor', 'ADVISOR', NOW()),
          ('student-r', 'Probe Student', 'student.repair@example.test', true, 'Probe', 'Student', 'STUDENT', NOW()),
          ('other-r', 'Probe Other', 'other.repair@example.test', true, 'Probe', 'Other', 'STUDENT', NOW());
        INSERT INTO "StudentProfile" (id, "userId", "catalogYearId", "advisorId", "updatedAt")
        VALUES
          ('sp-r', 'student-r', 'cat-r', 'advisor-r', NOW()),
          ('sp-o', 'other-r', 'cat-r', 'advisor-r', NOW());
    `);
}

test("fresh migrate deploy applies the canonical file and the repair", { skip: ready ? false : "local PostgreSQL superuser is not available", timeout: 120_000 }, () => {
    const release = sqlText(releaseName);
    const repair = sqlText(repairName);
    assert.equal(createHash("sha256").update(release).digest("hex"), canonicalSha);
    assert.ok(release.indexOf('SET "availabilityId" = NULL') < release.indexOf("DROP NOT NULL"));
    assert.ok(repair.indexOf("DROP NOT NULL") < repair.indexOf('SET "availabilityId" = NULL'));
    assert.equal(repair.includes('INSERT INTO "MeetingAvailability"'), false);

    const name = "aggietrack_repair_fresh";
    const url = databaseUrl(name);
    const probe = makeProbe(name);
    try {
        recreate(name);
        assert.equal(preflight(url), "initial-empty");
        const deployed = runPrisma(probe, url, ["migrate", "deploy"]);
        assert.equal(deployed.code, 0, deployed.text);
        assert.match(deployed.text, /All migrations have been successfully applied/);
        assert.equal(psql(url, `SELECT is_nullable FROM information_schema.columns WHERE table_name = 'MeetingSession' AND column_name = 'availabilityId'`), "YES");
        assert.equal(psql(url, `SELECT checksum FROM "_prisma_migrations" WHERE migration_name = '${releaseName}' AND finished_at IS NOT NULL`), canonicalSha);
        assert.equal(psql(url, `SELECT count(*) FROM "_prisma_migrations" WHERE migration_name = '${repairName}' AND finished_at IS NOT NULL`), "1");
        assert.equal(preflight(url), "ok");
        const again = runPrisma(probe, url, ["migrate", "deploy"]);
        assert.equal(again.code, 0, again.text);
        assert.match(again.text, /No pending migrations to apply/);

        seedPeople(url);
        psql(url, `
            CREATE TEMP TABLE clock AS SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AS now_utc;
            INSERT INTO "MeetingAvailability" (id, "advisorId", "startsAt", "endsAt", "durationMinutes", status, "updatedAt")
            SELECT 'slot-fresh', 'advisor-r', clock.now_utc + INTERVAL '2 days', clock.now_utc + INTERVAL '2 days 30 minutes', 30, 'BOOKED', clock.now_utc FROM clock;
            INSERT INTO "MeetingSession" (id, "studentId", "advisorId", "availabilityId", "startsAt", "endsAt", "durationMinutes", status, topic, "updatedAt")
            SELECT 'session-fresh', 'sp-r', 'advisor-r', 'slot-fresh', slot."startsAt", slot."endsAt", 30, 'CONFIRMED', 'Stay linked', clock.now_utc
            FROM "MeetingAvailability" slot, clock WHERE slot.id = 'slot-fresh';
        `);
        psqlFile(url, join(migrationsDir, repairName, "migration.sql"));
        assert.equal(psql(url, `SELECT status || '|' || "availabilityId" || '|' || topic FROM "MeetingSession" WHERE id = 'session-fresh'`), "CONFIRMED|slot-fresh|Stay linked");
        assert.equal(psql(url, `SELECT status FROM "MeetingAvailability" WHERE id = 'slot-fresh'`), "BOOKED");
    } finally {
        sudoPsql(`DROP DATABASE IF EXISTS "${name}"`);
        rmSync(probe, { recursive: true, force: true });
    }
});

function previewFixture(url: string) {
    psql(url, `
        CREATE TEMP TABLE clock AS SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AS now_utc;
        INSERT INTO "MeetingAvailability" (id, "advisorId", "startsAt", "endsAt", "durationMinutes", status, "updatedAt")
        SELECT seed.id, 'advisor-r', clock.now_utc + seed.start_offset, clock.now_utc + seed.start_offset + seed.length, seed.minutes, seed.status::"MeetingSlotStatus", clock.now_utc
        FROM clock
        CROSS JOIN (VALUES
            ('slot-reuse', INTERVAL '2 days', INTERVAL '30 minutes', 30, 'BOOKED'),
            ('slot-remove', INTERVAL '3 days', INTERVAL '30 minutes', 30, 'BOOKED'),
            ('slot-confirmed', INTERVAL '4 days', INTERVAL '30 minutes', 30, 'BOOKED'),
            ('slot-past', INTERVAL '-2 days', INTERVAL '30 minutes', 30, 'BOOKED'),
            ('slot-invalid', INTERVAL '5 days', INTERVAL '-1 minute', 30, 'BOOKED'),
            ('slot-short', INTERVAL '6 days', INTERVAL '10 minutes', 10, 'BOOKED'),
            ('slot-overlap-canceled', INTERVAL '7 days', INTERVAL '30 minutes', 30, 'BOOKED'),
            ('slot-overlap-open', INTERVAL '7 days 15 minutes', INTERVAL '30 minutes', 30, 'OPEN'),
            ('slot-conflict', INTERVAL '8 days', INTERVAL '30 minutes', 30, 'BOOKED'),
            ('slot-confirmed-overlap', INTERVAL '8 days 15 minutes', INTERVAL '30 minutes', 30, 'BOOKED'),
            ('slot-open-linked', INTERVAL '9 days', INTERVAL '30 minutes', 30, 'OPEN'),
            ('slot-pair-a', INTERVAL '10 days', INTERVAL '30 minutes', 30, 'BOOKED'),
            ('slot-pair-b', INTERVAL '10 days 15 minutes', INTERVAL '30 minutes', 30, 'BOOKED'),
            ('slot-gone', INTERVAL '11 days', INTERVAL '30 minutes', 30, 'OPEN')
        ) AS seed(id, start_offset, length, minutes, status);
        INSERT INTO "MeetingSession" (id, "studentId", "advisorId", "availabilityId", "startsAt", "endsAt", "durationMinutes", status, topic, "canceledAt", "updatedAt")
        SELECT seed.id, seed.student_id, 'advisor-r', seed.slot_id, slot."startsAt", slot."endsAt", slot."durationMinutes", seed.status::"MeetingSessionStatus", seed.topic, CASE WHEN seed.status = 'CANCELED' THEN clock.now_utc ELSE NULL END, clock.now_utc
        FROM clock
        JOIN (VALUES
            ('session-reuse', 'sp-r', 'slot-reuse', 'CANCELED', 'Reuse topic'),
            ('session-remove', 'sp-r', 'slot-remove', 'CANCELED', 'Remove topic'),
            ('session-confirmed', 'sp-r', 'slot-confirmed', 'CONFIRMED', 'Stay booked'),
            ('session-past', 'sp-r', 'slot-past', 'CANCELED', 'Past topic'),
            ('session-invalid', 'sp-r', 'slot-invalid', 'CANCELED', 'Invalid topic'),
            ('session-short', 'sp-r', 'slot-short', 'CANCELED', 'Short topic'),
            ('session-overlap', 'sp-r', 'slot-overlap-canceled', 'CANCELED', 'Overlap topic'),
            ('session-conflict', 'sp-r', 'slot-conflict', 'CANCELED', 'Conflict topic'),
            ('session-other', 'sp-o', 'slot-confirmed-overlap', 'CONFIRMED', 'Other booking'),
            ('session-open', 'sp-o', 'slot-open-linked', 'CANCELED', 'Already open'),
            ('session-pair-a', 'sp-r', 'slot-pair-a', 'CANCELED', 'Pair A'),
            ('session-pair-b', 'sp-o', 'slot-pair-b', 'CANCELED', 'Pair B')
        ) AS seed(id, student_id, slot_id, status, topic) ON TRUE
        JOIN "MeetingAvailability" slot ON slot.id = seed.slot_id;
        INSERT INTO "MeetingEvent" (id, "sessionId", "actorId", "actorName", "actorRole", kind, body)
        SELECT 'event-' || id, id, 'advisor-r', 'Probe Advisor', 'ADVISOR', 'CANCELED', topic
        FROM "MeetingSession" WHERE status = 'CANCELED';
        INSERT INTO "MeetingSession" (id, "studentId", "advisorId", "availabilityId", "startsAt", "endsAt", "durationMinutes", status, topic, "updatedAt")
        SELECT 'session-gone', 'sp-o', 'advisor-r', NULL, clock.now_utc + INTERVAL '11 days', clock.now_utc + INTERVAL '11 days 30 minutes', 30, 'CANCELED', 'Removed slot', clock.now_utc FROM clock;
        UPDATE "MeetingSession" SET "canceledAt" = (SELECT now_utc FROM clock) WHERE id = 'session-gone';
        INSERT INTO "MeetingEvent" (id, "sessionId", "actorId", "actorName", "actorRole", kind, body)
        VALUES ('event-session-gone', 'session-gone', 'advisor-r', 'Probe Advisor', 'ADVISOR', 'CANCELED', 'Removed slot');
        DELETE FROM "MeetingAvailability" WHERE id = 'slot-gone';
    `);
}

function slotStatus(url: string, id: string) {
    return psql(url, `SELECT status FROM "MeetingAvailability" WHERE id = '${id}'`);
}

function sessionState(url: string, id: string) {
    return psql(url, `SELECT status || '|' || coalesce("availabilityId", '') || '|' || coalesce(topic, '') FROM "MeetingSession" WHERE id = '${id}'`);
}

test("an already applied release keeps history and reopens only a future valid slot", { skip: ready ? false : "local PostgreSQL superuser is not available", timeout: 120_000 }, () => {
    const name = "aggietrack_repair_preview";
    const url = databaseUrl(name);
    const probe = makeProbe(name);
    const held = hideMigration(probe, repairName);
    try {
        recreate(name);
        const base = runPrisma(probe, url, ["migrate", "deploy"]);
        assert.equal(base.code, 0, base.text);
        assert.equal(psql(url, `SELECT checksum FROM "_prisma_migrations" WHERE migration_name = '${releaseName}' AND finished_at IS NOT NULL`), canonicalSha);
        assert.equal(preflight(url), "ok");
        seedPeople(url);
        previewFixture(url);
        const blockedDelete = psqlAllows(url, `DELETE FROM "MeetingAvailability" WHERE id = 'slot-remove'`);
        assert.equal(blockedDelete.ok, false);
        assert.match(blockedDelete.text, /violates foreign key constraint|23503/);

        const repaired = psqlFile(url, join(migrationsDir, repairName, "migration.sql"), "SET TIME ZONE 'America/New_York';\nSHOW TIME ZONE;");
        assert.match(repaired, /America\/New_York/);
        assert.equal(slotStatus(url, "slot-reuse"), "OPEN");
        assert.equal(slotStatus(url, "slot-remove"), "OPEN");
        assert.equal(slotStatus(url, "slot-confirmed"), "BOOKED");
        assert.equal(slotStatus(url, "slot-past"), "BOOKED");
        assert.equal(slotStatus(url, "slot-invalid"), "BOOKED");
        assert.equal(slotStatus(url, "slot-short"), "BOOKED");
        assert.equal(slotStatus(url, "slot-overlap-canceled"), "BOOKED");
        assert.equal(slotStatus(url, "slot-overlap-open"), "OPEN");
        assert.equal(slotStatus(url, "slot-conflict"), "BOOKED");
        assert.equal(slotStatus(url, "slot-confirmed-overlap"), "BOOKED");
        assert.equal(slotStatus(url, "slot-open-linked"), "OPEN");
        assert.equal(slotStatus(url, "slot-pair-a"), "BOOKED");
        assert.equal(slotStatus(url, "slot-pair-b"), "BOOKED");
        assert.equal(psql(url, `SELECT count(*) FROM "MeetingAvailability" WHERE id = 'slot-gone'`), "0");

        for (const id of ["session-reuse", "session-remove", "session-past", "session-invalid", "session-short", "session-overlap", "session-conflict", "session-open", "session-pair-a", "session-pair-b", "session-gone"]) {
            assert.equal(psql(url, `SELECT "availabilityId" IS NULL FROM "MeetingSession" WHERE id = '${id}'`), "t", id);
        }
        assert.equal(sessionState(url, "session-confirmed"), "CONFIRMED|slot-confirmed|Stay booked");
        assert.equal(sessionState(url, "session-other"), "CONFIRMED|slot-confirmed-overlap|Other booking");
        assert.equal(psql(url, `SELECT body FROM "MeetingEvent" WHERE "sessionId" = 'session-reuse'`), "Reuse topic");
        assert.equal(psql(url, `SELECT body FROM "MeetingEvent" WHERE "sessionId" = 'session-gone'`), "Removed slot");

        psql(url, `
            UPDATE "MeetingAvailability" SET status = 'BOOKED', "updatedAt" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') WHERE id = 'slot-reuse';
            INSERT INTO "MeetingSession" (id, "studentId", "advisorId", "availabilityId", "startsAt", "endsAt", "durationMinutes", status, topic, "updatedAt")
            SELECT 'session-next', 'sp-o', 'advisor-r', 'slot-reuse', slot."startsAt", slot."endsAt", slot."durationMinutes", 'CONFIRMED', 'Booked again', (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
            FROM "MeetingAvailability" slot WHERE slot.id = 'slot-reuse';
        `);
        assert.equal(sessionState(url, "session-next"), "CONFIRMED|slot-reuse|Booked again");
        assert.equal(sessionState(url, "session-reuse"), "CANCELED||Reuse topic");
        psql(url, `DELETE FROM "MeetingAvailability" WHERE id = 'slot-remove'`);
        assert.equal(psql(url, `SELECT count(*) FROM "MeetingAvailability" WHERE id = 'slot-remove'`), "0");
        const confirmedDelete = psqlAllows(url, `DELETE FROM "MeetingAvailability" WHERE id = 'slot-confirmed'`);
        assert.equal(confirmedDelete.ok, false);
        assert.match(confirmedDelete.text, /violates foreign key constraint|23503/);

        restoreMigration(held, probe, repairName);
        const recorded = runPrisma(probe, url, ["migrate", "deploy"]);
        assert.equal(recorded.code, 0, recorded.text);
        assert.match(recorded.text, new RegExp(repairName));
        assert.equal(sessionState(url, "session-next"), "CONFIRMED|slot-reuse|Booked again");
        assert.equal(sessionState(url, "session-confirmed"), "CONFIRMED|slot-confirmed|Stay booked");
        assert.equal(sessionState(url, "session-past"), "CANCELED||Past topic");
        assert.equal(psql(url, `SELECT count(*) FROM "MeetingAvailability" WHERE id IN ('slot-remove', 'slot-gone')`), "0");
        assert.equal(slotStatus(url, "slot-past"), "BOOKED");
        assert.equal(psql(url, `SELECT count(*) FROM "MeetingEvent" WHERE body = 'Reuse topic'`), "1");
    } finally {
        sudoPsql(`DROP DATABASE IF EXISTS "${name}"`);
        rmSync(probe, { recursive: true, force: true });
        rmSync(held, { recursive: true, force: true });
    }
});

test("a canceled row makes the canonical release fail before the repair can run", { skip: ready ? false : "local PostgreSQL superuser is not available", timeout: 120_000 }, () => {
    const name = "aggietrack_repair_failed";
    const url = databaseUrl(name);
    const probe = makeProbe(name);
    const heldRelease = hideMigration(probe, releaseName);
    const heldRepair = hideMigration(probe, repairName);
    try {
        recreate(name);
        const prior = runPrisma(probe, url, ["migrate", "deploy"]);
        assert.equal(prior.code, 0, prior.text);
        assert.equal(preflight(url), "ok");
        seedPeople(url);
        psql(url, `
            CREATE TEMP TABLE clock AS SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AS now_utc;
            INSERT INTO "MeetingAvailability" (id, "advisorId", "startsAt", "endsAt", "durationMinutes", status, "updatedAt")
            SELECT 'slot-early', 'advisor-r', now_utc + INTERVAL '2 days', now_utc + INTERVAL '2 days 30 minutes', 30, 'BOOKED', now_utc FROM clock;
            INSERT INTO "MeetingSession" (id, "studentId", "advisorId", "availabilityId", "startsAt", "endsAt", "durationMinutes", status, topic, "canceledAt", "updatedAt")
            SELECT 'session-early', 'sp-r', 'advisor-r', 'slot-early', slot."startsAt", slot."endsAt", 30, 'CANCELED', 'Early cancel', clock.now_utc, clock.now_utc
            FROM "MeetingAvailability" slot, clock WHERE slot.id = 'slot-early';
            INSERT INTO "MeetingEvent" (id, "sessionId", "actorId", "actorName", "actorRole", kind, body)
            VALUES ('event-early', 'session-early', 'advisor-r', 'Probe Advisor', 'ADVISOR', 'CANCELED', 'Early cancel');
        `);
        assert.equal(preflight(url), "blocked-canceled-before-release");
        restoreMigration(heldRelease, probe, releaseName);
        restoreMigration(heldRepair, probe, repairName);
        const failed = runPrisma(probe, url, ["migrate", "deploy"]);
        assert.equal(failed.code, 1, failed.text);
        assert.match(failed.text, /P3018/);
        assert.match(failed.text, /23502/);
        assert.match(failed.text, /violates not-null constraint/);
        assert.equal(preflight(url), "blocked-failed-release");
        assert.equal(psql(url, `SELECT count(*) FROM "_prisma_migrations" WHERE migration_name = '${repairName}'`), "0");
        assert.equal(sessionState(url, "session-early"), "CANCELED|slot-early|Early cancel");
        assert.equal(psql(url, `SELECT is_nullable FROM information_schema.columns WHERE table_name = 'MeetingSession' AND column_name = 'availabilityId'`), "NO");

        const blocked = runPrisma(probe, url, ["migrate", "deploy"]);
        assert.equal(blocked.code, 1, blocked.text);
        assert.match(blocked.text, /P3009/);
        assert.equal(psql(url, `SELECT count(*) FROM "_prisma_migrations" WHERE migration_name = '${repairName}'`), "0");

        const rolled = runPrisma(probe, url, ["migrate", "resolve", "--rolled-back", releaseName]);
        assert.equal(rolled.code, 0, rolled.text);
        const failedAgain = runPrisma(probe, url, ["migrate", "deploy"]);
        assert.equal(failedAgain.code, 1, failedAgain.text);
        assert.match(failedAgain.text, /P3018/);
        assert.equal(psql(url, `SELECT count(*) FROM "_prisma_migrations" WHERE migration_name = '${repairName}'`), "0");
        assert.equal(sessionState(url, "session-early"), "CANCELED|slot-early|Early cancel");

        const rolledAgain = runPrisma(probe, url, ["migrate", "resolve", "--rolled-back", releaseName]);
        assert.equal(rolledAgain.code, 0, rolledAgain.text);
        psqlFile(url, join(migrationsDir, repairName, "migration.sql"));
        const recovered = runPrisma(probe, url, ["migrate", "deploy"]);
        assert.equal(recovered.code, 0, recovered.text);
        assert.equal(psql(url, `SELECT checksum FROM "_prisma_migrations" WHERE migration_name = '${releaseName}' AND finished_at IS NOT NULL AND rolled_back_at IS NULL`), canonicalSha);
        assert.equal(psql(url, `SELECT count(*) FROM "_prisma_migrations" WHERE migration_name = '${repairName}' AND finished_at IS NOT NULL`), "1");
        assert.equal(slotStatus(url, "slot-early"), "OPEN");
        assert.equal(sessionState(url, "session-early"), "CANCELED||Early cancel");
        assert.equal(psql(url, `SELECT body FROM "MeetingEvent" WHERE id = 'event-early'`), "Early cancel");
        psql(url, `
            UPDATE "MeetingAvailability" SET status = 'BOOKED' WHERE id = 'slot-early';
            INSERT INTO "MeetingSession" (id, "studentId", "advisorId", "availabilityId", "startsAt", "endsAt", "durationMinutes", status, "updatedAt")
            SELECT 'session-after', 'sp-o', 'advisor-r', 'slot-early', slot."startsAt", slot."endsAt", 30, 'CONFIRMED', (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
            FROM "MeetingAvailability" slot WHERE slot.id = 'slot-early';
        `);
        assert.equal(sessionState(url, "session-after"), "CONFIRMED|slot-early|");
        psql(url, `DELETE FROM "MeetingSession" WHERE id = 'session-after'`);
        psql(url, `UPDATE "MeetingAvailability" SET status = 'OPEN' WHERE id = 'slot-early'`);
        psql(url, `DELETE FROM "MeetingAvailability" WHERE id = 'slot-early'`);
        assert.equal(psql(url, `SELECT count(*) FROM "MeetingAvailability" WHERE id = 'slot-early'`), "0");
        assert.equal(sessionState(url, "session-early"), "CANCELED||Early cancel");
    } finally {
        sudoPsql(`DROP DATABASE IF EXISTS "${name}"`);
        rmSync(probe, { recursive: true, force: true });
        rmSync(heldRelease, { recursive: true, force: true });
        rmSync(heldRepair, { recursive: true, force: true });
    }
});
