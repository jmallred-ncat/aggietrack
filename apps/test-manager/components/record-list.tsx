"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@aggietrack/ui/badge";
import { Button } from "@aggietrack/ui/button";
import { buttonVariants } from "@aggietrack/ui/button";
import { Card, CardContent } from "@aggietrack/ui/card";
import { Input } from "@aggietrack/ui/input";
import { ChoiceSelect } from "@/components/choice-select";
import type { RecordRow, Section } from "@/lib/model";
import { listColumns, listDescriptions, recordPath, sectionByName } from "@/lib/sections";
import { normalizeId } from "@/lib/links";

const choices: Record<string, string[]> = { Priority: ["High", "Medium", "Low"], Severity: ["Critical", "High", "Medium", "Low"] };

function PlanCard({ section, row }: { section: string; row: RecordRow }) {
  return <Link href={recordPath(section, row.id)} className="block"><Card className="not-typeset"><CardContent><div className="flex items-center justify-between gap-2"><h2 className="font-semibold">{normalizeId(row.id)}</h2>{row.archived && <Badge variant="secondary">Archived</Badge>}</div><p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{row.values["Plan and process"]}</p></CardContent></Card></Link>;
}

export function RecordList({ section }: { section: Section }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const columns = listColumns[section.name];
  const nav = sectionByName(section.name);
  const archivedCount = section.rows.filter(row => row.archived).length;
  const pool = section.rows.filter(row => includeArchived || !row.archived);
  const shown = pool.filter(row => Object.values(row.values).join(" ").toLowerCase().includes(query.toLowerCase()) && (!status || row.values.Status === status) && (!priority || row.values.Priority === priority || row.values.Severity === priority));
  const statuses = Array.from(new Set(section.rows.map(row => row.values.Status))).filter(Boolean);

  return <>
    <div className="not-typeset mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold">{nav?.label ?? section.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{listDescriptions[section.name]}</p>
      </div>
      {section.name === "Tests" && <Link href="/tests/new" className={buttonVariants()}>Add test case</Link>}
      {section.name === "Defects" && <Link href="/defects/new" className={buttonVariants()}>Add defect</Link>}
    </div>
    <div className="mb-4 flex flex-wrap gap-3">
      <Input aria-label="Search records" placeholder="Search IDs, titles, owners, or any detail…" value={query} onChange={event => setQuery(event.target.value)} className="max-w-md bg-background"/>
      {section.headers.includes("Status") && <ChoiceSelect label="Filter by status" value={status} emptyLabel="All statuses" options={statuses} onChange={setStatus} className="bg-background"/>}
      {["Tests", "Defects"].includes(section.name) && <ChoiceSelect label={section.name === "Tests" ? "Filter by priority" : "Filter by severity"} value={priority} emptyLabel={section.name === "Tests" ? "All priorities" : "All severities"} options={section.name === "Tests" ? choices.Priority : choices.Severity} onChange={setPriority} className="bg-background"/>}
      {archivedCount > 0 && <Button type="button" variant="outline" aria-pressed={includeArchived} onClick={() => setIncludeArchived(current => !current)}>{includeArchived ? "Hide archived" : `Show archived (${archivedCount})`}</Button>}
    </div>
    <p className="mb-3 text-xs text-muted-foreground">{shown.length} of {pool.length} records</p>
    {section.name === "Test Plan" ? <PlanCards section={section.name} rows={shown}/> : <RecordTable section={section.name} columns={columns} rows={shown}/>}
  </>;
}

function PlanCards({ section, rows }: { section: string; rows: RecordRow[] }) {
  return <div className="grid gap-3">
    {rows.map(row => <PlanCard key={row.id} section={section} row={row}/>)}
    {rows.length === 0 && <p className="p-10 text-center text-muted-foreground">No records match these filters.</p>}
  </div>;
}

function RecordTable({ section, columns, rows }: { section: string; columns: string[]; rows: RecordRow[] }) {
  return <div className="overflow-x-auto rounded-xl border bg-background">
    <table className="w-full text-left text-sm">
      <thead className="border-b bg-muted/50"><tr>{columns.map(header => <th className="px-4 py-3 font-medium" key={header}>{header === "Owner" && section === "Defects" ? "Assigned to" : header}</th>)}</tr></thead>
      <tbody>
        {rows.map(row => <RecordCells key={row.id} section={section} columns={columns} row={row}/>)}
      </tbody>
    </table>
    {rows.length === 0 && <p className="p-10 text-center text-muted-foreground">No records match these filters.</p>}
  </div>;
}

function RecordCells({ section, columns, row }: { section: string; columns: string[]; row: RecordRow }) {
  return <tr className="border-b last:border-0 hover:bg-muted/30">
    {columns.map((header, index) => <td key={header} className={`px-4 py-3 align-top ${index === 1 ? "min-w-64" : ""}`}>{cell(section, header, index, row)}</td>)}
  </tr>;
}

function cell(section: string, header: string, index: number, row: RecordRow) {
  if (index === 0) return <span className="inline-flex items-center gap-2"><Link className="font-semibold text-primary underline-offset-4 hover:underline" href={recordPath(section, row.id)}>{normalizeId(row.values[header] || row.id)}</Link>{row.archived ? <Badge variant="secondary">Archived</Badge> : null}</span>;
  if (header === "Status" || header === "Seed status" || header === "Coverage state") return <Badge variant="secondary">{row.values[header] || "—"}</Badge>;
  return row.values[header] || "—";
}
