import { TestStudentError, armPlannerWriteFault } from "@/lib/test-student-accounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email : "";
    const result = await armPlannerWriteFault(request, email, body?.fault, body?.seconds);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof TestStudentError ? error.message : "That save setting could not be saved.";
    const status = error instanceof TestStudentError ? error.status : 500;
    return Response.json({ error: message }, { status });
  }
}
