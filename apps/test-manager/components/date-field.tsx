"use client";

import { useState } from "react";
import { Calendar } from "@aggietrack/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@aggietrack/ui/popover";

function parseStoredDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return undefined;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[3])) return undefined;
  return date;
}

function storeDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function displayDate(value: string) {
  const date = parseStoredDate(value);
  if (!date) return value;
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function DateField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = parseStoredDate(value);
  const shown = selected ? displayDate(value) : value.trim() ? value : "Choose a date";

  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger id={id} type="button" aria-label={label} className="flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-left text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
      <span className={selected || value.trim() ? undefined : "text-muted-foreground"}>{shown}</span>
      <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4 shrink-0 text-muted-foreground"><rect x="2" y="3" width="12" height="11" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4"/><path d="M2 6.5h12M5 2v3M11 2v3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-auto p-2">
      <Calendar mode="single" selected={selected} defaultMonth={selected} onSelect={date => { onChange(date ? storeDate(date) : ""); setOpen(false); }}/>
      {value.trim() && <button type="button" className="mt-1 w-full rounded-md px-2 py-1 text-left text-sm text-muted-foreground hover:bg-muted" onClick={() => { onChange(""); setOpen(false); }}>Clear date</button>}
    </PopoverContent>
  </Popover>;
}
