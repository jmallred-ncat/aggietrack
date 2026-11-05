"use client";

import { useState } from "react";
import { upload } from "@vercel/blob/client";
import { Field, FieldLabel } from "@aggietrack/ui/field";
import { Input } from "@aggietrack/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@aggietrack/ui/dialog";
import { toast } from "@aggietrack/ui/toast";
import { TermHelp } from "@/components/term-help";
import { kindFromMime, kindFromName, screenshotPathname, type ScreenshotView } from "@/lib/screenshot-rules";

function source(id: string) {
  return `/api/executions/screenshots/${id}`;
}

async function payload(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text) as { error?: unknown; screenshot?: ScreenshotView }; }
  catch { return null; }
}

function failure(body: { error?: unknown } | null, fallback: string) {
  return body && typeof body.error === "string" && body.error.trim() ? body.error.trim() : fallback;
}

async function sendScreenshot(testId: string, file: File) {
  const kind = kindFromMime(file.type) ?? kindFromName(file.name);
  const contentType = file.type || (kind === "PNG" ? "image/png" : kind === "JPEG" ? "image/jpeg" : kind === "WebP" ? "image/webp" : "");
  const checked = await fetch("/api/executions/screenshots", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intent: "check", testId, fileName: file.name, contentType, byteSize: file.size }),
  });
  const checkBody = await payload(checked);
  if (!checked.ok) throw new Error(failure(checkBody, "Could not add that screenshot."));
  let pathname = screenshotPathname(testId, file.name);
  try {
    const stored = await upload(pathname, file, {
      access: "private",
      handleUploadUrl: "/api/executions/screenshots",
      clientPayload: JSON.stringify({ testId }),
      contentType,
    });
    pathname = stored.pathname;
  } catch { throw new Error("Could not add that screenshot."); }
  const saved = await fetch("/api/executions/screenshots", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intent: "save", testId, pathname, fileName: file.name }),
  });
  const savedBody = await payload(saved);
  if (!saved.ok || !savedBody?.screenshot) throw new Error(failure(savedBody, "Could not add that screenshot."));
  return savedBody.screenshot;
}

export function ScreenshotThumbs({ shots }: { shots: ScreenshotView[] }) {
  const [open, setOpen] = useState<ScreenshotView | null>(null);
  if (shots.length === 0) return null;
  return <div>
    <div className="flex flex-wrap gap-2">
      {shots.map(shot => <button key={shot.id} type="button" className="size-20 overflow-hidden rounded-md border bg-background" aria-label={`View ${shot.fileName}`} onClick={() => setOpen(shot)}>
        <img src={source(shot.id)} alt="" className="size-full object-cover"/>
      </button>)}
    </div>
    <Dialog open={open !== null} onOpenChange={next => { if (!next) setOpen(null); }}>
      <DialogContent className="sm:max-w-5xl">
        {open && <>
          <DialogHeader><DialogTitle>{open.fileName}</DialogTitle></DialogHeader>
          <img src={source(open.id)} alt={open.fileName} className="max-h-[80vh] w-full rounded-md object-contain"/>
        </>}
      </DialogContent>
    </Dialog>
  </div>;
}

export function ScreenshotField({ testId, shots, disabled, onAdded }: { testId: string; shots: ScreenshotView[]; disabled?: boolean; onAdded: (shot: ScreenshotView) => void }) {
  const [busy, setBusy] = useState(false);
  async function onChoose(event: React.ChangeEvent<HTMLInputElement>) {
    const files = [...event.target.files ?? []];
    event.target.value = "";
    if (files.length === 0) return;
    setBusy(true);
    try {
      for (const file of files) {
        try {
          onAdded(await sendScreenshot(testId, file));
          toast.add({ type: "success", title: "Screenshot added." });
        } catch (caught) {
          toast.add({ type: "error", title: caught instanceof Error && caught.message ? caught.message : "Could not add that screenshot." });
        }
      }
    } finally { setBusy(false); }
  }
  return <Field>
    <div className="flex items-center gap-1.5"><FieldLabel htmlFor="execution-screenshots">Screenshots</FieldLabel><TermHelp section="Tests" label="Screenshots"/></div>
    <Input id="execution-screenshots" type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" multiple disabled={disabled || busy} onChange={onChoose}/>
    <ScreenshotThumbs shots={shots}/>
  </Field>;
}
