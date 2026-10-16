import { redirect } from "next/navigation";
import { TeamPanel } from "@/components/team-panel";
import { loadWorkspace } from "@/lib/load-workspace";

export default async function Page() {
  const data = await loadWorkspace();
  if (!data) redirect("/sign-in");
  return <TeamPanel user={data.user} members={data.members}/>;
}
