import { handleUpload } from "@vercel/blob/client";
import { getWorkspaceSession } from "@/lib/auth";
import { checkScreenshot, prepareScreenshotUpload, registerScreenshot, ScreenshotError, vercelBlobReader } from "@/lib/screenshots";
import { maxScreenshotBytes } from "@/lib/screenshot-rules";
import { withSharedDatabase } from "@/lib/shared-database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  try {
    if (!origin || new URL(origin).host !== request.headers.get("host")) return false;
  } catch { return false; }
  return true;
}

function message(error: unknown) {
  return error instanceof ScreenshotError ? error.message : "Could not add that screenshot.";
}

export async function POST(request: Request) {
  return withSharedDatabase(async () => {
    const session = await getWorkspaceSession(request.headers);
    if (!session) return Response.json({ error: "Sign in to add a screenshot." }, { status: 401 });
    if (!sameOrigin(request)) return Response.json({ error: "Invalid origin." }, { status: 403 });
    let body: unknown;
    try { body = await request.json(); }
    catch { return Response.json({ error: "Could not add that screenshot." }, { status: 400 }); }
    const input = body && typeof body === "object" ? body as Record<string, unknown> : {};
    if (input.type === "blob.generate-client-token" || input.type === "blob.upload-completed") {
      try {
        const result = await handleUpload({
          request,
          body: body as Parameters<typeof handleUpload>[0]["body"],
          onBeforeGenerateToken: async (pathname, clientPayload) => {
            await prepareScreenshotUpload(pathname, clientPayload);
            return {
              allowedContentTypes: ["image/png", "image/jpeg", "image/webp"],
              maximumSizeInBytes: maxScreenshotBytes,
              addRandomSuffix: true,
            };
          },
        });
        return Response.json(result);
      } catch (error) {
        return Response.json({ error: message(error) }, { status: 400 });
      }
    }
    try {
      if (input.intent === "check") {
        await checkScreenshot({
          testId: String(input.testId ?? ""),
          fileName: String(input.fileName ?? ""),
          contentType: String(input.contentType ?? ""),
          byteSize: Number(input.byteSize),
        });
        return Response.json({ ok: true });
      }
      if (input.intent === "save") {
        const screenshot = await registerScreenshot({
          testId: String(input.testId ?? ""),
          pathname: String(input.pathname ?? ""),
          fileName: String(input.fileName ?? ""),
          actor: { id: session.user.id, email: session.user.email },
        }, vercelBlobReader());
        return Response.json({ screenshot });
      }
      return Response.json({ error: "Could not add that screenshot." }, { status: 400 });
    } catch (error) {
      return Response.json({ error: message(error) }, { status: 400 });
    }
  });
}
