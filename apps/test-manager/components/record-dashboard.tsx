"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@aggietrack/ui/badge";
import { Button } from "@aggietrack/ui/button";
import { Card, CardContent } from "@aggietrack/ui/card";
import { Field, FieldLabel } from "@aggietrack/ui/field";
import { Input } from "@aggietrack/ui/input";
import { Textarea } from "@aggietrack/ui/textarea";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@aggietrack/ui/alert-dialog";
import { ChoiceSelect } from "@/components/choice-select";
import { DateField, displayDate } from "@/components/date-field";
import { DefectRetests } from "@/components/defect-retests";
import { CreateDefectSheet } from "@/components/create-defect-sheet";
import { ItemList } from "@/components/item-list";
import { LinkPicker, type LinkOption } from "@/components/link-picker";
import { MultiChoice } from "@/components/multi-choice";
import { blankInstruction, creditChoices, decisionOwners, environmentValue, environments, gecCategories, gecExclusive, joinOwners, joinPair, normalizePerson, offeredExclusive, offeredTerms, parseOwners, presentDefectPeople, riskStatuses, seedStatuses, sourcePriorities, splitPair, testTypes } from "@/lib/fields";
import { coverage, editableSections, testStatuses, type History, type RecordRow, type Section, type Values, type Workspace } from "@/lib/model";
import { computedRequirementFields, linkTargets, normalizeId, parseLinks } from "@/lib/links";
import { memberLabel, type TeamMember } from "@/lib/members";
import { retestTests } from "@/lib/retests";
import { recordPath, sectionByName } from "@/lib/sections";
import { TermHelp } from "@/components/term-help";
import { TestLab } from "@/components/test-lab";

const choiceLists: Record<string, string[]> = { Priority: ["High", "Medium", "Low"], Severity: ["Critical", "High", "Medium", "Low"] };
const shortText = new Set(["Test ID", "Defect ID", "Retest ID", "Test / scenario", "Evidence reference", "Summary", "Fix build", "Issue / risk", "Source location"]);
const orderedLists = new Set(["Procedure", "Steps and inputs"]);
const itemLists = new Set(["Preconditions", "Inputs / data", "Evidence to retain", "Pass criterion", "Source gap or constraint"]);

function fieldLabel(header: string) {
  if (header === "Run / build / environment") return "Environment";
  if (header === "Owner") return "Assigned to";
  return header;
}

function choiceOptions(section: string, header: string, members: TeamMember[]) {
  if (header === "Assignee" || header === "Found by" || (header === "Owner" && section === "Defects")) return members.filter(member => member.emailVerified).map(memberLabel);
  if (header === "Status" && section === "Tests") return testStatuses;
  if (header === "Status" && section === "Defects") return ["New", "Open", "In progress", "Fixed", "Closed"];
  if (header === "Status" && section === "Risks & Decisions") return riskStatuses;
  if (header === "Type" && section === "Tests") return testTypes;
  if (header === "Run / build / environment") return environments;
  if (header === "Reviewer") return decisionOwners;
  if (header === "Source priority") return sourcePriorities;
  if (header === "Seed status") return seedStatuses;
  if (header === "Credits") return creditChoices;
  return choiceLists[header];
}

function prepareDraft(section: Section, values: Values) {
  const next = { ...values };
  if (next["Fix build"]?.trim() === blankInstruction) next["Fix build"] = "";
  if (next["Run / build / environment"]) next["Run / build / environment"] = environmentValue(next["Run / build / environment"]);
  if (section.name === "Risks & Decisions") {
    const review = splitPair(next["Reviewer / date"] ?? "");
    next.Reviewer = normalizePerson(next.Reviewer || review.left);
    if (!next["Review date"]) next["Review date"] = review.right;
    next["Decision owner role"] = joinOwners(parseOwners(next["Decision owner role"] ?? ""));
    next["Reviewer / date"] = joinPair(next.Reviewer ?? "", next["Review date"] ?? "");
  }
  if (section.name === "Defects") {
    Object.assign(next, presentDefectPeople(next));
    const retest = splitPair(next["Retest ID / date"] ?? "");
    if (!next["Retest ID"]) next["Retest ID"] = retest.left;
    if (!next["Retest date"]) next["Retest date"] = retest.right;
    next["Retest ID / date"] = joinPair(next["Retest ID"] ?? "", next["Retest date"] ?? "");
  }
  return next;
}

