"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aggietrack/ui/select";

type Choice = { value: string | null; label: string };

export function ChoiceSelect({ id, label, value, emptyLabel, options, onChange, className }: { id?: string; label: string; value: string; emptyLabel?: string; options: string[]; onChange: (value: string) => void; className?: string }) {
  const items: Choice[] = [
    ...(emptyLabel ? [{ value: null, label: emptyLabel }] : []),
    ...(value && !options.includes(value) ? [{ value, label: value }] : []),
    ...options.filter(Boolean).map(option => ({ value: option, label: option })),
  ];

  return <Select value={value || null} onValueChange={next => onChange(next ?? "")} items={items}>
    <SelectTrigger id={id} aria-label={label} className={className}>
      <SelectValue placeholder={emptyLabel ?? "Select"} />
    </SelectTrigger>
    <SelectContent alignItemWithTrigger={false}>
      {items.map(item => <SelectItem key={item.value ?? "none"} value={item.value}>{item.label}</SelectItem>)}
    </SelectContent>
  </Select>;
}
