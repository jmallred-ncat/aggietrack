"use client";

import { useState } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { idForms, normalizeId, parseLinks } from "@/lib/links";

export type LinkOption = { id: string; label: string; archived: boolean };

export function LinkPicker({ id, label, value, options, onChange, onCreate }: { id: string; label: string; value: string; options: LinkOption[]; onChange: (value: string) => void; onCreate?: (query: string) => void }) {
  const [query, setQuery] = useState("");
  const selected = parseLinks(value);
  const byId = new Map(options.map(option => [option.id, option]));
  const items = [...new Set([...options.filter(option => !option.archived || selected.includes(option.id)).map(option => option.id), ...selected])];

  return <div className="space-y-2">
    {selected.length > 0 && <div className="flex flex-wrap gap-1.5">{selected.map(item => <span key={item} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs">{item}{byId.get(item)?.archived ? " · archived" : ""}<button type="button" className="text-muted-foreground" aria-label={`Remove ${item}`} onClick={() => onChange(selected.filter(current => current !== item).join(", "))}>×</button></span>)}</div>}
    <Combobox.Root multiple items={items} value={selected} onValueChange={next => onChange(next.join(", "))} onInputValueChange={setQuery} filter={(item, query) => { const needle = query.trim(); if (!needle) return true; const canonical = normalizeId(needle); if (canonical !== needle || /^(?:NFR|FR|[TDQGR])-?\d+$/i.test(needle)) return normalizeId(item) === canonical; const option = byId.get(item); return `${idForms(item)} ${option?.label ?? ""}`.toLowerCase().includes(needle.toLowerCase()); }} itemToStringLabel={item => { const option = byId.get(item); return option ? `${idForms(option.id)} ${option.label}` : idForms(item); }}>
      <Combobox.Input id={id} aria-label={label} placeholder={`Search ${label.toLowerCase()}`} className="h-8 w-full rounded-lg border bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"/>
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} className="z-50">
          <Combobox.Popup className="max-h-64 w-(--anchor-width) min-w-72 origin-(--transform-origin) overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10">
            <Combobox.Empty className="px-2 py-2 text-sm text-muted-foreground">
              <p>No records match.</p>
              {onCreate && <button type="button" className="mt-2 w-full rounded-md px-2 py-1.5 text-left text-sm font-medium text-foreground hover:bg-accent" onMouseDown={event => event.preventDefault()} onClick={() => onCreate(query)}>Create defect</button>}
            </Combobox.Empty>
            <Combobox.List>
              {(item: string) => <Combobox.Item key={item} value={item} className="flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"><span className="shrink-0 font-semibold">{item}</span><span className="min-w-0 truncate text-muted-foreground">{byId.get(item)?.label}</span></Combobox.Item>}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  </div>;
}
