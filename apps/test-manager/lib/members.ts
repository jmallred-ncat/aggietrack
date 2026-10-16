export type TeamMember = { name: string; email: string; role: string | null; emailVerified: boolean; organizationRole: string; responsibilities: string };

export function organizationAssignment(role: unknown, responsibilities: unknown) {
  const organizationRole = typeof role === "string" ? role.trim().replace(/\s+/g, " ") : "";
  const text = typeof responsibilities === "string" ? responsibilities.trim() : "";
  if (organizationRole.length > 80) throw new Error("Keep the organization role to 80 characters.");
  if (text.length > 400) throw new Error("Keep responsibilities to 400 characters.");
  return { organizationRole, responsibilities: text };
}

export const claimNameMessage = "Enter your name to claim this account.";

export function memberLabel(member: { name: string; email: string }) {
  return `${member.name} (${member.email})`;
}

export function nameNeedsClaim(name: string) {
  const trimmed = name.trim();
  return trimmed.length === 0 || trimmed === "Admin";
}

export function isAdminRole(role: unknown) {
  return typeof role === "string" && role.split(",").map(part => part.trim()).includes("admin");
}
