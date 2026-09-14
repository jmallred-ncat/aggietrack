import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const runtime = "nodejs";

const { GET, POST: handlePost } = toNextJsHandler(auth);

export { GET };

export async function POST(request: Request) {
    try {
        const response = await handlePost(request);
        if (!response.ok) {
            const body = await response.clone().text();
            console.error(`Auth POST ${new URL(request.url).pathname} failed: ${response.status}`, body);
        }
        return response;
    } catch (error) {
        console.error("Auth POST threw:", error);
        throw error;
    }
}
