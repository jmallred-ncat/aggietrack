"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@aggietrack/ui/badge";
import { decisionFilters, decisionLabel, myWork, type Assignment } from "@/lib/assignments";
import type { Workspace } from "@/lib/model";

export function YourWork({ workspace, user }: { workspace: Workspace; user: { name: string; email: string; organizationRole: string; responsibilities: string } }) {
  const work = myWork(workspace, user);
  const [decisionStatus, setDecisionStatus] = useState("");
  const decisions = decisionStatus ? work.decisions.filter(item => item.status === decisionStatus) : work.decisions;
  const selected = decisionFilters.find(filter => filter.status === decisionStatus);

  return <div className="not-typeset space-y-10">
    <div>
      <h1 className="text-2xl font-semibold">Your work</h1>
      <p className="mt-1 text-sm text-muted-foreground">{[user.name, user.organizationRole].filter(Boolean).join(" · ")}</p>
      {user.responsibilities && <p className="mt-2 max-w-2xl text-sm leading-6">{user.responsibilities}</p>}
    </div>
    <section aria-label="Risk and decision counts">
      <h2 className="font-semibold">Risks & decisions</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {decisionFilters.map(filter => {
          const count = work.decisions.filter(item => item.status === filter.status).length;
          const pressed = decisionStatus === filter.status;
          return <button key={filter.status} type="button" aria-pressed={pressed} onClick={() => setDecisionStatus(pressed ? "" : filter.status)} className={`rounded-xl border bg-background px-4 py-3 text-left hover:bg-muted ${pressed ? "border-primary ring-2 ring-primary/30" : ""}`}>
            <span className="block text-sm text-muted-foreground">{filter.label}</span>
            <span className="mt-1 block text-4xl font-semibold leading-none tabular-nums">{count}</span>
            <span className="mt-2 block text-xs text-muted-foreground">{filter.detail}</span>
          </button>;
        })}
      </div>
    </section>
    <WorkSection title="Test cases" items={work.tests}/>
    <WorkSection title="Defects" items={work.defects}/>
    <WorkSection title="Risks & decisions" items={decisions} empty={work.decisions.length === 0 ? "None assigned to you." : `No ${selected?.label.toLowerCase()} decisions assigned to you.`} action={decisionStatus ? <button type="button" className="text-sm text-primary underline-offset-4 hover:underline" onClick={() => setDecisionStatus("")}>Show all</button> : null}/>
  </div>;
}

function WorkSection({ title, items, empty = "None assigned to you.", action = null }: { title: string; items: Assignment[]; empty?: string; action?: ReactNode }) {
  return <section>
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-semibold">{title}</h2>
      {action}
    </div>
    {items.length > 0 ? <ul className="mt-3 divide-y overflow-hidden rounded-xl border bg-background">{items.map(item => <li key={item.href}>
      <Link href={item.href} className="flex items-start justify-between gap-4 px-4 py-3 hover:bg-muted">
        <span className="min-w-0">
          <span className="font-semibold">{item.id}</span>
          <span className="mt-1 block text-sm leading-6 text-muted-foreground">{item.title}</span>
          {(item.weight || item.reviewerOnly) && <span className="mt-1 block text-xs text-muted-foreground">{item.reviewerOnly ? "Reviewer" : item.weight}</span>}
        </span>
        {item.status && <Badge variant={item.status === "Approved" ? "outline" : "secondary"} className="shrink-0">{decisionLabel(item.status)}</Badge>}
      </Link>
    </li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">{empty}</p>}
  </section>;
}
