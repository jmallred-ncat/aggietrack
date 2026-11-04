"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@aggietrack/ui/badge";
import { Button } from "@aggietrack/ui/button";
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
import { resetAllSummary, resetTestAccounts } from "@/lib/reset-students";
import { resetAfterUse, type TestStudentCard } from "@/lib/test-students";

async function postReset(email: string) {
  const response = await fetch("/api/test-students", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "That account could not be reset.");
}

export function TestStudents({ students, password, notice }: { students: TestStudentCard[]; password: string; notice: string }) {
  const [pending, setPending] = useState("");
  const [pendingAll, setPendingAll] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const toastedNotice = useRef(false);

  useEffect(() => {
    if (!notice || toastedNotice.current) return;
    toastedNotice.current = true;
    toast.add({ type: "error", title: notice });
  }, [notice]);

  async function reset(student: TestStudentCard) {
    setPending(student.email);
    try {
      await postReset(student.email);
      toast.add({ type: "success", title: `${student.name} is back to the frozen place and signed out of AggieTrack.` });
    } catch (caught) {
      toast.add({ type: "error", title: caught instanceof Error ? caught.message : "That account could not be reset." });
    } finally {
      setPending("");
    }
  }

  async function resetAll() {
    setConfirmAll(false);
    setPendingAll(true);
    try {
      const result = await resetTestAccounts(studentAccounts, postReset);
      toast.add({ type: result.failed.length > 0 ? "error" : "success", title: resetAllSummary(result) });
    } catch (caught) {
      toast.add({ type: "error", title: caught instanceof Error ? caught.message : "Test students could not be reset." });
    } finally {
      setPendingAll(false);
    }
  }

  const studentAccounts = students.filter(s => s.role === "student");
  const advisorAccounts = students.filter(s => s.role === "advisor");

  return <div className="not-typeset space-y-8">
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Test Accounts</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">These accounts sign in on AggieTrack. They are shared, so the next person does not inherit someone else&apos;s data.</p>
      </div>
      <AlertDialog open={confirmAll} onOpenChange={setConfirmAll}>
        <AlertDialogTrigger render={<Button variant="outline" disabled={pendingAll || !password} />}>
          {pendingAll ? "Resetting…" : "Reset All Students"}
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset all test students?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reset all {studentAccounts.length} test student accounts to their frozen state and sign them out of AggieTrack. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={resetAll}>Reset All</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Test Students</h2>
        <p className="mt-1 text-sm text-muted-foreground">Student accounts with varying levels of progress through the IT program.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {studentAccounts.map(student => <section key={student.email} className="flex flex-col rounded-xl border bg-background p-4">
          <h3 className="text-lg font-semibold">{student.name}</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{student.place}</p>
          <dl className="mt-4 space-y-2 text-sm">
            <div><dt className="text-muted-foreground">Email</dt><dd className="font-mono">{student.email}</dd></div>
            <div><dt className="text-muted-foreground">Password</dt><dd className="font-mono">{password || "Not configured"}</dd></div>
          </dl>
          <p className="mt-4 text-sm leading-6">{resetAfterUse}</p>
          <Button className="mt-4 w-fit" disabled={pending === student.email || pendingAll || !password} onClick={() => reset(student)}>{pending === student.email ? "Resetting…" : `Reset ${student.name}`}</Button>
        </section>)}
      </div>
    </section>

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
          <Button className="mt-4 w-fit" disabled={pending === advisor.email || pendingAll || !password} onClick={() => reset(advisor)}>{pending === advisor.email ? "Resetting…" : `Reset ${advisor.name}`}</Button>
        </section>)}
      </div>
    </section>
  </div>;
}
