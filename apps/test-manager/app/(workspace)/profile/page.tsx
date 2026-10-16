import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { loadWorkspace } from "@/lib/load-workspace";

export default async function Page() {
  const data = await loadWorkspace();
  if (!data) redirect("/sign-in");
  const { user } = data;
  const details = [
    ["Name", user.name],
    ["Email", user.email],
    ["Team access", user.admin ? "Admin" : "Member"],
    ["Organization role", user.organizationRole || "No organization role"],
    ["Responsibilities", user.responsibilities || "None recorded."],
  ];

  return <div className="not-typeset">
    <h1 className="text-2xl font-semibold">Profile</h1>
    <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Your place on this testing team. Team access is separate from your organization role.</p>
    <dl className="mt-8 max-w-xl space-y-5">
      {details.map(([label, value]) => <div key={label}>
        <dt className="text-sm text-muted-foreground">{label}</dt>
        <dd className="mt-1 text-sm leading-6">{value}</dd>
      </div>)}
    </dl>
    <div className="mt-10">
      <SignOutButton />
    </div>
  </div>;
}
