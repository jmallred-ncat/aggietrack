import { TestStudentError, resetTestPlanNotes } from "@/lib/test-student-accounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    try {
        const result = await resetTestPlanNotes(request);
        return Response.json(result);
    } catch (error) {
        if (error instanceof TestStudentError) {
            return Response.json({ error: error.message }, { status: error.status });
        }
        console.error("Test plan notes reset error:", error);
        return Response.json({ error: "Plan notes could not be reset." }, { status: 500 });
    }
}
