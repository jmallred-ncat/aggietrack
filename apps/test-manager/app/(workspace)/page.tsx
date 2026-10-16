import { redirect } from "next/navigation";
import { Overview } from "@/components/overview";
import { loadWorkspace } from "@/lib/load-workspace";

export default async function Page() {
  const data = await loadWorkspace();
  if (!data) redirect("/sign-in");
  return <Overview workspace={data.workspace}/>;
}