function linkedIds(value: string | undefined) {
  return parseLinks(value ?? "");
}

function present(headers: string[], names: string[]) {
  return names.filter(header => headers.includes(header));
}

function titleOf(section: string, draft: Values, id: string) {
  if (section === "Tests") return draft["Test / scenario"] || id;
  if (section === "Traceability") return draft["Baseline requirement (faithful summary)"] || id;
  if (section === "Defects") return draft.Summary || id;
  if (section === "Risks & Decisions") return draft["Issue / risk"] || id;
  if (section === "Data") return draft.Purpose || id;
  if (section === "Course Catalog") return draft["Actual title"] || id;
  if (section === "Test Plan") return draft.Section || id;
  return id;
}

function groupsFor(section: Section, creating: boolean) {
  const headers = section.headers;
  if (section.name === "Tests") return { definition: present(headers, [...(creating ? ["Test ID"] : []), "Test / scenario", "Requirement IDs", "Type", "Preconditions", "Inputs / data", "Procedure", "Expected result", "Pass criterion", "Decision dependency", "Evidence to retain", "Priority", "Assignee"]), run: creating ? [] : present(headers, ["Status", "Actual result", "Defect ID", "Tester", "Run date", "Evidence reference", "Run / build / environment"]) };
  if (section.name === "Defects") return { definition: present(headers, ["Summary", "Steps and inputs", "Expected result", "Actual result"]), run: present(headers, [...(creating ? ["Defect ID"] : []), "Test / requirement IDs", "Severity", "Found by", "Owner", "Status", "Run / build / environment", "Fix build", "Regression / closure approval"]) };
  if (section.name === "Risks & Decisions") return { definition: present(headers, ["Issue / risk", "Affected requirements", "Source gap or constraint", "Affected tests"]), run: present(headers, [...(creating ? ["ID"] : []), "Status", "Decision owner role", "Proposed control / decision", "Approved decision / evidence", "Reviewer", "Review date"]) };
  const hidden = new Set([headers[0], ...computedRequirementFields]);
  return { definition: headers.filter(header => !hidden.has(header) && header !== ""), run: [] as string[] };
}

