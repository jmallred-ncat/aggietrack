import { getWorkspaceSession } from "@/lib/auth";
import { openScreenshot, vercelBlobReader } from "@/lib/screenshots";
import { withSharedDatabase } from "@/lib/shared-database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function downloadName(fileName: string) {
  const ascii = fileName.replace(/[^A-Za-z0-9._ -]+/g, "").trim() || "screenshot";
  return `inline; filename="${ascii}"`;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withSharedDatabase(async () => {
    if (!await getWorkspaceSession(request.headers)) return new Response(null, { status: 401 });
    const { id } = await params;
    const image = await openScreenshot(id, vercelBlobReader());
    if (!image) return new Response(null, { status: 404 });
    return new Response(new Uint8Array(image.bytes), {
      headers: {
        "Content-Type": image.contentType,
        "Content-Disposition": downloadName(image.fileName),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
