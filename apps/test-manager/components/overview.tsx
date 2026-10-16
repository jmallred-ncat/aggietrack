import Link from "next/link";
import { Badge } from "@aggietrack/ui/badge";
import { Card, CardContent, CardDescription, CardHeader } from "@aggietrack/ui/card";
import { Progress } from "@aggietrack/ui/progress";
import { coverage, testStatuses, type Workspace } from "@/lib/model";
import { normalizeId } from "@/lib/links";
import { recordPath } from "@/lib/sections";
import { TermHelp } from "@/components/term-help";

export function Overview({ workspace }: { workspace: Workspace }) {
  const tests = workspace.sections.find(section => section.name === "Tests")!.rows.filter(row => !row.archived);
  const requirements = workspace.sections.find(section => section.name === "Traceability")!.rows.filter(row => /^(?:FR|NFR)-\d+$/.test(normalizeId(row.id)) && !row.archived);
  const defects = workspace.sections.find(section => section.name === "Defects")!.rows.filter(row => !row.archived);
  const risks = workspace.sections.find(section => section.name === "Risks & Decisions")!.rows.filter(row => !row.archived);
  const openDefects = defects.filter(row => row.values.Status !== "Closed");
  const openDecisions = risks.filter(row => normalizeId(row.id).startsWith("Q-") && row.values.Status === "Open");
  const findings = risks.filter(row => normalizeId(row.id).startsWith("G-")).length;

  return <>
    <div className="not-typeset mb-6">
      <h1 className="text-2xl font-semibold">Overview</h1>
      <p className="mt-1 text-sm text-muted-foreground">Execution progress and acceptance coverage. Open a requirement or a case for its dashboard.</p>
    </div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {testStatuses.map(verdict => <Card key={verdict} className="not-typeset"><CardContent><p className="flex items-center gap-1 text-sm text-muted-foreground">{verdict}<TermHelp section="Tests" label={verdict}/></p><p className="mt-1 text-4xl font-semibold leading-none tabular-nums">{tests.filter(test => test.values.Status === verdict).length}</p></CardContent></Card>)}
    </div>
    <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
      <Card className="not-typeset">
        <CardHeader>
          <h2 className="font-heading text-base leading-snug font-medium">Requirement coverage</h2>
          <CardDescription>{requirements.length} requirements / {tests.length} test cases</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid items-stretch gap-3 sm:grid-cols-2">
            {requirements.map(requirement => {
              const result = coverage(requirement, tests);
              const summary = requirement.values["Baseline requirement (faithful summary)"];
              return <Link key={requirement.id} href={recordPath("Traceability", requirement.id)} className="flex h-full flex-col rounded-lg border bg-background p-3 hover:bg-muted">
                <div className="flex items-center justify-between gap-2 text-sm"><span className="font-semibold">{normalizeId(requirement.id)}</span><Badge variant="secondary" className="shrink-0">{result.state}</Badge></div>
                <p className="mt-2 line-clamp-2 h-[2lh] text-sm leading-snug text-muted-foreground" title={summary}>{summary}</p>
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground">{result.passed} / {result.mapped.length} passed</p>
                  <Progress aria-label={`${normalizeId(requirement.id)} tests passed`} className="mt-2 gap-0" max={Math.max(1, result.mapped.length)} value={result.passed}/>
                </div>
              </Link>;
            })}
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4">
        <Card className="not-typeset">
          <CardHeader>
            <h2 className="font-heading text-base leading-snug font-medium">Needs attention</h2>
            <CardDescription>Each count opens the queue for that work.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <AttentionLink href="/defects" count={openDefects.length} label="Open defects" detail="Update disposition"/>
            <AttentionLink href="/risks" count={openDecisions.length} label="Unresolved decisions" detail="Record an outcome"/>
            <div className="flex items-center gap-3 rounded-lg bg-muted px-3 py-3">
              <span className="w-10 text-2xl font-semibold leading-none tabular-nums">{findings}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-sm font-medium">Static findings<TermHelp section="Risks & Decisions" label="Static findings"/></span>
                <span className="block text-xs text-muted-foreground">Kept out of pass and fail counts</span>
              </span>
            </div>
          </CardContent>
        </Card>
        <Card className="not-typeset bg-muted/60">
          <CardHeader>
            <h2 className="font-heading text-base leading-snug font-medium">Execution standard</h2>
            <CardDescription>Record these on the test case before you leave the run.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li>Observed result</li>
              <li>Tester and run date</li>
              <li>Build, environment, and evidence</li>
            </ul>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">Previous results stay in that case’s history.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  </>;
}

function AttentionLink({ href, count, label, detail }: { href: string; count: number; label: string; detail: string }) {
  return <Link href={href} className="flex items-center gap-3 rounded-lg border bg-background px-3 py-3 hover:bg-muted">
    <span className="w-10 text-2xl font-semibold leading-none tabular-nums">{count}</span>
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-medium">{label}</span>
      <span className="block text-xs text-muted-foreground">{detail}</span>
    </span>
    <span aria-hidden className="text-sm text-muted-foreground">→</span>
  </Link>;
}