export function RecordDashboard({ workspace, section, row, creating = false, members, finder = "" }: { workspace: Workspace; section: Section; row: RecordRow | null; creating?: boolean; members: TeamMember[]; finder?: string }) {
  const router = useRouter();
  const tests = workspace.sections.find(item => item.name === "Tests")!.rows;
  const blank = Object.fromEntries(section.headers.map(header => [header, ""])) as Values;
  if (creating) {
    const prefix = section.name === "Tests" ? "T" : "D";
    const next = Math.max(0, ...section.rows.map(item => Number(normalizeId(item.id).match(/\d+$/)?.[0]) || 0)) + 1;
    blank[section.headers[0]] = normalizeId(`${prefix}${next}`);
    blank.Status = section.name === "Tests" ? "Not run" : "New";
    blank.Priority = "High";
    if (section.name === "Defects") {
      blank.Severity = "Medium";
      blank["Found by"] = finder;
    }
    if (section.name === "Tests") {
      blank.Type = "Functional";
      blank.Assignee = "";
    }
  }
  const stored = !creating && row ? row.values : {};
  const initial = prepareDraft(section, { ...blank, ...stored });
  const [draft, setDraft] = useState<Values>({ ...initial });
  const [baseline, setBaseline] = useState<Values>({ ...initial });
  const [mode, setMode] = useState<"case" | "update" | "execution">(section.name === "Tests" && !creating ? "case" : "update");
  const [leaveCase, setLeaveCase] = useState(false);
  const [revision, setRevision] = useState<number | null>(creating || !row ? null : row.revision);
  const [archived, setArchived] = useState(row?.archived ?? false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [history, setHistory] = useState<History[]>(workspace.history.filter(item => item.section === section.name && item.recordId === row?.id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [defectQuery, setDefectQuery] = useState<string | null>(null);
  const [createdDefects, setCreatedDefects] = useState<LinkOption[]>([]);
  const editable = editableSections.includes(section.name);
  const id = draft[section.headers[0]] || row?.id || "New record";
  const nav = sectionByName(section.name);
  const requirement = section.name === "Traceability" && row ? row : null;
  const result = requirement ? coverage(requirement, tests) : null;
  const title = titleOf(section.name, draft, id);
  const canonicalId = normalizeId(id);
  const requirementKind = requirement ? canonicalId.startsWith("NFR") ? "Non-functional" : /^FR-\d+$/.test(canonicalId) ? "Functional" : null : null;
  const heading = creating ? `${canonicalId} New ${section.name === "Tests" ? "test case" : "defect"}` : title === id || normalizeId(title) === canonicalId ? canonicalId : `${canonicalId} ${title}`;
  const groups = groupsFor(section, creating);
  const editedLabels = new Set([...groups.definition, ...groups.run].map(fieldLabel));
  const related = relatedRecords(workspace, section.name, draft, result?.mapped ?? []);
  const caseView = section.name === "Tests" && !creating && mode === "case";
  const testUpdate = section.name === "Tests" && !creating && mode === "update";
  const testExecution = section.name === "Tests" && !creating && mode === "execution";
  const writingCase = testUpdate || (creating && section.name === "Tests");
  const headerBadges = [requirementKind, archived ? "Archived" : "", draft.Status && (!writingCase || testUpdate) ? draft.Status : "", !writingCase ? draft.Priority : "", !writingCase ? draft.Severity : "", section.name === "Tests" && !writingCase ? draft.Type : ""].filter((badge): badge is string => Boolean(badge));

  function openMode(next: "update" | "execution") {
    setError("");
    setNotice("");
    setMode(next);
  }
  function returnToCase() {
    if (!sameValues(draft, baseline)) { setLeaveCase(true); return; }
    setMode("case");
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const recordId = draft[section.headers[0]];
      const response = await fetch("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ section: section.name, id: recordId, values: draft, revision }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to save.");
      if (creating) { router.replace(recordPath(section.name, normalizeId(recordId))); router.refresh(); return; }
      const saved = (payload as Workspace).sections.find(item => item.name === section.name)?.rows.find(item => item.id === normalizeId(recordId));
      if (saved) {
        const next = prepareDraft(section, { ...blank, ...saved.values });
        setRevision(saved.revision);
        setDraft(next);
        setBaseline(next);
      }
      setHistory((payload as Workspace).history.filter(item => item.section === section.name && item.recordId === normalizeId(recordId)));
      if (section.name === "Tests") setMode("case");
      setNotice(section.name === "Tests" ? "Saved." : "Saved. This dashboard is up to date.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save.");
    } finally { setSaving(false); }
  }

  async function archiveRecord() {
    if (!row || revision === null) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ section: section.name, id: row.id, revision, archive: !archived }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to update this record.");
      const saved = (payload as Workspace).sections.find(item => item.name === section.name)?.rows.find(item => item.id === row.id);
      if (saved) {
        const next = prepareDraft(section, { ...blank, ...saved.values });
        setRevision(saved.revision);
        setArchived(saved.archived);
        setDraft(next);
        setBaseline(next);
      }
      setHistory((payload as Workspace).history.filter(item => item.section === section.name && item.recordId === row.id));
      setNotice(archived ? "Restored. This record is active again." : "Archived. It stays out of the active lists and coverage.");
      setConfirmArchive(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update this record.");
    } finally { setSaving(false); }
  }

  function setField(header: string, value: string) {
    setDraft(current => {
      const next = { ...current, [header]: value };
      if (header === "Reviewer" || header === "Review date") next["Reviewer / date"] = joinPair(next.Reviewer ?? "", next["Review date"] ?? "");
      if (header === "Retest ID" || header === "Retest date") next["Retest ID / date"] = joinPair(next["Retest ID"] ?? "", next["Retest date"] ?? "");
      return next;
    });
  }
  const field = (header: string, editing: boolean, heading = false) => <Panel key={header} header={header} value={draft[header] ?? ""} editing={editing} heading={heading} section={section} members={members} options={optionsFor(header)} onCreate={section.name === "Tests" && header === "Defect ID" ? setDefectQuery : undefined} onChange={value => setField(header, value)}/>;
  function optionsFor(header: string) {
    const options = linkOptions(workspace, section.name, header);
    if (!options || header !== "Defect ID") return options;
    const known = new Set(options.map(option => option.id));
    return [...options, ...createdDefects.filter(option => !known.has(option.id))];
  }
  const definition = <div className="space-y-4">{groups.definition.filter(header => draft[header] || editable).map(header => field(header, editable))}</div>;
  const saveBar = <>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}{notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}{editable && <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>}</>;
  const runTitle = section.name === "Tests" ? "Execution" : "Update";
  const linkedRetests = section.name === "Defects" ? retestTests(tests, canonicalId, draft["Test / requirement IDs"] ?? "") : [];
  const run = groups.run.length > 0 && <div className="space-y-4 rounded-xl border bg-background p-5"><h2 className="font-semibold">{runTitle}</h2>{section.name === "Tests" && <p className="text-sm leading-6 text-muted-foreground">{draft.Status && draft.Status !== "Not run" ? "Pass, Fail, and Blocked need the actual result, run date, environment, and evidence reference." : "Actual result, run date, environment, and evidence reference stay empty while the status is Not run."}</p>}{groups.run.map(header => <div key={header} className="space-y-4">{header === "Regression / closure approval" && <DefectRetests tests={linkedRetests}/>}{field(header, editable && !(section.name === "Tests" && header === "Tester"))}</div>)}{saveBar}</div>;

  return <div className="not-typeset space-y-6">
    <div>
      <Link href={nav?.href ?? "/"} className="text-sm font-medium text-primary underline-offset-4 hover:underline">{nav?.label ?? section.name}</Link>
      {headerBadges.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-2">{headerBadges.map((badge, index) => <Badge key={`${badge}-${index}`} variant="secondary">{badge}</Badge>)}</div>}
      <h1 className={writingCase || heading.length > 90 ? "mt-2 max-w-4xl text-2xl font-semibold leading-snug" : "mt-2 max-w-4xl text-3xl font-semibold leading-tight"}>{heading}</h1>
    </div>
    {section.name !== "Tests" && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{statValues(section.name, draft, result).map(stat => <Card key={stat.label} className="not-typeset"><CardContent><p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{stat.label}{!editedLabels.has(stat.label) && <TermHelp section={section.name} label={stat.label}/>}</p><p className={stat.value.length > 28 ? "mt-1 text-base font-semibold leading-snug" : "mt-1 text-2xl font-semibold leading-none"}>{stat.value}</p></CardContent></Card>)}</div>}
    {result && <Card className="not-typeset"><CardContent><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Coverage</h2><p className="text-sm text-muted-foreground">{result.passed} of {result.mapped.length} mapped tests passed</p></div><progress aria-label={`${id} tests passed`} className="mt-3 h-2 w-full accent-primary" value={result.passed} max={Math.max(1, result.mapped.length)}/></CardContent></Card>}
    {section.name !== "Tests" && related.length > 0 && <section className="not-typeset"><h2 className="font-semibold">Related records</h2><div className="mt-3 grid gap-3 sm:grid-cols-2">{related.map(item => <Link key={item.href} href={item.href} className="rounded-xl border bg-background p-4 hover:bg-muted/40"><div className="flex items-center justify-between gap-2"><span className="font-semibold text-primary">{normalizeId(item.id)}</span>{item.status && <Badge variant="secondary">{item.status}</Badge>}</div>{item.detail && <p className="mt-2 line-clamp-1 text-sm leading-snug text-muted-foreground">{item.detail}</p>}</Link>)}</div></section>}
    {caseView && notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
    {caseView && <TestLab draft={draft} related={related} onUpdate={() => openMode("update")} onExecute={() => openMode("execution")}/>}
    {writingCase && <form onSubmit={save} className="max-w-3xl rounded-xl border bg-background px-6 py-8 sm:px-8">
      {testUpdate && <div className="mb-6 flex justify-end"><Button type="button" variant="outline" onClick={returnToCase}>Back to the case</Button></div>}
      {groups.definition.includes("Test / scenario") && field("Test / scenario", true, true)}
      <div className={creating ? "mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" : "mt-6 grid gap-4 sm:grid-cols-3"}>{["Test ID", "Type", "Priority", "Assignee"].filter(header => groups.definition.includes(header)).map(header => field(header, true))}</div>
      <ol className="mt-8 list-none space-y-5 border-t pt-8">
        {["Requirement IDs", "Preconditions", "Inputs / data", "Procedure", "Expected result", "Pass criterion", "Evidence to retain", "Decision dependency"].filter(header => groups.definition.includes(header)).map((header, index) => <li key={header} className={header === "Procedure" ? "flex gap-4 rounded-lg bg-muted/60 p-5" : "flex gap-4 px-5"}>
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-background text-xs font-semibold ring-1 ring-border">{index + 1}</span>
          <div className="min-w-0 flex-1">{field(header, true, true)}</div>
        </li>)}
      </ol>
      <div className="mt-8 flex flex-col gap-3 border-t pt-6 [&_button]:ml-auto">{saveBar}</div>
    </form>}
    {testExecution && <div className="flex flex-wrap items-start justify-between gap-3"><p className="max-w-2xl text-sm leading-6 text-muted-foreground">An execution is the latest try of the case. Pass, Fail, and Blocked need the actual result, run date, environment, and evidence reference.</p><Button type="button" variant="outline" onClick={returnToCase}>Back to the case</Button></div>}
    {testExecution && <form onSubmit={save} className="max-w-xl space-y-4">{groups.run.map(header => field(header, header !== "Tester"))}{saveBar}</form>}
    {!caseView && !testUpdate && !testExecution && !(creating && section.name === "Tests") && (editable ? groups.run.length > 0 ? <form onSubmit={save} className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">{definition}{run}</form> : <form onSubmit={save} className="space-y-4">{definition}{saveBar}</form> : <div className="space-y-4">{definition}</div>)}
    {history.length > 0 && <section className="not-typeset"><h2 className="font-semibold">History</h2><div className="mt-3 space-y-3">{history.map(item => <Card key={item.sequence} className="not-typeset"><CardContent><p className="text-sm font-semibold">{item.savedAt} · {item.values.Archived === "Yes" ? "Archived" : item.values.Archived === "No" ? "Restored" : item.values.Status || "Updated"} · {item.actorEmail || item.values.Tester || item.values.Owner || "Baseline"}</p><dl className="mt-3 grid gap-3 sm:grid-cols-2">{Object.entries(item.values).filter(([key, value]) => value && key !== "Archived").slice(0, 6).map(([key, value]) => <div key={key}><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{key}</dt><dd className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm leading-6">{value}</dd></div>)}</dl></CardContent></Card>)}</div></section>}
    {!creating && <div className="flex items-center gap-2 border-t pt-6"><Button type="button" variant="outline" disabled={saving} onClick={() => setConfirmArchive(true)}>{archived ? "Restore" : "Archive"}</Button><TermHelp section={section.name} label="Archive"/></div>}
    {defectQuery !== null && <CreateDefectSheet query={defectQuery} ids={[...(workspace.sections.find(item => item.name === "Defects")?.rows.map(item => item.id) ?? []), ...createdDefects.map(item => item.id)]} headers={workspace.sections.find(item => item.name === "Defects")?.headers ?? []} testId={creating ? undefined : row?.id} finder={finder} onOpenChange={open => { if (!open) setDefectQuery(null); }} onCreated={(id, summary) => { setCreatedDefects(current => [...current, { id, label: summary, archived: false }]); setDraft(current => ({ ...current, "Defect ID": [...new Set([...parseLinks(current["Defect ID"] ?? ""), id])].join(", ") })); setDefectQuery(null); router.refresh(); }}/>}
    <AlertDialog open={leaveCase} onOpenChange={open => { if (!open) setLeaveCase(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
          <AlertDialogDescription>Unsaved changes will be discarded.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep editing</AlertDialogCancel>
          <Button type="button" onClick={() => { setDraft(baseline); setError(""); setLeaveCase(false); setMode("case"); }}>Discard changes</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <AlertDialog open={confirmArchive} onOpenChange={open => { if (!open && !saving) setConfirmArchive(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{archived ? "Restore this record?" : "Archive this record?"}</AlertDialogTitle>
          <AlertDialogDescription>{archived ? "It returns to the active lists and counts toward coverage again." : "It leaves the active lists and coverage. The record and its history stay available here."}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && confirmArchive && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
          <Button type="button" disabled={saving} onClick={archiveRecord}>{saving ? "Working…" : archived ? "Restore" : "Archive"}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}

function sameValues(left: Values, right: Values) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) if ((left[key] ?? "") !== (right[key] ?? "")) return false;
  return true;
}

function statValues(section: string, draft: Values, result: { mapped: RecordRow[]; passed: number; state: string } | null) {
  if (section === "Tests") return [{ label: "Status", value: draft.Status || "Not run" }, { label: "Priority", value: draft.Priority || "—" }, { label: "Type", value: draft.Type || "—" }, { label: "Assignee", value: draft.Assignee || "Unassigned" }];
  if (section === "Traceability" && result) return [{ label: "Coverage", value: result.state }, { label: "Mapped", value: String(result.mapped.length) }, { label: "Passed", value: String(result.passed) }, { label: "Source priority", value: draft["Source priority"] || "—" }];
  if (section === "Defects") return [{ label: "Status", value: draft.Status || "—" }, { label: "Severity", value: draft.Severity || "—" }, { label: "Found by", value: draft["Found by"] || "—" }, { label: "Assigned to", value: draft.Owner || "Unassigned" }];
  if (section === "Risks & Decisions") return [{ label: "Status", value: draft.Status || "—" }, { label: "Owner", value: draft["Decision owner role"] || "—" }, { label: "Review", value: [draft.Reviewer, draft["Review date"]].filter(Boolean).join(" · ") || "—" }];
  if (section === "Course Catalog") return [{ label: "Credits", value: draft.Credits || "—" }, { label: "Seed status", value: draft["Seed status"] || "—" }, { label: "Offered codes", value: draft["Offered codes"] || "—" }];
  if (section === "Data") return [{ label: "Fixture", value: draft["Fixture ID"] || "—" }];
  return [];
}

function relatedRecords(workspace: Workspace, section: string, draft: Values, mapped: RecordRow[]) {
  const rows = workspace.sections.flatMap(item => item.rows.map(row => ({ section: item.name, row })));
  const wanted = new Map<string, string[]>();
  const add = (id: string, sections: string[]) => wanted.set(id, [...new Set([...(wanted.get(id) ?? []), ...sections])]);
  if (section === "Traceability") for (const test of mapped) add(test.id, ["Tests"]);
  if (section === "Tests") {
    for (const id of linkedIds(draft["Requirement IDs"])) add(id, ["Traceability"]);
    for (const id of linkedIds(draft["Defect ID"])) add(id, ["Defects"]);
    for (const id of linkedIds(draft["Decision dependency"])) add(id, ["Risks & Decisions", "Data"]);
  }
  if (section === "Defects") for (const id of linkedIds(draft["Test / requirement IDs"])) add(id, ["Tests", "Traceability"]);
  if (section === "Risks & Decisions") {
    for (const id of linkedIds(draft["Affected requirements"])) add(id, ["Traceability"]);
    for (const id of linkedIds(draft["Affected tests"])) add(id, ["Tests"]);
  }
  return [...wanted].flatMap(([id, sections]) => {
    const match = rows.find(item => normalizeId(item.row.id) === normalizeId(id) && sections.includes(item.section)) ?? rows.find(item => normalizeId(item.row.id) === normalizeId(id));
    if (!match) return [];
    const detail = titleOf(match.section, match.row.values, match.row.id);
    const shown = detail && detail !== id && detail !== match.row.id && normalizeId(detail) !== normalizeId(id) ? detail : "";
    return [{ href: recordPath(match.section, match.row.id), id, status: match.row.values.Status, detail: shown }];
  });
}

function linkOptions(workspace: Workspace, sectionName: string, header: string): LinkOption[] | null {
  const targets = linkTargets(sectionName, header);
  if (!targets) return null;
  const options = workspace.sections.filter(item => targets.includes(item.name)).flatMap(item => item.rows.map(row => ({ id: normalizeId(row.id), label: titleOf(item.name, row.values, row.id), archived: row.archived })));
  if (header === "Requirement IDs" || header === "Affected requirements") return options.filter(option => /^(?:FR|NFR)-\d+$/.test(normalizeId(option.id)));
  return options;
}

function Panel({ header, value, editing, heading = false, section, members, options, onChange, onCreate }: { header: string; value: string; editing: boolean; heading?: boolean; section: Section; members: TeamMember[]; options: LinkOption[] | null; onChange: (value: string) => void; onCreate?: (query: string) => void }) {
  const fieldId = `field-${header.replaceAll(/[^a-z0-9]+/gi, "-")}`;
  const label = fieldLabel(header);
  const choices = choiceOptions(section.name, header, members);
  const dates = header === "Run date" || header === "Review date" || header === "Retest date";
  const ordered = orderedLists.has(header);
  const items = ordered || itemLists.has(header) || (header === "Expected result" && section.name === "Tests");
  const multi = header === "Decision owner role" || header === "Offered codes" || header === "GEC categories";
  if (!editing) return <Card className="not-typeset"><CardContent><h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{(dates ? displayDate(value) : value) || "—"}</p></CardContent></Card>;
  return <Field>
    <div className="flex items-center gap-1.5"><FieldLabel id={multi ? fieldId : undefined} htmlFor={multi ? undefined : fieldId} className={heading ? "text-sm font-semibold text-foreground" : undefined}>{label}</FieldLabel><TermHelp section={section.name} label={label}/></div>
    {control()}
  </Field>;

  function control() {
    if (header === "Tester") return <p id={fieldId} className="text-sm leading-6">{value || "Recorded when the case is saved."}</p>;
    if (options) return <LinkPicker id={fieldId} label={label} value={value} options={options} onChange={onChange} onCreate={onCreate}/>;
    if (header === "Decision owner role") return <MultiChoice id={fieldId} value={value} options={decisionOwners.map(owner => ({ value: owner, label: owner }))} separator=" / " onChange={onChange}/>;
    if (header === "Offered codes") return <MultiChoice id={fieldId} value={value} options={offeredTerms} exclusive={offeredExclusive} separator=", " onChange={onChange}/>;
    if (header === "GEC categories") return <MultiChoice id={fieldId} value={value} options={gecCategories.map(category => ({ value: category, label: category }))} exclusive={gecExclusive} separator=", " onChange={onChange}/>;
    if (choices) return <ChoiceSelect id={fieldId} label={label} value={value} emptyLabel={header === "Found by" ? "Who found it" : header === "Assignee" || header === "Owner" ? "Unassigned" : header === "Reviewer" ? "No reviewer" : header === "Run / build / environment" || header === "Credits" || header === "Source priority" ? "Not set" : undefined} options={choices} onChange={onChange} className="w-full bg-background"/>;
    if (dates) return <DateField id={fieldId} label={label} value={value} onChange={onChange}/>;
    if (items) return <ItemList id={fieldId} label={label} value={value} ordered={ordered} onChange={onChange}/>;
    if (shortText.has(header)) return <Input id={fieldId} value={value} onChange={event => onChange(event.target.value)} className={header === "Test / scenario" ? "h-11 px-3 text-base md:text-base" : undefined}/>;
    return <Textarea id={fieldId} rows={["Actual result", "Plan and process", "Proposed control / decision", "Approved decision / evidence", "Baseline requirement (faithful summary)", "Purpose"].includes(header) ? 5 : 3} value={value} onChange={event => onChange(event.target.value)}/>;
  }
}
