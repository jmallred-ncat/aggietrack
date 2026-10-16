import { cache } from "react";
import { headers } from "next/headers";
import { readWorkspace } from "./database";
import { getWorkspaceSession } from "./auth";
import { isAdminRole, type TeamMember } from "./members";
import { getPrisma } from "./prisma";
import { listTeam } from "./team";
import { withSharedDatabase } from "./shared-database";
import type { Workspace } from "./model";

export type WorkspaceUser = { name: string; email: string; admin: boolean; organizationRole: string; responsibilities: string };

export const loadWorkspace = cache(async (): Promise<{ workspace: Workspace; members: TeamMember[]; user: WorkspaceUser } | null> => {
  return withSharedDatabase(async () => {
    const session = await getWorkspaceSession(await headers());
    if (!session) return null;
    const [workspace, members, profile] = await Promise.all([readWorkspace(), listTeam(), getPrisma().user.findUnique({ where: { email: session.user.email }, select: { organizationRole: true, responsibilities: true } })]);
    return {
      workspace,
      members,
      user: { name: session.user.name, email: session.user.email, admin: isAdminRole(session.user.role), organizationRole: profile?.organizationRole ?? "", responsibilities: profile?.responsibilities ?? "" },
    };
  });
});
