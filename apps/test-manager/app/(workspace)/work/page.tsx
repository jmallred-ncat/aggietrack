import { redirect } from "next/navigation";
import { YourWork } from "@/components/your-work";
import { loadWorkspace } from "@/lib/load-workspace";

export default async function Page() {
  const data = await loadWorkspace();
  if (!data) redirect("/sign-in");
  return <YourWork workspace={data.workspace} user={data.user}/>;
}
