import { readWorkspace, saveRecord, setArchived } from "@/lib/database";
import { getWorkspaceSession } from "@/lib/auth";
import { memberLabel } from "@/lib/members";
import { listTeam } from "@/lib/team";
import { withSharedDatabase } from "@/lib/shared-database";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return withSharedDatabase(async () => {
    if (!await getWorkspaceSession(request.headers)) return Response.json({ error: "Unauthorized" }, { status: 401 });
    return Response.json({ ...await readWorkspace(), members: await listTeam() }, { headers: { "Cache-Control": "no-store" } });
  });
}
export async function POST(request: Request) {
  return withSharedDatabase(async () => post(request));
}
async function post(request: Request) {
  const session = await getWorkspaceSession(request.headers);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const origin = request.headers.get("origin");
  try {
    // Next may normalize request.url to localhost while the browser uses 127.0.0.1.
    if (!origin || new URL(origin).host !== request.headers.get("host")) throw new Error("Invalid origin");
  } catch { return Response.json({ error: "Invalid origin" }, { status: 403 }); }
  try {
    const input = await request.json();
    const members = await listTeam();
    const actor = { id: session.user.id, email: session.user.email };
    if (typeof input.archive === "boolean") {
      if (typeof input.section !== "string" || typeof input.id !== "string" || !Number.isInteger(input.revision)) throw new Error("Invalid request.");
      await setArchived(input.section, input.id, input.archive, input.revision, undefined, actor);
    } else {
      if (typeof input.section !== "string" || typeof input.id !== "string" || !(input.revision === null || Number.isInteger(input.revision))) throw new Error("Invalid request.");
      if (input.section === "Tests" && input.values && typeof input.values === "object" && input.values.Status !== "Not run") input.values.Tester = memberLabel(session.user);
      await saveRecord(input.section, input.id, input.values, input.revision, undefined, actor, members.filter(member => member.emailVerified).map(memberLabel));
    }
    return Response.json({ ...await readWorkspace(), members });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save." }, { status: 400 });
  }
}
