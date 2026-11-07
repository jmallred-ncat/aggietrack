import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.resolve("tsx/package.json"));
const esbuild = require("esbuild") as { build: (options: Record<string, unknown>) => Promise<void> };
const cacheDirectory = path.join(process.cwd(), "node_modules/.cache");
mkdirSync(cacheDirectory, { recursive: true });
const bundleDirectory = mkdtempSync(path.join(cacheDirectory, "course-icon-legend-"));
const bundlePath = path.join(bundleDirectory, "legend.mjs");
await esbuild.build({
    absWorkingDir: process.cwd(),
    entryPoints: ["components/course-icon-legend.tsx"],
    bundle: true,
    format: "esm",
    platform: "node",
    jsx: "automatic",
    outfile: bundlePath,
    tsconfig: "tsconfig.json",
    external: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
});
const { CourseIconLegend, CourseKindIcon, PrerequisiteMark } = await import(pathToFileURL(bundlePath).href) as typeof import("./course-icon-legend");

test("the course legend names the three marks and stays decorative", () => {
    const html = renderToStaticMarkup(CourseIconLegend());
    assert.match(html, /aria-label="Course card symbols"/);
    assert.match(html, /On each card/);
    assert.match(html, /Prerequisite or corequisite/);
    assert.match(html, />Lecture</);
    assert.match(html, />Lab</);
    assert.match(html, /flex-wrap/);
    assert.match(html, /gap-x-4/);
    assert.match(html, /gap-y-2/);
    assert.equal(html.includes("popover"), false);
    assert.equal((html.match(/aria-hidden="true"/g) ?? []).length, 3);
    assert.equal(html.includes('role="img"'), false);

    const lecture = renderToStaticMarkup(CourseKindIcon({ lab: false }));
    const lab = renderToStaticMarkup(CourseKindIcon({ lab: true }));
    const dot = renderToStaticMarkup(PrerequisiteMark({}));
    assert.match(lecture, /role="img"/);
    assert.match(lecture, /aria-label="Lecture"/);
    assert.match(lab, /aria-label="Lab"/);
    assert.match(dot, /aria-label="Has a prerequisite or corequisite"/);
    assert.match(dot, /bg-destructive/);
    assert.match(dot, /size-2/);
});

test("the dashboard does not show the course legend", () => {
    const dashboard = readFileSync("app/(app)/student/(started)/page.tsx", "utf8");
    const courses = readFileSync("app/(app)/student/(started)/courses/course-browser.tsx", "utf8");
    assert.equal(dashboard.includes("CourseIconLegend"), false);
    assert.match(courses, /<CourseIconLegend \/>/);
    assert.match(courses, /<CourseKindIcon lab=\{course\.isLab\} \/>/);
    assert.match(courses, /<PrerequisiteMark \/>/);
});
