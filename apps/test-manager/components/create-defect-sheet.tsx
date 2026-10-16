"use client";

import { useState } from "react";
import { Button } from "@aggietrack/ui/button";
import { Field, FieldLabel } from "@aggietrack/ui/field";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@aggietrack/ui/sheet";
import { Textarea } from "@aggietrack/ui/textarea";
import { ChoiceSelect } from "@/components/choice-select";
import { normalizeId } from "@/lib/links";

const severities = ["Critical", "High", "Medium", "Low"];

export function nextDefectId(ids: string[]) {
  const next = Math.max(0, ...ids.map(id => Number(/^D-(\d+)$/.exec(normalizeId(id))?.[1] ?? 0))) + 1;
  return normalizeId(`D${next}`);
}

export function CreateDefectSheet({ query, ids, headers, testId, finder, onOpenChange, onCreated }: { query: string; ids: string[]; headers: string[]; testId?: string; finder: string; onOpenChange: (open: boolean) => void; onCreated: (id: string, summary: string) => void }) {
  const id = nextDefectId(ids);
  const [summary, setSummary] = useState(/^(?:NFR|FR|[TDQGR])-?\d+$/i.test(query.trim()) ? "" : query.trim());
  const [severity, setSeverity] = useState("Medium");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const values = Object.fromEntries(headers.map(header => [header, ""]));
    values["Defect ID"] = id;
    values.Summary = summary.trim();
    values.Severity = severity;
    values.Status = "New";
    values["Found by"] = finder;
    if (testId) values["Test / requirement IDs"] = testId;
    try {
      const response = await fetch("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ section: "Defects", id, values, revision: null }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to create the defect.");
      onCreated(id, values.Summary);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create the defect.");
      setSaving(false);
    }
  }

  return <Sheet open onOpenChange={onOpenChange}>
    <SheetContent className="sm:max-w-md">
      <SheetHeader>
        <SheetTitle>New defect</SheetTitle>
        <SheetDescription>{testId ? `${id} is linked to ${testId} and selected on this test.` : `${id} is selected on this test.`}</SheetDescription>
      </SheetHeader>
      <form onSubmit={create} className="flex flex-1 flex-col gap-4 px-4">
        <Field>
          <FieldLabel htmlFor="new-defect-id">Defect ID</FieldLabel>
          <p id="new-defect-id" className="text-sm font-semibold">{id}</p>
        </Field>
        <Field>
          <FieldLabel htmlFor="new-defect-finder">Found by</FieldLabel>
          <p id="new-defect-finder" className="text-sm">{finder}</p>
        </Field>
        <Field>
          <FieldLabel htmlFor="new-defect-summary">Summary</FieldLabel>
          <Textarea id="new-defect-summary" required rows={4} value={summary} onChange={event => setSummary(event.target.value)}/>
        </Field>
        <Field>
          <FieldLabel htmlFor="new-defect-severity">Severity</FieldLabel>
          <ChoiceSelect id="new-defect-severity" label="Severity" value={severity} options={severities} onChange={setSeverity} className="w-full bg-background"/>
        </Field>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <SheetFooter className="px-0">
          <Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create defect"}</Button>
        </SheetFooter>
      </form>
    </SheetContent>
  </Sheet>;
}
