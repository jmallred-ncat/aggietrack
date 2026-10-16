"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { buttonVariants } from "@aggietrack/ui/button";
import { Button } from "@aggietrack/ui/button";
import { navGroups } from "@/lib/sections";

export function WorkspaceFrame({ user, children }: { user: { email: string }; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [notice, setNotice] = useState("");

  async function exportWorkspace() {
    const response = await fetch("/api/workspace");
    if (!response.ok) { setNotice("Unable to export the workspace."); return; }
    const { members: _members, ...workspace } = await response.json();
    const url = URL.createObjectURL(new Blob([JSON.stringify(workspace, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "test-workspace.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return <div className="flex flex-1 flex-col">
    <header className="not-typeset border-b bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-6 py-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest opacity-70">AggieTrack / Quality assurance</p>
          <Link href="/" className="mt-1 block text-xl font-semibold">Academic Planning Test Manager</Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/profile" className="mr-2 text-xs underline-offset-4 hover:underline">{user.email}</Link>
          <Button variant="secondary" onClick={() => router.refresh()}>Refresh</Button>
          <Button variant="secondary" onClick={exportWorkspace}>Export workspace</Button>
        </div>
      </div>
    </header>
    <div className="mx-auto grid w-full max-w-[1500px] flex-1 gap-6 px-4 py-6 md:grid-cols-[210px_minmax(0,1fr)] md:px-6">
      <aside>
        <nav aria-label="Workspace sections" className="not-typeset flex flex-col gap-5 md:sticky md:top-6 md:gap-6">
          {navGroups().map(group => <div key={group.label}>
            <p className="px-2.5 text-xs font-medium text-muted-foreground">{group.label}</p>
            <div className="mt-1 flex flex-wrap gap-1 md:flex-col">
              {group.items.map(item => {
                const current = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return <Link key={item.href} href={item.href} aria-current={current ? "page" : undefined} className={buttonVariants({ variant: current ? "default" : "ghost", className: "justify-start md:w-full" })}>{item.label}</Link>;
              })}
            </div>
          </div>)}
        </nav>
      </aside>
      <main className="min-w-0">
        {notice && <p role="status" className="mb-3 text-sm text-muted-foreground">{notice}</p>}
        {children}
      </main>
    </div>
  </div>;
}
