import { getWorkspaceSession } from "@/lib/auth";
import { withSharedDatabase } from "@/lib/shared-database";
import { callAggieTrack } from "@/lib/test-students";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withSharedDatabase(async () => {
    const origin = request.headers.get("origin");
    try {
      if (!origin || new URL(origin).host !== request.headers.get("host")) throw new Error("Invalid origin");
    } catch {
      return Response.json({ error: "Invalid origin" }, { status: 403 });
    }
    if (!await getWorkspaceSession(request.headers)) return Response.json({ error: "Sign in to reset a test student." }, { status: 401 });
    try {
      const body = await request.json();
      const email = typeof body.email === "string" ? body.email : "";
      const student = await callAggieTrack("/api/test-students/reset", email);
      return Response.json(student);
    } catch (error) {
      const message = error instanceof Error ? error.message : "That student could not be reset.";
      return Response.json({ error: message }, { status: 400 });
    }
  });
}
