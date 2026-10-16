import { getAuth } from "@/lib/auth";
import { withSharedDatabase } from "@/lib/shared-database";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function handle(request: Request) { return withSharedDatabase(() => getAuth().handler(request)); }
export async function GET(request: Request) { return handle(request); }
export async function POST(request: Request) { return handle(request); }
