import { TestStudentError, ensureTestStudents } from "@/lib/test-student-accounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const students = await ensureTestStudents(request);
    return Response.json({ students });
  } catch (error) {
    const message = error instanceof TestStudentError ? error.message : "Test students could not be prepared.";
    const status = error instanceof TestStudentError ? error.status : 500;
    return Response.json({ error: message }, { status });
  }
}
