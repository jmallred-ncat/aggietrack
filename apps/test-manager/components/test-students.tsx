"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@aggietrack/ui/badge";
import { Button } from "@aggietrack/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@aggietrack/ui/empty";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@aggietrack/ui/alert-dialog";
import { toast } from "@aggietrack/ui/toast";
import { ChoiceSelect } from "@/components/choice-select";
import { Label } from "@aggietrack/ui/label";
import { planNotesResetSummary, resetAllSummary, resetTestAccounts } from "@/lib/reset-students";
import {
  accountsBusy,
  faultChoice,
  faultRequest,
  fixtureChoiceById,
  fixtureConfirmAction,
  fixtureLoadAction,
  fixtureLoadingAction,
  fixtureLoadResult,
  fixtureLoadedSummary,
  fixtureReplaceDetail,
  fixtureReplaceTitle,
  jordanPlanReset,
  nextSaveAfterFixture,
  nextSaveChoices,
  nextSaveFails,
  nextSaveWaits,
  nextSaveWorks,
  noTestStudentsDetail,
  noTestStudentsTitle,
  planNotesResetAction,
  planNotesResetDetail,
  planNotesResetTitle,
  resetAfterUse,
  transcriptFixtureChoices,
  transcriptFixturePlaceholder,
  tryBegin,
  type TestStudentCard,
} from "@/lib/test-students";

async function postReset(email: string) {
  const response = await fetch("/api/test-students", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "That account could not be reset.");
}

async function postResetNotes() {
  const response = await fetch("/api/test-students", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes: true }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || typeof body.deleted !== "number") {
    throw new Error(typeof body.error === "string" ? body.error : "Plan notes could not be reset.");
  }
  return body.deleted as number;
}

async function postFault(email: string, choice: string) {
  const request = faultRequest(choice);
  if (!request) throw new Error("Choose a failed save or a delayed save.");
  const response = await fetch("/api/test-students", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, ...request }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "That save setting could not be saved.");
}

async function postFixture(email: string, fixtureId: string) {
  const response = await fetch("/api/test-students", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, fixture: fixtureId }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const failure = new Error(typeof body.error === "string" ? body.error : "That transcript could not be loaded.") as Error & { accountChanged: boolean };
    failure.accountChanged = body.accountChanged === true;
    throw failure;
  }
  return fixtureLoadResult(body);
}

