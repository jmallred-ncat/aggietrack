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
    
    // Log the full error for debugging
    if (!(error instanceof TestStudentError)) {
      console.error("Test student reset error:", error);
    }
    
    // Return a more detailed error message in non-production
    const detailedMessage = process.env.VERCEL_ENV === "production" 
      ? message 
      : error instanceof Error 
        ? `${message} (${error.message})` 
        : message;
    
    return Response.json({ error: detailedMessage }, { status });
  }
}
