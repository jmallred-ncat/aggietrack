import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.resolve("tsx/package.json"));
const esbuild = require("esbuild") as { build: (options: Record<string, unknown>) => Promise<void> };
const cacheDirectory = path.join(process.cwd(), "node_modules/.cache");
mkdirSync(cacheDirectory, { recursive: true });
const bundleDirectory = mkdtempSync(path.join(cacheDirectory, "term-choice-"));
const bundlePath = path.join(bundleDirectory, "dialog.cjs");
await esbuild.build({
    absWorkingDir: process.cwd(),
    entryPoints: ["app/(app)/student/(started)/planner/term-choice-dialog.tsx"],
    bundle: true,
    format: "cjs",
    platform: "node",
    jsx: "automatic",
    outfile: bundlePath,
    tsconfig: "tsconfig.json",
    external: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
});
const dialog = require(bundlePath) as typeof import("./term-choice-dialog");

function markup(nextLabel: string) {
    return renderToStaticMarkup(
        <dialog.AlertDialog open>
            <div className={dialog.termChoiceContentClassName}>
                <dialog.TermChoicePanel
                    termLabel="Fall 2026"
                    nextLabel={nextLabel}
                    pending={false}
                    onDismiss={() => {}}
                    onPlanCurrent={() => {}}
                    onPlanNext={() => {}}
                />
            </div>
        </dialog.AlertDialog>,
    );
}

test("the term dialog asks one question and names the human terms", () => {
    const html = markup("Spring 2027");
    assert.match(html, /Which term do you want to plan\?/);
    assert.match(html, /You can switch terms anytime\./);
    assert.match(html, />Not now</);
    assert.match(html, />Spring 2027</);
    assert.match(html, />Fall 2026</);
    assert.doesNotMatch(html, /Are you taking courses|Plan the next|Plan Fall|FALL|SPRING|Target not set/);
    const buttons = [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map((match) => match[0]);
    assert.equal(buttons.length, 3);
    assert.match(buttons[0], /Not now/);
    assert.doesNotMatch(buttons[0], /bg-primary|border-border/);
    assert.match(buttons[1], /Spring 2027/);
    assert.match(buttons[1], /border-border/);
    assert.match(buttons[2], /Fall 2026/);
    assert.match(buttons[2], /bg-primary/);
});

test("the dialog keeps the shared alert dialog and contains the footer in the card", () => {
    const html = markup("Spring 2027, Summer I 2027, and Fall 2027");
    assert.match(html, /data-slot="alert-dialog-footer"/);
    assert.match(readFileSync(new URL("./term-choice-dialog.tsx", import.meta.url), "utf8"), /<AlertDialogContent className=\{termChoiceContentClassName\}>/);
    assert.match(html, /not-typeset/);
    assert.match(html, /@container/);
    assert.match(html, /gap-0/);
    assert.match(html, /overflow-hidden/);
    assert.match(html, /p-6/);
    assert.match(html, /pb-4/);
    assert.match(html, /gap-2/);
    assert.match(html, /px-6/);
    assert.match(html, /py-4/);
    assert.match(html, /border-t/);
    assert.match(html, /bg-muted\/50/);
    assert.match(html, /flex-col-reverse/);
    assert.match(html, /@min-\[23rem\]:flex-row/);
    assert.match(
        readFileSync(new URL("./term-choice-dialog.tsx", import.meta.url), "utf8"),
        /className="[^"]*@min-\[23rem\]:flex-row/,
    );
    assert.match(html, /data-\[size=default\]:sm:max-w-md/);
    assert.match(html, /grid-rows-none/);
    assert.doesNotMatch(html, /-mx-4|-mb-4|sm:flex-row/);
    assert.match(html, /Spring 2027, Summer I 2027, and Fall 2027/);
    assert.match(html, /whitespace-normal/);
});

test("closing still happens before the term choice is saved", () => {
    const source = readFileSync(new URL("./CurrentSemesterPrompt.tsx", import.meta.url), "utf8");
    assert.match(source, /runAfterConfirmCloses/);
    assert.match(source, /setOpen\(false\)/);
    assert.match(source, /setSaving\(true\)/);
    assert.match(source, /planCurrentSemester\(termId\)/);
    assert.match(source, /declineCurrentSemester\(termId\)/);
    assert.match(source, /Term choice not saved/);
    assert.match(source, /Opening your planner/);
    assert.doesNotMatch(source, /Are you taking courses|Plan the next term|Plan \$\{termLabel\}/);
});
