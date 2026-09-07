"use client"

import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardSidebar from "./dashboard-sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return <SidebarProvider>
        <DashboardSidebar />
        <SidebarInset>
            <main>
                <TooltipProvider>
                    <header className="px-4 not-typeset py-2">
                        <div className="flex items-center gap-2">
                            <SidebarTrigger />
                            <ul>
                                Breadcrumbs
                            </ul>
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