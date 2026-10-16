"use client";

import { useState } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@aggietrack/ui/alert-dialog";
import { Button } from "@aggietrack/ui/button";
import { Card, CardContent } from "@aggietrack/ui/card";
import { Field, FieldLabel } from "@aggietrack/ui/field";
import { Input } from "@aggietrack/ui/input";
import { Textarea } from "@aggietrack/ui/textarea";
import { isAdminRole, type TeamMember } from "@/lib/members";
import type { MemberAction } from "@/lib/team";

const confirmCopy: Record<Exclude<MemberAction, "promote">, { title: string; description: string; confirm: string }> = {
  demote: { title: "Return this admin to a member?", description: "They keep their account and can still edit the workspace. They can no longer invite or manage the team.", confirm: "Return to member" },
  remove: { title: "Remove this team member?", description: "Their account and sessions are deleted. Tests already assigned to them keep that name in their history.", confirm: "Remove member" },
  revoke: { title: "Revoke this invite?", description: "The sign-in link stops working and the account is removed. You can invite them again later.", confirm: "Revoke invite" },
};

function organizationDrafts(members: TeamMember[]) {
  return Object.fromEntries(members.map(member => [member.email, { organizationRole: member.organizationRole, responsibilities: member.responsibilities }]));
}

function roleChoices(members: TeamMember[]) {
  return [...new Set(members.map(member => member.organizationRole.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function RoleField({ id, label, value, options, disabled, onChange }: { id: string; label: string; value: string; options: string[]; disabled: boolean; onChange: (value: string) => void }) {
  const typed = value.trim();
  const known = options.some(option => option.toLowerCase() === typed.toLowerCase());
  const items = typed && !known ? [typed, ...options] : options;
  return <Combobox.Root items={items} value={typed || null} inputValue={value} onInputValueChange={next => onChange(next.slice(0, 80))} onValueChange={next => onChange(next ?? "")} filter={(item, query) => item.toLowerCase().includes(query.trim().toLowerCase())}>
    <Combobox.Input id={id} aria-label={label} disabled={disabled} placeholder="Add a role" maxLength={80} className="h-8 w-full rounded-lg border bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"/>
    <Combobox.Portal>
      <Combobox.Positioner sideOffset={4} className="z-50">
        <Combobox.Popup className="max-h-64 w-(--anchor-width) min-w-56 origin-(--transform-origin) overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10">
          <Combobox.Empty className="px-2 py-2 text-sm text-muted-foreground">{typed ? `Add “${typed}”` : "Type a role, or leave this empty."}</Combobox.Empty>
          <Combobox.List>
            {(item: string) => <Combobox.Item key={item} value={item} className="cursor-default rounded-md px-2 py-1.5 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground">{item === typed && !known ? `Add “${item}”` : item}</Combobox.Item>}
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  </Combobox.Root>;
}

export function TeamPanel({ user, members: initialMembers }: { user: { email: string; admin: boolean }; members: TeamMember[] }) {
  const [members, setMembers] = useState(initialMembers);
  const [drafts, setDrafts] = useState(() => organizationDrafts(initialMembers));
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [pending, setPending] = useState("");
  const [confirming, setConfirming] = useState<{ email: string; action: Exclude<MemberAction, "promote"> } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const verifiedAdmins = members.filter(member => member.emailVerified && isAdminRole(member.role)).length;
  const roles = roleChoices(members);

  async function act(action: MemberAction | "invite" | "resend", email = inviteEmail, name = inviteName) {
    setPending(action === "resend" ? `resend:${email}` : email || action);
    setError("");
    try {
      const response = await fetch("/api/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action === "invite" ? { action, name, email } : { action, email }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to update the team.");
      setMembers(result.members);
      setDrafts(organizationDrafts(result.members));
      if (action === "invite" || action === "resend") setNotice(action === "resend" ? "Invite sent again. They can sign in from the link in that email." : "Invite sent. They can sign in from the link in that email.");
      if (action === "invite") { setInviteName(""); setInviteEmail(""); }
      else if (action !== "resend") setNotice(action === "promote" ? "They are now an admin." : action === "demote" ? "They are now a member." : action === "revoke" ? "Invite revoked." : "Team member removed.");
      setConfirming(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update the team.");
    } finally { setPending(""); }
  }

  async function saveOrganization(email: string) {
    const draft = drafts[email];
    if (!draft) return;
    setPending(email);
    setError("");
    try {
      const response = await fetch("/api/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "organization", email, organizationRole: draft.organizationRole, responsibilities: draft.responsibilities }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to update the team.");
      setMembers(result.members);
      setDrafts(organizationDrafts(result.members));
      setNotice("Saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update the team.");
    } finally { setPending(""); }
  }

  const dialog = confirmCopy[confirming?.action ?? "remove"];

  return <>
    <div className="mb-6">
      <h1 className="text-2xl font-semibold">Team</h1>
      <p className="mt-1 text-sm text-muted-foreground">Admins assign each person’s organization role and responsibilities.</p>
    </div>
    {notice && <p role="status" className="mb-3 text-sm text-muted-foreground">{notice}</p>}
    {error && !confirming && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
    <Card className="not-typeset">
      <CardContent className="space-y-6">
        <div>
          <h2 className="font-semibold">Team members</h2>
          <ul className="mt-3 divide-y rounded-lg border">
            {members.map(member => {
              const admin = isAdminRole(member.role);
              const self = member.email === user.email;
              const lastAdmin = admin && verifiedAdmins <= 1;
              const draft = drafts[member.email] ?? { organizationRole: member.organizationRole, responsibilities: member.responsibilities };
              return <li key={member.email} className="space-y-4 px-4 py-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{member.name}</p>
                    <p className="text-muted-foreground">{member.email}</p>
                  </div>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">{member.emailVerified ? admin ? "Admin" : "Member" : "Invite sent"}</span>
                    {user.admin && !member.emailVerified && <Button type="button" variant="outline" size="sm" disabled={pending !== ""} onClick={() => act("resend", member.email)}>{pending === `resend:${member.email}` ? "Sending…" : "Resend invite"}</Button>}
                    {user.admin && !member.emailVerified && <Button type="button" variant="outline" size="sm" disabled={pending !== ""} onClick={() => setConfirming({ email: member.email, action: "revoke" })}>Revoke invite</Button>}
                    {user.admin && member.emailVerified && !admin && <Button type="button" variant="outline" size="sm" disabled={pending !== ""} onClick={() => act("promote", member.email)}>Promote to admin</Button>}
                    {user.admin && member.emailVerified && admin && <Button type="button" variant="outline" size="sm" disabled={pending !== "" || self || lastAdmin} onClick={() => setConfirming({ email: member.email, action: "demote" })}>Return to member</Button>}
                    {user.admin && member.emailVerified && <Button type="button" variant="outline" size="sm" disabled={pending !== "" || self || lastAdmin} onClick={() => setConfirming({ email: member.email, action: "remove" })}>Remove</Button>}
                  </span>
                </div>
                {user.admin ? <form className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] sm:items-end" onSubmit={event => { event.preventDefault(); saveOrganization(member.email); }}>
                  <Field><FieldLabel htmlFor={`role-${member.email}`}>Organization role</FieldLabel><RoleField id={`role-${member.email}`} label={`Organization role for ${member.name}`} value={draft.organizationRole} options={roles} disabled={pending !== ""} onChange={organizationRole => setDrafts(current => ({ ...current, [member.email]: { ...draft, organizationRole } }))}/></Field>
                  <Field><FieldLabel htmlFor={`responsibilities-${member.email}`}>Responsibilities</FieldLabel><Textarea id={`responsibilities-${member.email}`} value={draft.responsibilities} rows={2} maxLength={400} disabled={pending !== ""} onChange={event => setDrafts(current => ({ ...current, [member.email]: { ...draft, responsibilities: event.target.value } }))}/></Field>
                  <Button type="submit" variant="outline" disabled={pending !== ""}>{pending === member.email ? "Saving…" : "Save"}</Button>
                </form> : <div>
                  <p>{draft.organizationRole || "No organization role"}</p>
                  {draft.responsibilities && <p className="mt-1 leading-6 text-muted-foreground">{draft.responsibilities}</p>}
                </div>}
              </li>;
            })}
            {members.length === 0 && <li className="px-3 py-4 text-sm text-muted-foreground">No team members yet.</li>}
          </ul>
        </div>
        {user.admin ? <form className="space-y-4" onSubmit={event => { event.preventDefault(); act("invite"); }}>
          <h2 className="font-semibold">Invite a team member</h2>
          <Field><FieldLabel htmlFor="invite-name">Name</FieldLabel><Input id="invite-name" value={inviteName} onChange={event => setInviteName(event.target.value)} required maxLength={100} disabled={pending !== ""}/></Field>
          <Field><FieldLabel htmlFor="invite-email">Personal email</FieldLabel><Input id="invite-email" type="email" value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} required disabled={pending !== ""}/></Field>
          <Button type="submit" disabled={pending !== ""}>{pending !== "" && pending === inviteEmail ? "Sending invite…" : "Send invite"}</Button>
        </form> : <p className="text-sm text-muted-foreground">An admin can invite more people. You can still assign tests to anyone listed here.</p>}
      </CardContent>
    </Card>
    <AlertDialog open={confirming !== null} onOpenChange={open => { if (!open && pending === "") { setConfirming(null); setError(""); } }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{dialog.title}</AlertDialogTitle>
          <AlertDialogDescription>{confirming ? `${confirming.email}. ${dialog.description}` : dialog.description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && confirming && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending !== ""}>Cancel</AlertDialogCancel>
          <Button disabled={pending !== "" || !confirming} onClick={() => confirming && act(confirming.action, confirming.email)}>{pending !== "" ? "Working…" : dialog.confirm}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
