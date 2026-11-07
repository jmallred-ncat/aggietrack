import { getWorkspaceSession } from "@/lib/auth";
import { withSharedDatabase } from "@/lib/shared-database";
import { callAggieTrack, fixtureChoiceById, fixtureLoadResult, testStudentByEmail } from "@/lib/test-students";

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
      if (body.notes === true) {
        const result = await callAggieTrack("/api/test-students/reset-plan-notes");
        const deleted = result.deleted;
        if (typeof deleted !== "number" || !Number.isInteger(deleted) || deleted < 0) {
          throw new Error("Plan notes could not be reset.");
        }
        return Response.json({ deleted });
      }
      if (typeof body.fixture === "string") {
        const account = testStudentByEmail(email);
        if (!account || account.role !== "student") throw new Error("That is not a test student.");
        if (!fixtureChoiceById(body.fixture)) throw new Error("That is not a transcript fixture.");
        const loaded = fixtureLoadResult(await callAggieTrack("/api/test-students/load-fixture", account.email, { fixture: body.fixture }));
        return Response.json(loaded);
      }
      if (body.fault === "fail" || body.fault === "delay" || body.fault === "off") {
        const armed = await callAggieTrack("/api/test-students/write-fault", email, { fault: body.fault, seconds: body.seconds });
        return Response.json(armed);
      }
      const student = await callAggieTrack("/api/test-students/reset", email);
      return Response.json(student);
    } catch (error) {
      const message = error instanceof Error ? error.message : "That student could not be reset.";
      return Response.json({ error: message }, { status: 400 });
    }
  });
}
