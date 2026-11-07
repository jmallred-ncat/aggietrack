import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import type { DashboardHonor } from "./dashboard-tiles";

const require = createRequire(import.meta.resolve("tsx/package.json"));
const esbuild = require("esbuild") as { build: (options: Record<string, unknown>) => Promise<void> };
const cacheDirectory = path.join(process.cwd(), "node_modules/.cache");
mkdirSync(cacheDirectory, { recursive: true });
const bundleDirectory = mkdtempSync(path.join(cacheDirectory, "dashboard-tiles-"));
const bundlePath = path.join(bundleDirectory, "tiles.mjs");
await esbuild.build({
    absWorkingDir: process.cwd(),
    entryPoints: ["components/dashboard-tiles.tsx"],
    bundle: true,
    format: "esm",
    platform: "node",
    jsx: "automatic",
    outfile: bundlePath,
    tsconfig: "tsconfig.json",
    external: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
});
const { DashboardTiles, honorBadgeLabel } = await import(pathToFileURL(bundlePath).href) as typeof import("./dashboard-tiles");

function tiles(input: {
    earnedCredits?: number;
    totalCredits?: number;
    percentage?: number;
    targetLabel?: string | null;
    gpa?: number | null;
    honor?: DashboardHonor | null;
    honorEligible?: boolean;
}) {
    return renderToStaticMarkup(
        <DashboardTiles
            earnedCredits={input.earnedCredits ?? 0}
            totalCredits={input.totalCredits ?? 120}
            percentage={input.percentage ?? 0}
            targetLabel={input.targetLabel ?? null}
            gpa={input.gpa ?? null}
            honor={input.honor ?? null}
            honorEligible={input.honorEligible ?? false}
        />,
    );
}

test("honor labels stay provisional under 48 resident hours and do not claim a conferred honor", () => {
    assert.equal(honorBadgeLabel("Magna Cum Laude", true), "Magna Cum Laude pace");
    assert.equal(honorBadgeLabel("Summa Cum Laude", false), "On track for Summa Cum Laude");
    assert.equal(honorBadgeLabel(null, false), null);
    assert.equal(honorBadgeLabel(null, true), null);
});

test("an eligible honors tile shows the circle, a human target, and one pace badge", () => {
    const html = tiles({
        earnedCredits: 86,
        percentage: 71.7,
        targetLabel: "Spring 2028",
        gpa: 3.64,
        honor: "Magna Cum Laude",
        honorEligible: true,
    });
    assert.match(html, /grid-cols-1/);
    assert.match(html, /sm:grid-cols-2/);
    assert.match(html, /width:120px/);
    assert.match(html, /height:120px/);
    assert.match(html, /role="progressbar"/);
    assert.match(html, /71\.7%/);
    assert.match(html, /text-2xl/);
    assert.match(html, /86 of 120 Credits \(71\.7%\)/);
    assert.match(html, /text-xs/);
    assert.match(html, /Target: Spring 2028/);
    assert.match(html, /text-balance/);
    assert.match(html, />GPA</);
    assert.match(html, /text-3xl/);
    assert.match(html, />3\.64</);
    assert.match(html, /Magna Cum Laude pace/);
    assert.equal((html.match(/<svg/g) ?? []).length, 2);
    assert.doesNotMatch(html, /Recorded grades|No grades yet|Target not set|Behind target|On track for Spring|FALL|SPRING/);
});

test("a provisional honor uses the on-track qualifier and still shows a neutral target", () => {
    const html = tiles({
        earnedCredits: 32,
        percentage: 26.7,
        targetLabel: "Fall 2027",
        gpa: 3.61,
        honor: "Magna Cum Laude",
        honorEligible: false,
    });
    assert.match(html, /On track for Magna Cum Laude/);
    assert.match(html, /Target: Fall 2027/);
    assert.match(html, /text-muted-foreground/);
    assert.doesNotMatch(html, /Magna Cum Laude pace/);
    assert.doesNotMatch(html, /On track for Fall|Behind target/);
});

test("a GPA below the honors threshold has no badge and no negative copy", () => {
    const html = tiles({
        earnedCredits: 40,
        percentage: 33.3,
        targetLabel: "Spring 2027",
        gpa: 2.83,
        honor: null,
        honorEligible: false,
    });
    assert.match(html, />2\.83</);
    assert.match(html, /Target: Spring 2027/);
    assert.equal((html.match(/<svg/g) ?? []).length, 1);
    assert.doesNotMatch(html, /Cum Laude|On track for|Below|No GPA yet|Recorded grades/);
});

test("zero graded credits omit the GPA badge and omit a missing target", () => {
    const html = tiles({
        earnedCredits: 0,
        percentage: 0,
        targetLabel: null,
        gpa: null,
        honor: null,
        honorEligible: false,
    });
    assert.match(html, /0%/);
    assert.match(html, /0 of 120 Credits \(0%\)/);
    assert.match(html, /No GPA yet/);
    assert.match(html, /text-sm/);
    assert.equal((html.match(/<svg/g) ?? []).length, 1);
    assert.doesNotMatch(html, /Target:|Target not set|Cum Laude|Recorded grades|No grades yet/);
});
