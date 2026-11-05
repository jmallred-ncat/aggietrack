import assert from "node:assert/strict";
import { test } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ScreenshotView } from "./screenshot-rules";

test("a recorded run shows its screenshots next to the evidence text", async () => {
  // The shared UI package has no tsconfig, so its JSX compiles to the classic runtime.
  (globalThis as { React?: typeof React }).React = React;
  const { TestLab } = await import("../components/test-lab");
  const screenshots: ScreenshotView[] = [
    { id: "shot-1", testId: "T-36", historySequence: null, fileName: "restore.png", kind: "PNG" },
    { id: "shot-2", testId: "T-36", historySequence: 8, fileName: "compare.webp", kind: "WebP" },
  ];
  const html = renderToStaticMarkup(createElement(TestLab, {
    draft: {
      Status: "Pass",
      Tester: "James Allred",
      "Run date": "2026-11-04",
      "Run / build / environment": "Preview",
      "Evidence reference": "notes/restore.log",
      "Actual result": "The restored plans opened.",
    },
    related: [],
    screenshots,
    onUpdate: () => undefined,
    onExecute: () => undefined,
  }));
  assert.match(html, /Pass/);
  assert.match(html, /James Allred/);
  assert.match(html, /November 4, 2026/);
  assert.match(html, /Preview/);
  assert.match(html, /Evidence reference: notes\/restore\.log/);
  assert.match(html, /aria-label="View restore\.png"/);
  assert.match(html, /src="\/api\/executions\/screenshots\/shot-1"/);
  assert.match(html, /aria-label="View compare\.webp"/);
  assert.match(html, /src="\/api\/executions\/screenshots\/shot-2"/);
  assert.equal(html.includes("Delete"), false);
});