export function TestStudents({ students, password, notice, faults = {} }: { students: TestStudentCard[]; password: string; notice: string; faults?: Record<string, string | null> }) {
  const router = useRouter();
  const [pending, setPending] = useState("");
  const [arming, setArming] = useState("");
  const [pendingAll, setPendingAll] = useState(false);
  const [pendingNotes, setPendingNotes] = useState(false);
  const [loading, setLoading] = useState("");
  const [confirmAll, setConfirmAll] = useState(false);
  const [confirmNotes, setConfirmNotes] = useState(false);
  const [confirmFixture, setConfirmFixture] = useState<{ email: string; fixtureId: string } | null>(null);
  const [fixtureChoice, setFixtureChoice] = useState<Record<string, string>>({});
  const [lastLoaded, setLastLoaded] = useState<Record<string, string>>({});
  const actionLock = useRef(false);
  const [nextSave, setNextSave] = useState<Record<string, string>>(() => Object.fromEntries(students.filter(student => student.role === "student").map(student => [student.email, faultChoice(faults[student.email])])));
  const toastedNotice = useRef(false);
  const busy = accountsBusy({ pending, pendingAll, pendingNotes, arming, loading });

  useEffect(() => {
    if (!notice || toastedNotice.current) return;
    toastedNotice.current = true;
    toast.add({ type: "error", title: notice });
  }, [notice]);

  async function arm(student: TestStudentCard, choice: string) {
    if (!tryBegin(actionLock)) return;
    const previous = nextSave[student.email] ?? nextSaveWorks;
    setNextSave(current => ({ ...current, [student.email]: choice }));
    setArming(student.email);
    try {
      await postFault(student.email, choice);
      const detail = choice === nextSaveFails ? "will fail" : choice === nextSaveWaits ? "will wait 16 seconds" : "will save normally";
      toast.add({ type: "success", title: `The next add or remove for ${student.name} ${detail}.` });
    } catch (caught) {
      setNextSave(current => ({ ...current, [student.email]: previous }));
      toast.add({ type: "error", title: caught instanceof Error ? caught.message : "That save setting could not be saved." });
    } finally {
      actionLock.current = false;
      setArming("");
    }
  }

  async function reset(student: TestStudentCard) {
    if (!tryBegin(actionLock)) return;
    setPending(student.email);
    try {
      await postReset(student.email);
      if (student.role === "student") {
        setNextSave(current => ({ ...current, [student.email]: nextSaveWorks }));
        setLastLoaded(current => {
          const next = { ...current };
          delete next[student.email];
          return next;
        });
      }
      toast.add({ type: "success", title: `${student.name} is back to the frozen place and signed out of AggieTrack.` });
      router.refresh();
    } catch (caught) {
      toast.add({ type: "error", title: caught instanceof Error ? caught.message : "That account could not be reset." });
    } finally {
      actionLock.current = false;
      setPending("");
    }
  }

  async function resetNotes() {
    if (!tryBegin(actionLock)) return;
    setConfirmNotes(false);
    setPendingNotes(true);
    try {
      const deleted = await postResetNotes();
      toast.add({ type: "success", title: planNotesResetSummary(deleted) });
    } catch (caught) {
      toast.add({ type: "error", title: caught instanceof Error ? caught.message : "Plan notes could not be reset." });
    } finally {
      actionLock.current = false;
      setPendingNotes(false);
    }
  }

  async function resetAll() {
    if (!tryBegin(actionLock)) return;
    setConfirmAll(false);
    setPendingAll(true);
    try {
      const result = await resetTestAccounts(studentAccounts, postReset);
      setLastLoaded(current => {
        const next = { ...current };
        for (const student of result.succeeded) delete next[student.email];
        return next;
      });
      setNextSave(current => {
        const next = { ...current };
        for (const student of result.succeeded) next[student.email] = nextSaveWorks;
        return next;
      });
      toast.add({ type: result.failed.length > 0 ? "error" : "success", title: resetAllSummary(result) });
      router.refresh();
    } catch (caught) {
      toast.add({ type: "error", title: caught instanceof Error ? caught.message : "Test students could not be reset." });
    } finally {
      actionLock.current = false;
      setPendingAll(false);
    }
  }

  async function loadFixture(student: TestStudentCard, fixtureId: string) {
    if (!tryBegin(actionLock)) return;
    setConfirmFixture(null);
    setLoading(student.email);
    const previousSave = nextSave[student.email] ?? nextSaveWorks;
    try {
      const result = await postFixture(student.email, fixtureId);
      setLastLoaded(current => ({ ...current, [student.email]: result.fixture }));
      setNextSave(current => ({ ...current, [student.email]: nextSaveAfterFixture(previousSave, { ok: true, accountChanged: true }) }));
      toast.add({ type: "success", title: fixtureLoadedSummary(result) });
      router.refresh();
    } catch (caught) {
      const accountChanged = caught instanceof Error && "accountChanged" in caught && caught.accountChanged === true;
      if (accountChanged) {
        setLastLoaded(current => {
          const next = { ...current };
          delete next[student.email];
          return next;
        });
        setNextSave(current => ({ ...current, [student.email]: nextSaveAfterFixture(previousSave, { ok: false, accountChanged: true }) }));
      }
      toast.add({ type: "error", title: caught instanceof Error ? caught.message : "That transcript could not be loaded." });
    } finally {
      actionLock.current = false;
      setLoading("");
    }
  }

  const studentAccounts = students.filter(s => s.role === "student");
  const advisorAccounts = students.filter(s => s.role === "advisor");
  const confirming = studentAccounts.find(student => student.email === confirmFixture?.email) ?? null;
  const confirmingFixture = confirmFixture ? fixtureChoiceById(confirmFixture.fixtureId) : null;

  return <div className="not-typeset space-y-8">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold">Test Accounts</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">These accounts sign in on AggieTrack. They are shared, so the next person does not inherit someone else&apos;s data.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
      <AlertDialog open={confirmNotes} onOpenChange={setConfirmNotes}>
        <AlertDialogTrigger render={<Button variant="outline" disabled={busy || !password} />}>
          {pendingNotes ? "Resetting…" : planNotesResetAction}
        </AlertDialogTrigger>
        <AlertDialogContent className="max-w-md sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{planNotesResetTitle}</AlertDialogTitle>
            <AlertDialogDescription>{planNotesResetDetail}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendingNotes}>Cancel</AlertDialogCancel>
            <AlertDialogAction type="button" disabled={pendingNotes} onClick={resetNotes}>{planNotesResetAction}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirmAll} onOpenChange={setConfirmAll}>
        <AlertDialogTrigger render={<Button variant="outline" disabled={busy || !password} />}>
          {pendingAll ? "Resetting…" : "Reset All Students"}
        </AlertDialogTrigger>
        <AlertDialogContent className="max-w-md sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Reset all test students?</AlertDialogTitle>
            <AlertDialogDescription>
              This resets all {studentAccounts.length} test student accounts to their frozen state and signs everyone out of AggieTrack. It also clears test advisor availability and sessions, then restores Jordan Hale’s seeded session with Sarah Martinez. This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendingAll}>Cancel</AlertDialogCancel>
            <AlertDialogAction type="button" variant="destructive" disabled={pendingAll} onClick={resetAll}>Reset All</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>

    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Test Students</h2>
        <p className="mt-1 text-sm text-muted-foreground">Student accounts with varying levels of progress through the IT program.</p>
      </div>
      {studentAccounts.length === 0 ? <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyTitle>{noTestStudentsTitle}</EmptyTitle>
          <EmptyDescription>{noTestStudentsDetail}</EmptyDescription>
        </EmptyHeader>
      </Empty> : <div className="grid gap-4 lg:grid-cols-3">
        {studentAccounts.map(student => {
          const selected = fixtureChoice[student.email] ?? "";
          const loaded = lastLoaded[student.email];
          return <section key={student.email} className="flex flex-col rounded-xl border bg-background p-4">
            <h3 className="text-lg font-semibold">{student.name}</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{student.place}</p>
            <dl className="mt-4 space-y-2 text-sm">
              <div><dt className="text-muted-foreground">Email</dt><dd className="font-mono">{student.email}</dd></div>
              <div><dt className="text-muted-foreground">Password</dt><dd className="font-mono">{password || "Not configured"}</dd></div>
            </dl>
            <div className="mt-4 space-y-2">
              <Label htmlFor={`next-save-${student.email}`}>Next planner save</Label>
              <ChoiceSelect id={`next-save-${student.email}`} label={`Next planner save for ${student.name}`} value={nextSave[student.email] ?? nextSaveWorks} options={nextSaveChoices} disabled={busy || !password} onChange={choice => { void arm(student, choice); }} className="w-full bg-background"/>
              <p className="text-sm leading-6 text-muted-foreground">Set this before the save. It turns off after one add or remove. The live site ignores it.</p>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">{student.email === "it.mid@example.test" ? jordanPlanReset : resetAfterUse}</p>
            <div className="mt-auto space-y-2 pt-4">
              <Label htmlFor={`fixture-${student.email}`}>Transcript fixture</Label>
              <ChoiceSelect id={`fixture-${student.email}`} label={`Transcript fixture for ${student.name}`} value={fixtureChoiceById(selected)?.label ?? ""} placeholder={transcriptFixturePlaceholder} options={transcriptFixtureChoices.map(choice => choice.label)} disabled={busy || !password} onChange={label => {
                const choice = transcriptFixtureChoices.find(item => item.label === label);
                if (!choice || busy) return;
                setFixtureChoice(current => ({ ...current, [student.email]: choice.id }));
              }} className="w-full bg-background"/>
              <Button variant="outline" size="sm" className="w-full" disabled={!selected || busy || !password} onClick={() => setConfirmFixture({ email: student.email, fixtureId: selected })}>{loading === student.email ? fixtureLoadingAction : fixtureLoadAction}</Button>
              {loaded ? <p className="text-sm text-muted-foreground">Last loaded: {loaded}</p> : null}
              <Button className="w-full" disabled={busy || !password} onClick={() => reset(student)}>{pending === student.email ? "Resetting…" : `Reset ${student.name}`}</Button>
            </div>
          </section>;
        })}
      </div>}
    </section>

    <AlertDialog open={confirming !== null && confirmingFixture !== null} onOpenChange={open => { if (!open) setConfirmFixture(null); }}>
      <AlertDialogContent className="max-w-md sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{fixtureReplaceTitle}</AlertDialogTitle>
          <AlertDialogDescription>{confirming && confirmingFixture ? fixtureReplaceDetail(confirming.name, confirmingFixture.label) : ""}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction type="button" variant="destructive" onClick={() => { if (confirming && confirmingFixture) void loadFixture(confirming, confirmingFixture.id); }}>{fixtureConfirmAction}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Test Advisors</h2>
        <p className="mt-1 text-sm text-muted-foreground">Advisor accounts for testing plan review and approval workflows. <strong>Note:</strong> These are test-only fixtures. Production advisor provisioning is not yet implemented.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {advisorAccounts.map(advisor => <section key={advisor.email} className="flex flex-col rounded-xl border bg-background p-4">
          <h3 className="text-lg font-semibold">{advisor.name}</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{advisor.place}</p>
          {advisor.assignment ? <Badge variant="secondary" className="mt-3 h-auto max-w-full whitespace-normal">{advisor.assignment}</Badge> : null}
          <dl className="mt-4 space-y-2 text-sm">
            <div><dt className="text-muted-foreground">Email</dt><dd className="font-mono">{advisor.email}</dd></div>
            <div><dt className="text-muted-foreground">Password</dt><dd className="font-mono">{password || "Not configured"}</dd></div>
          </dl>
          <p className="mt-4 text-sm leading-6">Reset clears sessions only (no profile or transcript).</p>
          <Button className="mt-4 w-fit" disabled={busy || !password} onClick={() => reset(advisor)}>{pending === advisor.email ? "Resetting…" : `Reset ${advisor.name}`}</Button>
        </section>)}
      </div>
    </section>
  </div>;
}
