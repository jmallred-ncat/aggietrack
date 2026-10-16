"use client";

import { useState } from "react";
import { Button } from "@aggietrack/ui/button";
import { resetAfterUse, type TestStudentCard } from "@/lib/test-students";

export function TestStudents({ students, password, notice }: { students: TestStudentCard[]; password: string; notice: string }) {
  const [pending, setPending] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(notice);

  async function reset(student: TestStudentCard) {
    setPending(student.email);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/test-students", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: student.email }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "That student could not be reset.");
      setMessage(`${student.name} is back to the frozen place and signed out of AggieTrack.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That student could not be reset.");
    } finally {
      setPending("");
    }
  }

  return <div className="not-typeset space-y-6">
    <div>
      <h1 className="text-2xl font-semibold">Test students</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">These accounts sign in on AggieTrack. They are shared, so the next person does not inherit someone else’s plan.</p>
    </div>
    {message && !error ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
    <div className="grid gap-4 lg:grid-cols-3">
      {students.map(student => <section key={student.email} className="flex flex-col rounded-xl border bg-background p-4">
        <h2 className="text-lg font-semibold">{student.name}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{student.place}</p>
        <dl className="mt-4 space-y-2 text-sm">
          <div><dt className="text-muted-foreground">Email</dt><dd className="font-mono">{student.email}</dd></div>
          <div><dt className="text-muted-foreground">Password</dt><dd className="font-mono">{password || "Not configured"}</dd></div>
        </dl>
        <p className="mt-4 text-sm leading-6">{resetAfterUse}</p>
        <Button className="mt-4 w-fit" disabled={pending === student.email || !password} onClick={() => reset(student)}>{pending === student.email ? "Resetting…" : `Reset ${student.name}`}</Button>
      </section>)}
    </div>
  </div>;
}
