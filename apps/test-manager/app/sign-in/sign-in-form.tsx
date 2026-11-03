"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Alert, AlertAction, AlertDescription } from "@aggietrack/ui/alert";
import { Button } from "@aggietrack/ui/button";
import { Input } from "@aggietrack/ui/input";
import { Card, CardContent } from "@aggietrack/ui/card";
import { Field, FieldDescription, FieldLabel } from "@aggietrack/ui/field";
import { authClient } from "@/lib/auth-client";
import { personalEmail } from "@/lib/email-policy";
import { claimNameMessage } from "@/lib/members";

export function SignInForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [linkError, setLinkError] = useState(searchParams.has("error"));
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(""); setSent(false);
    let recipient: string;
    try { recipient = personalEmail(email); }
    catch (error) { setError(error instanceof Error ? error.message : "Use a personal email."); return; }
    setPending(true);
    try {
      const result = await authClient.signIn.magicLink({ email: recipient, ...(claiming ? { name: name.trim() } : {}), callbackURL: "/", newUserCallbackURL: "/", errorCallbackURL: "/sign-in" });
      if (result.error) throw new Error(result.error.message || "Unable to send a sign-in link. Please try again.");
      setSent(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send a sign-in link.";
      if (message === claimNameMessage) setClaiming(true);
      setError(message);
    }
    finally { setPending(false); }
  }
  return <Card className="not-typeset w-full max-w-md"><CardContent>
    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">AggieTrack / Quality assurance</p>
    <h1 className="mt-3 text-2xl font-semibold">Sign in to Test Manager</h1>
    <p className="mt-3 text-sm leading-6 text-muted-foreground">Enter the email an admin invited, or the seeded admin email to claim this workspace. University addresses such as aggies.ncat.edu cannot be used.</p>
    {linkError && !sent && <Alert variant="destructive" className="mt-4">
      <AlertDescription>This sign-in link is invalid or expired. Request a new link below.</AlertDescription>
      <AlertAction><Button type="button" variant="ghost" size="sm" onClick={() => setLinkError(false)}>Dismiss</Button></AlertAction>
    </Alert>}
    <form onSubmit={submit} className="mt-6 space-y-4">
      <Field><FieldLabel htmlFor="sign-in-email">Personal email</FieldLabel><Input id="sign-in-email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required disabled={pending} aria-describedby="email-help"/><FieldDescription id="email-help">Use an address you personally own, such as Gmail, Outlook, or iCloud.</FieldDescription></Field>
      {claiming && <Field><FieldLabel htmlFor="sign-in-name">Your name</FieldLabel><Input id="sign-in-name" autoComplete="name" value={name} onChange={event => setName(event.target.value)} required maxLength={100} disabled={pending}/></Field>}
      {error && <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
        <AlertAction><Button type="button" variant="ghost" size="sm" onClick={() => setError("")}>Dismiss</Button></AlertAction>
      </Alert>}
      {sent && <Alert>
        <AlertDescription>Check your personal inbox for a sign-in link. It expires in 10 minutes and can be used once. Check your spam folder if it has not arrived.</AlertDescription>
        <AlertAction><Button type="button" variant="ghost" size="sm" onClick={() => setSent(false)}>Dismiss</Button></AlertAction>
      </Alert>}
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Sending link…" : sent ? "Send another sign-in link" : "Send sign-in link"}</Button>
    </form>
    <p className="mt-5 text-xs leading-5 text-muted-foreground">The first sign-in with the seeded admin email claims that account. After that, an admin invites each team member. Everyone who signs in can view and edit the shared testing workspace.</p>
  </CardContent></Card>;
}
