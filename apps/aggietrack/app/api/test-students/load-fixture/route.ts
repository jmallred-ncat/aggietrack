import { TestStudentError, loadTestTranscriptFixture } from "@/lib/test-student-accounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => null);
        const email = typeof body?.email === "string" ? body.email : "";
        const fixture = typeof body?.fixture === "string" ? body.fixture : "";
        const result = await loadTestTranscriptFixture(request, email, fixture);
        return Response.json(result);
    } catch (error) {
        if (error instanceof TestStudentError) {
            return Response.json({ error: error.message, accountChanged: false }, { status: error.status });
        }
        console.error("Transcript fixture error:", error);
        return Response.json({ error: "That transcript could not be loaded.", accountChanged: false }, { status: 500 });
    }
}
