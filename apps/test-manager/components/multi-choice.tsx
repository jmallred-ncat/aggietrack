"use client";

import { joinSeparated, splitSeparated } from "@/lib/fields";

type Option = { value: string; label: string };

export function MultiChoice({ id, value, options, exclusive, separator, onChange }: { id: string; value: string; options: Option[]; exclusive?: string; separator: string; onChange: (value: string) => void }) {
  const selected = splitSeparated(value, separator);
  const known = new Set([...(exclusive ? [exclusive] : []), ...options.map(option => option.value)]);
  const extras = selected.filter(item => !known.has(item)).map(item => ({ value: item, label: item }));
  const choices = [...options, ...extras];

  function toggle(option: string) {
    if (exclusive && option === exclusive) {
      onChange(selected.length === 1 && selected[0] === exclusive ? "" : exclusive);
      return;
    }
    const current = selected.filter(item => item !== exclusive);
    const next = current.includes(option) ? current.filter(item => item !== option) : [...current, option];
    onChange(joinSeparated(next, separator, choices.map(item => item.value)));
  }

  return <div role="group" aria-labelledby={id} className="grid gap-1.5">
    {exclusive && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selected.length === 1 && selected[0] === exclusive} onChange={() => toggle(exclusive)}/>{exclusive}</label>}
    {choices.map(option => <label key={option.value} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selected.includes(option.value)} onChange={() => toggle(option.value)}/>{option.label}</label>)}
  </div>;
}
