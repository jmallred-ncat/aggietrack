import Link from "next/link";
import { Badge } from "@aggietrack/ui/badge";
import { myWork, type Assignment } from "@/lib/assignments";
import type { Workspace } from "@/lib/model";

export function YourWork({ workspace, user }: { workspace: Workspace; user: { name: string; email: string; organizationRole: string; responsibilities: string } }) {
  const work = myWork(workspace, user);
  return <div className="not-typeset space-y-10">
    <div>
      <h1 className="text-2xl font-semibold">Your work</h1>
      <p className="mt-1 text-sm text-muted-foreground">{[user.name, user.organizationRole].filter(Boolean).join(" · ")}</p>
      {user.responsibilities && <p className="mt-2 max-w-2xl text-sm leading-6">{user.responsibilities}</p>}
    </div>
    <WorkSection title="Test cases" items={work.tests}/>
    <WorkSection title="Defects" items={work.defects}/>
    <WorkSection title="Risks & decisions" items={work.decisions}/>
  </div>;
}

function WorkSection({ title, items }: { title: string; items: Assignment[] }) {
  return <section>
    <h2 className="font-semibold">{title}</h2>
    {items.length > 0 ? <ul className="mt-3 divide-y overflow-hidden rounded-xl border bg-background">{items.map(item => <li key={item.href}>
      <Link href={item.href} className="flex items-start justify-between gap-4 px-4 py-3 hover:bg-muted">
        <span className="min-w-0">
          <span className="font-semibold">{item.id}</span>
          <span className="mt-1 block text-sm leading-6 text-muted-foreground">{item.title}</span>
          {(item.weight || item.reviewerOnly) && <span className="mt-1 block text-xs text-muted-foreground">{item.reviewerOnly ? "Reviewer" : item.weight}</span>}
        </span>
        {item.status && <Badge variant="secondary" className="shrink-0">{item.status}</Badge>}
      </Link>
    </li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">None assigned to you.</p>}
  </section>;
}
