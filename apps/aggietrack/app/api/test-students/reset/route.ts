import { TestStudentError, resetTestStudent } from "@/lib/test-student-accounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email : "";
    const student = await resetTestStudent(request, email);
    return Response.json(student);
  } catch (error) {
    const message = error instanceof TestStudentError ? error.message : "That student could not be reset.";
    const status = error instanceof TestStudentError ? error.status : 500;
    return Response.json({ error: message }, { status });
  }
}
