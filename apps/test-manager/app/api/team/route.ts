import { changeMember, inviteMember, listTeam, resendInvite, setMemberOrganization } from "@/lib/team";
import { getWorkspaceSession } from "@/lib/auth";
import { withSharedDatabase } from "@/lib/shared-database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withSharedDatabase(async () => {
    if (!await getWorkspaceSession(request.headers)) return Response.json({ error: "Unauthorized" }, { status: 401 });
    return Response.json({ members: await listTeam() }, { headers: { "Cache-Control": "no-store" } });
  });
}

export async function POST(request: Request) {
  return withSharedDatabase(async () => post(request));
}
async function post(request: Request) {
  const origin = request.headers.get("origin");
  try {
    if (!origin || new URL(origin).host !== request.headers.get("host")) throw new Error("Invalid origin");
  } catch { return Response.json({ error: "Invalid origin" }, { status: 403 }); }
  try {
    const input = await request.json();
    if (input.action === "organization") await setMemberOrganization(request.headers, input);
    else if (input.action === "resend") await resendInvite(request.headers, input);
    else if (!input.action || input.action === "invite") await inviteMember(request.headers, input);
    else await changeMember(request.headers, input);
    return Response.json({ members: await listTeam() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update the team.";
    const status = message.startsWith("Sign in") ? 401 : message.startsWith("Only an admin") ? 403 : 400;
    return Response.json({ error: message }, { status });
  }
}
