import { TestStudentError, ensureTestStudents } from "@/lib/test-student-accounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const result = await ensureTestStudents(request);
    return Response.json({ 
      succeeded: result.succeeded,
      failed: result.failed,
      // Legacy compatibility
      students: result.succeeded 
    });
  } catch (error) {
    const message = error instanceof TestStudentError ? error.message : "Test students could not be prepared.";
    const status = error instanceof TestStudentError ? error.status : 500;
    
    // Log the full error for debugging
    if (!(error instanceof TestStudentError)) {
      console.error("Test students ensure error:", error);
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
