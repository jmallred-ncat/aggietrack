import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
    planNoteTimestamp,
    planNoteTimestampTitle,
    presentPlanNote,
    type PresentedNote,
} from "../lib/plan-notes";

const require = createRequire(import.meta.resolve("tsx/package.json"));
const esbuild = require("esbuild") as { build: (options: Record<string, unknown>) => Promise<void> };
const cacheDirectory = path.join(process.cwd(), "node_modules/.cache");
mkdirSync(cacheDirectory, { recursive: true });
const bundleDirectory = mkdtempSync(path.join(cacheDirectory, "plan-notes-view-"));
const bundlePath = path.join(bundleDirectory, "view.mjs");
await esbuild.build({
    absWorkingDir: process.cwd(),
    entryPoints: ["components/plan-notes-view.tsx"],
    bundle: true,
    format: "esm",
    platform: "node",
    jsx: "automatic",
    outfile: bundlePath,
    tsconfig: "tsconfig.json",
    external: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
});
const { PlanNotesView } = await import(pathToFileURL(bundlePath).href) as typeof import("./plan-notes-view");

const urlStem = "https://catalog.example.edu/programs/information-technology/";
const longUrl = `${urlStem}${"a".repeat(120 - urlStem.length)}`;
const longNote = [
    "I am unable to add MATH 110. This plan aligns with the degree outline, but the section I need is missing from the registration search.",
    "",
    "The lab also conflicts with my work schedule on Tuesdays. Please look at a later section or a different elective that still covers this requirement.",
    "",
    "I can meet after class if that helps.",
].join("\n");

function note(input: {
    id: string;
    body: string;
    kind: string;
    createdAt: string;
    authorName: string;
    authorRole: string;
}): PresentedNote {
    return presentPlanNote({
        ...input,
        createdAt: new Date(input.createdAt),
    });
}

function render(node: ReactElement) {
    return renderToStaticMarkup(node);
}

function view(notes: PresentedNote[], audience: "student" | "advisor", extra: { canCompose?: boolean; earlierCursor?: string | null } = {}) {
    return render(createElement(PlanNotesView, {
        plannedTermId: "plan-1",
        audience,
        advisorAssigned: true,
        notes,
        earlierCursor: extra.earlierCursor ?? null,
        highlightId: "return-written",
        draft: "",
        pending: false,
        mode: null,
        alert: null,
        canCompose: extra.canCompose,
        onDraftChange: () => undefined,
        onPost: () => undefined,
        onLoadEarlier: () => undefined,
    }));
}

const thread = [
    note({
        id: "submit",
        body: "",
        kind: "SUBMISSION",
        createdAt: "2026-11-06T04:26:00.000Z",
        authorName: "Avery Cole",
        authorRole: "STUDENT",
    }),
    note({
        id: "long",
        body: longNote,
        kind: "NOTE",
        createdAt: "2026-11-06T04:40:00.000Z",
        authorName: "Avery Cole",
        authorRole: "STUDENT",
    }),
    note({
        id: "url",
        body: longUrl,
        kind: "NOTE",
        createdAt: "2026-11-06T04:41:00.000Z",
        authorName: "Avery Cole",
        authorRole: "STUDENT",
    }),
    note({
        id: "return-event",
        body: "",
        kind: "RETURN",
        createdAt: "2026-11-07T00:10:00.000Z",
        authorName: "Sarah Martinez",
        authorRole: "ADVISOR",
    }),
    note({
        id: "return-written",
        body: "The issue with MATH 110 should be resolved. Add that to the registration and send it again for approval.",
        kind: "RETURN",
        createdAt: "2026-11-07T00:15:00.000Z",
        authorName: "Sarah Martinez",
        authorRole: "ADVISOR",
    }),
    note({
        id: "caption",
        body: "Plan submitted for review",
        kind: "NOTE",
        createdAt: "2026-11-07T00:20:00.000Z",
        authorName: "Avery Cole",
        authorRole: "STUDENT",
    }),
    note({
        id: "approve",
        body: "",
        kind: "APPROVAL",
        createdAt: "2026-11-07T00:30:00.000Z",
        authorName: "Sarah Martinez",
        authorRole: "ADVISOR",
    }),
];

test("the thread keeps written notes, status, and empty workflow events apart", () => {
    assert.equal(longUrl.length, 120);
    const html = view(thread, "student");
    assert.match(html, /You and your advisor can read these notes\./);
    assert.match(html, /<ol/);
    assert.match(html, /divide-y/);
    assert.match(html, /divide-border/);
    assert.match(html, /data-align="start"/);
    assert.doesNotMatch(html, /data-align="end"/);
    assert.match(html, /Avery Cole<\/span> submitted the plan/);
    assert.match(html, /Sarah Martinez<\/span> approved the plan/);
    assert.match(html, /Sarah Martinez<\/span> requested changes/);
    assert.equal(html.match(/data-slot="message"/g)?.length, 4);
    assert.match(html, /whitespace-pre-wrap/);
    assert.match(html, /\[overflow-wrap:anywhere\]/);
    assert.match(html, /md:max-w-prose/);
    assert.match(html, new RegExp(longUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(html, /id="latest-return-note"/);

    const status = html.slice(html.indexOf('id="latest-return-note"'));
    const headerStart = status.indexOf('data-slot="message-header"');
    const header = status.slice(headerStart, status.indexOf("</div>", headerStart));
    assert.match(header, /Sarah Martinez/);
    assert.match(header, /Advisor/);
    assert.match(header, /Changes requested/);
    assert.doesNotMatch(header, /MATH 110 should be resolved/);
    assert.match(status, /text-sm font-semibold leading-5 text-foreground/);
    assert.match(status, /whitespace-pre-wrap/);

    const submittedAt = "2026-11-06T04:26:00.000Z";
    const times = html.match(/<time\b[^>]*>/g) ?? [];
    assert.ok(times.length >= 7);
    assert.ok(times.every((tag) => tag.includes("whitespace-nowrap")));
    assert.match(html, new RegExp(`dateTime="${submittedAt}"`));
    assert.match(html, new RegExp(`title="${planNoteTimestampTitle(submittedAt)}"`));
    assert.match(html, new RegExp(planNoteTimestamp(submittedAt)!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.equal((html.match(/Plan submitted for review/g) ?? []).length, 1);
    assert.match(html, /min-h-20/);
    assert.match(html, /my-6/);
    assert.match(html, /Post note/);
    assert.match(html, /Add a note/);
    assert.doesNotMatch(html, />You</);
});

test("advisor copy, an empty thread, and a hidden composer follow the same card", () => {
    const advisor = view(thread, "advisor");
    assert.match(advisor, /You and the student can read these notes\./);
    assert.match(advisor, /Avery Cole/);
    const empty = view([], "student");
    assert.match(empty, /No notes yet\./);
    assert.match(empty, /py-2/);
    assert.match(empty, /my-6/);
    assert.match(empty, /<textarea/);
    const quiet = view([], "advisor", { canCompose: false });
    assert.match(quiet, /You and the student can read these notes\./);
    assert.match(quiet, /No notes yet\./);
    assert.doesNotMatch(quiet, /my-6/);
    assert.doesNotMatch(quiet, /<textarea/);
    assert.match(quiet, /pb-4/);
    const earlier = view(thread.slice(0, 1), "student", { earlierCursor: "2026-11-06T04:26:00.000Z|submit" });
    assert.match(earlier, /Load earlier notes/);
});
