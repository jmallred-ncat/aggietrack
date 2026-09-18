import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getSessionUser, getStudentProfile } from "@/lib/student";
import { redirect } from "next/navigation";
import DashboardBreadcrumbs from "./dashboard-breadcrumbs";
import DashboardSidebar from "./dashboard-sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const user = await getSessionUser();

    const profile = await getStudentProfile(user.id);

    if (user.role === "STUDENT" && !profile) {
        return redirect("/onboarding");
    }

    return (
        <SidebarProvider defaultOpen={false} className="h-svh min-h-0 overflow-hidden">
            <DashboardSidebar user={user} profile={profile} />
            <SidebarInset className="min-h-0 min-w-0 overflow-hidden">
                <TooltipProvider>
                    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                        <header className="shrink-0 px-4 not-typeset py-2">
                            <div className="flex items-center space-x-2">
                                <SidebarTrigger />
                                <Separator orientation="vertical" className="mr-3" />
                                <DashboardBreadcrumbs />
                            </div>
                        </header>
                        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4">
                            <div className="container mx-auto">
                                {children}
                            </div>
                        </div>
                    </div>
                </TooltipProvider>
            </SidebarInset>
        </SidebarProvider>
    );
}