import { redirect } from "next/navigation";
import { WorkspaceFrame } from "@/components/workspace-frame";
import { loadWorkspace } from "@/lib/load-workspace";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const data = await loadWorkspace();
  if (!data) redirect("/sign-in");
  return <WorkspaceFrame user={data.user}>{children}</WorkspaceFrame>;
}
