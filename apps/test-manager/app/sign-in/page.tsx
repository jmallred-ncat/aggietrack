import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getWorkspaceSession } from "@/lib/auth";
import { SignInForm } from "./sign-in-form";
import { withSharedDatabase } from "@/lib/shared-database";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export default async function SignInPage() {
  return withSharedDatabase(async () => {
    if (await getWorkspaceSession(await headers())) redirect("/");
    return <main className="flex flex-1 items-center justify-center p-5"><SignInForm/></main>;
  });
}
