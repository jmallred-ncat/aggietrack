import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { getMigrateUrl } from "../prisma/migrate-url";
import { migrateDatabaseName, migrateEnvForScratch, openAdvisingTestClient, resolveAdvisingTestTarget } from "./advising-test-target";

const scratch = "postgresql://local:local@127.0.0.1:5432/aggietrack_ui_review4";
const handsOn = "postgresql://local:local@127.0.0.1:5432/aggietrack_agt17";

test("an unset advising target does not connect or write", () => {
    let connections = 0;
    const target = resolveAdvisingTestTarget({});
    assert.equal(target.ok, false);
    const client = openAdvisingTestClient(target, () => {
        connections += 1;
        return { wrote: true };
    });
    assert.equal(client, null);
    assert.equal(connections, 0);
});

test("a protected or non-scratch target is rejected before connection", () => {
    const rejected = [
        handsOn,
        "postgresql://local:local@127.0.0.1:5432/neondb",
        "postgresql://local:local@127.0.0.1:5432/aggietrack_dev",
        "postgresql://local:local@ep-example.neon.tech/aggietrack_ui_review4",
        "postgresql://local:local@preview.internal/aggietrack_ui_review4",
        scratch,
    ];
    let connections = 0;
    const connect = () => {
        connections += 1;
        return { wrote: true };
    };
    for (const url of rejected.slice(0, -1)) {
        const target = resolveAdvisingTestTarget({ AGT17_DATABASE_URL: url, DATABASE_URL: handsOn });
        assert.equal(target.ok, false, url);
        assert.equal(openAdvisingTestClient(target, connect), null);
    }
    const sameAsApp = resolveAdvisingTestTarget({ AGT17_DATABASE_URL: scratch, DATABASE_URL: scratch });
    assert.equal(sameAsApp.ok, false);
    assert.equal(openAdvisingTestClient(sameAsApp, connect), null);
    const unpooled = resolveAdvisingTestTarget({
        AGT17_DATABASE_URL: scratch,
        DATABASE_URL: "postgresql://local:local@127.0.0.1:5432/aggietrack_other",
        DATABASE_URL_UNPOOLED: scratch,
    });
    assert.equal(unpooled.ok, false);
    assert.equal(connections, 0);
});

test("Prisma migrate prefers the unpooled URL, and the scratch env overrides that choice", () => {
    const poisoned = {
        DATABASE_URL: "postgresql://local:local@127.0.0.1:5432/aggietrack_other",
        DATABASE_URL_UNPOOLED: handsOn,
        POSTGRES_URL_NON_POOLING: handsOn,
        DIRECT_URL: handsOn,
    };
    assert.equal(migrateDatabaseName(poisoned), "aggietrack_agt17");
    assert.match(getMigrateUrl(poisoned) ?? "", /aggietrack_agt17/);
    const next = migrateEnvForScratch(scratch, poisoned);
    assert.equal(migrateDatabaseName(next), "aggietrack_ui_review4");
    assert.match(getMigrateUrl(next) ?? "", /aggietrack_ui_review4/);
    assert.equal(next.SEED_ON_DEPLOY, "false");
    assert.equal(next.POSTGRES_URL_NON_POOLING, scratch);
    const repairPreview = resolveAdvisingTestTarget({
        AGT17_DATABASE_URL: "postgresql://local:local@127.0.0.1:5432/aggietrack_repair_preview",
        DATABASE_URL: handsOn,
    });
    assert.equal(repairPreview.ok, true);
    const target = resolveAdvisingTestTarget({ ...poisoned, AGT17_DATABASE_URL: scratch });
    let connections = 0;
    const client = openAdvisingTestClient(target, (url) => {
        connections += 1;
        return url;
    });
    assert.equal(client, scratch);
    assert.equal(connections, 1);
});

test("shared dialogs keep the original layer and advising removes only its own blur", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
    const dialog = readFileSync(join(root, "packages/ui/src/components/dialog.tsx"), "utf8");
    const alertDialog = readFileSync(join(root, "packages/ui/src/components/alert-dialog.tsx"), "utf8");
    const advising = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../components/advising/meeting-dialog.tsx"), "utf8");
    for (const source of [dialog, alertDialog]) {
        assert.match(source, /supports-backdrop-filter:backdrop-blur-xs/);
        assert.match(source, /isolate z-50 bg-black\/10/);
        assert.match(source, /cn\((?:dialog|alertDialog)OverlayClassName, className\)/);
        assert.match(source, /overlayClassName === undefined \? \(/);
        assert.doesNotMatch(source, /z-\[60\]/);
        assert.doesNotMatch(source, /className \?\? /);
    }
    assert.match(advising, /overlayClassName=\{advisingOverlayClassName\}/);
    assert.match(advising, /bg-black\/70/);
    assert.match(advising, /backgroundColor: "var\(--background\)"/);
    assert.match(advising, /backgroundColor: "var\(--muted\)"/);
    assert.doesNotMatch(advising, /backdrop-blur/);
    assert.doesNotMatch(advising, /z-\[60\]/);
});

test("meeting tests return before the fixture and connect only through the target gate", () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "advising-meetings.test.ts"), "utf8");
    const returns = source.match(/if \(skip\(t\)\) return;/g) ?? [];
    const skips = source.match(/skip\(t\)/g) ?? [];
    assert.equal(returns.length, 13);
    assert.equal(skips.length, returns.length);
    assert.match(source, /if \(!target\.ok\)/);
    assert.match(source, /openAdvisingTestClient\(target/);
    assert.doesNotMatch(source, /process\.env\.DATABASE_URL/);
    assert.doesNotMatch(source, /new PrismaClient\(\{ adapter: new PrismaPg\(\{ connectionString: process\.env/);
});
