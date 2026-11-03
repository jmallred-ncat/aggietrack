"use client";

import { useState } from "react";
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
import { resetAfterUse, type TestStudentCard } from "@/lib/test-students";

export function TestStudents({ students, password, notice }: { students: TestStudentCard[]; password: string; notice: string }) {
  const [pending, setPending] = useState("");
  const [pendingAll, setPendingAll] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(notice);

  async function reset(student: TestStudentCard) {
    setPending(student.email);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/test-students", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: student.email }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "That account could not be reset.");
      setMessage(`${student.name} is back to the frozen place and signed out of AggieTrack.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That account could not be reset.");
    } finally {
      setPending("");
    }
  }

  async function resetAll() {
    setPendingAll(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/test-students/reset-all", { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Test students could not be reset.");
      
      const { succeeded, failed, total } = body;
      if (failed && failed.length > 0) {
        const failedNames = failed.map((f: { email: string }) => {
          const student = students.find(s => s.email === f.email);
          return student?.name || f.email;
        }).join(", ");
        setMessage(`Reset ${succeeded.length} of ${total} students. Failed: ${failedNames}`);
      } else {
        setMessage(`Reset ${succeeded.length} of ${total} students`);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Test students could not be reset.");
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
      <AlertDialog>
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
    {message && !error ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
    
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
          <Button className="mt-4 w-fit" disabled={pending === student.email || !password} onClick={() => reset(student)}>{pending === student.email ? "Resetting…" : `Reset ${student.name}`}</Button>
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
          <dl className="mt-4 space-y-2 text-sm">
            <div><dt className="text-muted-foreground">Email</dt><dd className="font-mono">{advisor.email}</dd></div>
            <div><dt className="text-muted-foreground">Password</dt><dd className="font-mono">{password || "Not configured"}</dd></div>
          </dl>
          <p className="mt-4 text-sm leading-6">Reset clears sessions only (no profile or transcript).</p>
          <Button className="mt-4 w-fit" disabled={pending === advisor.email || !password} onClick={() => reset(advisor)}>{pending === advisor.email ? "Resetting…" : `Reset ${advisor.name}`}</Button>
        </section>)}
      </div>
    </section>
  </div>;
}
