"use client";

import { Popover, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger } from "@aggietrack/ui/popover";
import { explain } from "@/lib/guide";

export function TermHelp({ section, label }: { section: string; label: string }) {
  const entry = explain(section, label);
  if (!entry) return null;
  return <Popover>
    <PopoverTrigger type="button" aria-label={`Explain ${label}`} className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">?</PopoverTrigger>
    <PopoverContent align="start" className="w-80">
      <PopoverTitle>{entry.term}</PopoverTitle>
      <PopoverDescription className="leading-5">{entry.plain}</PopoverDescription>
    </PopoverContent>
  </Popover>;
}
