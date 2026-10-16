import { getAuth, getWorkspaceSession } from "./auth";
import { personalEmail } from "./email-policy";
import { isAdminRole, organizationAssignment, type TeamMember } from "./members";
import { getPrisma } from "./prisma";

export type MemberAction = "promote" | "demote" | "remove" | "revoke";

export function memberActionError(actorEmail: string, target: { email: string; role: string | null; emailVerified: boolean }, action: MemberAction, verifiedAdminCount: number) {
  const self = actorEmail === target.email;
  const admin = isAdminRole(target.role);
  if (action === "promote") {
    if (!target.emailVerified) return "They need to accept the invite before becoming an admin.";
    if (admin) return "That person is already an admin.";
    return null;
  }
  if (action === "revoke") {
    if (target.emailVerified) return "Verified members are removed, not revoked.";
    return null;
  }
  if (self) return action === "demote" ? "Another admin has to change your role." : "You cannot remove yourself.";
  if (admin && verifiedAdminCount <= 1) return action === "demote" ? "The last admin cannot return to member." : "The last admin cannot be removed.";
  if (action === "demote" && !admin) return "That person is already a member.";
  if (action === "remove" && !target.emailVerified) return "Revoke the invite instead of removing this person.";
  return null;
}

export async function listTeam(db = getPrisma()): Promise<TeamMember[]> {
  const users = await db.user.findMany({ orderBy: [{ name: "asc" }, { email: "asc" }], select: { name: true, email: true, role: true, emailVerified: true, banned: true, organizationRole: true, responsibilities: true } });
  return users.filter(user => user.banned !== true).map(({ name, email, role, emailVerified, organizationRole, responsibilities }) => ({ name, email, role, emailVerified, organizationRole, responsibilities }));
}

export async function setMemberOrganization(headers: Headers, input: { email?: unknown; organizationRole?: unknown; responsibilities?: unknown }) {
  const session = await getWorkspaceSession(headers);
  if (!session) throw new Error("Sign in before managing the team.");
  if (!isAdminRole(session.user.role)) throw new Error("Only an admin can manage team members.");
  const email = personalEmail(input.email);
  const assignment = organizationAssignment(input.organizationRole, input.responsibilities);
  const target = await getPrisma().user.findUnique({ where: { email } });
  if (!target || target.banned === true) throw new Error("That person is not on the team.");
  await getPrisma().user.update({ where: { email }, data: assignment });
}

export async function resendInvite(headers: Headers, input: { email?: unknown }) {
  const session = await getWorkspaceSession(headers);
  if (!session) throw new Error("Sign in before inviting a team member.");
  if (!isAdminRole(session.user.role)) throw new Error("Only an admin can invite team members.");
  const email = personalEmail(input.email);
  const existing = await getPrisma().user.findUnique({ where: { email } });
  if (!existing || existing.banned === true) throw new Error("That person is not on the team.");
  if (existing.emailVerified) throw new Error("They have already signed in.");
  await getAuth().api.signInMagicLink({ body: { email, name: existing.name, callbackURL: "/", errorCallbackURL: "/sign-in" }, headers });
}

export async function inviteMember(headers: Headers, input: { name?: unknown; email?: unknown }) {
  const session = await getWorkspaceSession(headers);
  if (!session) throw new Error("Sign in before inviting a team member.");
  if (!isAdminRole(session.user.role)) throw new Error("Only an admin can invite team members.");
  const email = personalEmail(input.email);
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 100) throw new Error("Enter the team member's name.");
  const existing = await getPrisma().user.findUnique({ where: { email } });
  if (!existing) await getAuth().api.createUser({ body: { email, name, role: "user" }, headers });
  await getAuth().api.signInMagicLink({ body: { email, name: existing?.name || name, callbackURL: "/", errorCallbackURL: "/sign-in" }, headers });
}

export async function changeMember(headers: Headers, input: { action?: unknown; email?: unknown }) {
  const session = await getWorkspaceSession(headers);
  if (!session) throw new Error("Sign in before managing the team.");
  if (!isAdminRole(session.user.role)) throw new Error("Only an admin can manage team members.");
  const action = input.action;
  if (action !== "promote" && action !== "demote" && action !== "remove" && action !== "revoke") throw new Error("Choose a team action.");
  const email = personalEmail(input.email);
  const db = getPrisma();
  const target = await db.user.findUnique({ where: { email } });
  if (!target || target.banned === true) throw new Error("That person is not on the team.");
  const verifiedAdminCount = (await db.user.findMany({ select: { role: true, emailVerified: true, banned: true } })).filter(user => user.emailVerified && user.banned !== true && isAdminRole(user.role)).length;
  const refusal = memberActionError(session.user.email, target, action, verifiedAdminCount);
  if (refusal) throw new Error(refusal);
  if (action === "remove" || action === "revoke") {
    const outstanding = await db.verification.findMany({ select: { id: true, value: true } });
    const stale = outstanding.filter(row => { try { return JSON.parse(row.value).email === email; } catch { return false; } }).map(row => row.id);
    if (stale.length > 0) await db.verification.deleteMany({ where: { id: { in: stale } } });
    await getAuth().api.removeUser({ body: { userId: target.id }, headers });
    return;
  }
  await getAuth().api.setRole({ body: { userId: target.id, role: action === "promote" ? "admin" : "user" }, headers });
}
