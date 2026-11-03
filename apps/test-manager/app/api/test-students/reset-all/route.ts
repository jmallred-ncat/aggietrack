import { testStudentConfig, callAggieTrack } from "@/lib/test-students";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const config = testStudentConfig();
  if (!config.ready) {
    return Response.json({ error: "Test student environment is not configured." }, { status: 500 });
  }

  const succeeded: Array<{ email: string; name: string }> = [];
  const failed: Array<{ email: string; error: string }> = [];

  // Get all test student emails from the cards
  const { testAccountCards } = await import("@/lib/test-students");
  const students = testAccountCards.filter(s => s.role === "student");

  // Reset each student, continuing past failures
  for (const student of students) {
    try {
      await callAggieTrack("/api/test-students/reset", JSON.stringify({ email: student.email }));
      succeeded.push({ email: student.email, name: student.name });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      failed.push({ email: student.email, error: errorMessage });
    }
  }

  return Response.json({ 
    succeeded, 
    failed,
    total: students.length 
  });
}
