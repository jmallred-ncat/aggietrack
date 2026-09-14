import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { auth } from "@/lib/auth";
import type { User } from "@/lib/generated/prisma/client";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import DashboardBreadcrumbs from "./dashboard-breadcrumbs";
import DashboardSidebar from "./dashboard-sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const session = await auth.api.getSession({
        headers: await headers()
    })

    if (!session) {
        return redirect("/");
    }

    return <SidebarProvider>
        <DashboardSidebar user={session.user as User} />
        <SidebarInset>
            <main>
                <TooltipProvider>
                    <header className="px-4 not-typeset py-2">
                        <div className="flex items-center space-x-2">
                            <SidebarTrigger />
                            <Separator orientation="vertical" className={"mr-3"} />
                            <DashboardBreadcrumbs />
                        </div>
                    </header>
                    <main className="flex flex-col px-4">
                        {children}
                    </main>
                </TooltipProvider>
            </main>
        </SidebarInset>
    </SidebarProvider>;
}