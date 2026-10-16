"use client";

import { useState } from "react";
import { Button } from "@aggietrack/ui/button";
import { Input } from "@aggietrack/ui/input";
import { joinItems, joinSteps, parseItems, parseSteps } from "@/lib/fields";

export function ItemList({ id, label, value, ordered, onChange }: { id: string; label: string; value: string; ordered: boolean; onChange: (value: string) => void }) {
  const [entry, setEntry] = useState("");
  const items = ordered ? parseSteps(value) : parseItems(value);
  const write = (next: string[]) => onChange(ordered ? joinSteps(next) : joinItems(next));

  function add() {
    const item = entry.trim();
    if (!item) return;
    write([...items, item]);
    setEntry("");
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    write(next);
  }

  return <div className="space-y-2">
    {items.length > 0 && <ol className="space-y-1.5">
      {items.map((item, index) => <li key={`${index}-${item}`} className="flex items-start gap-2 rounded-lg border bg-background px-2 py-1.5">
        {ordered && <span className="mt-0.5 w-5 shrink-0 text-xs text-muted-foreground">{index + 1}.</span>}
        <span className="min-w-0 flex-1 text-sm leading-5">{item}</span>
        <span className="flex shrink-0 gap-1">
          {ordered && <Button type="button" variant="ghost" size="xs" disabled={index === 0} onClick={() => move(index, -1)}>Up</Button>}
          {ordered && <Button type="button" variant="ghost" size="xs" disabled={index === items.length - 1} onClick={() => move(index, 1)}>Down</Button>}
          <Button type="button" variant="ghost" size="xs" onClick={() => write(items.filter((_, current) => current !== index))}>Remove</Button>
        </span>
      </li>)}
    </ol>}
    <div className="flex gap-2">
      <Input id={id} value={entry} placeholder={`Add ${label.toLowerCase()}`} onChange={event => setEntry(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); add(); } }}/>
      <Button type="button" variant="outline" onClick={add}>Add</Button>
    </div>
  </div>;
}
