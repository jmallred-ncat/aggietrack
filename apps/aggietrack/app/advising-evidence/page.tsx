import DashboardSidebar from "@/app/(app)/dashboard-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import type { User } from "@/lib/generated/prisma/client";
import type { StudentProfileWithCatalog } from "@/lib/student";
import { notFound } from "next/navigation";
import { EvidenceBoard } from "./evidence-app";
import { EvidenceCrumbs } from "./evidence-crumbs";

function user(role: "STUDENT" | "ADVISOR", name: string): User {
    const [firstName, ...rest] = name.split(" ");
    return {
        id: role === "STUDENT" ? "fixture-student" : "fixture-advisor",
        name,
        email: "fixture@example.test",
        emailVerified: true,
        image: null,
        firstName: firstName ?? name,
        lastName: rest.join(" ") || "User",
        role,
        banned: false,
        banReason: null,
        banExpires: null,
        createdAt: new Date("2026-11-08T15:00:00.000Z"),
        updatedAt: new Date("2026-11-08T15:00:00.000Z"),
    };
}

const studentProfile = {
    startConfirmedAt: new Date("2026-11-08T15:00:00.000Z"),
    catalogYear: { program: { name: "Information Technology", degree: { abbreviation: "B.S." } } },
} as StudentProfileWithCatalog;

function sceneMeta(scene: string) {
    if (scene === "advisor-dashboard") return { role: "ADVISOR" as const, name: "Sarah Martinez", crumb: "Dashboard" };
    if (scene.startsWith("advisor") || scene === "reschedule-fail" || scene === "availability-conflict" || scene === "loading-advisor" || scene === "dst-labels" || scene === "session-unavailable-advisor") {
        return { role: "ADVISOR" as const, name: "Sarah Martinez", crumb: "Appointments" };
    }
    if (scene === "student-dashboard") return { role: "STUDENT" as const, name: "Avery Cole", crumb: "Dashboard" };
    return { role: "STUDENT" as const, name: "Avery Cole", crumb: "Advising" };
}

export default async function AdvisingEvidencePage({
    searchParams,
}: {
    searchParams: Promise<{ scene?: string; theme?: string; sidebar?: string }>;
}) {
    if (process.env.NODE_ENV === "production") notFound();
    const params = await searchParams;
    const scene = params.scene ?? "student-open";
    const theme = params.theme === "dark" ? "dark" : "light";
    const meta = sceneMeta(scene);
    const home = meta.role === "STUDENT" ? "/student" : "/advisor";
    return (
        <SidebarProvider defaultOpen={params.sidebar !== "closed"} className="h-svh min-h-0 overflow-hidden">
            <DashboardSidebar user={user(meta.role, meta.name)} profile={meta.role === "STUDENT" ? studentProfile : null} />
            <SidebarInset className="min-h-0 min-w-0 overflow-hidden">
                <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                    <header className="shrink-0 px-4 not-typeset py-2">
                        <div className="flex items-center space-x-2">
                            <SidebarTrigger />
                            <Separator orientation="vertical" className="mr-3" />
                            <EvidenceCrumbs home={home} crumb={meta.crumb} />
                        </div>
                    </header>
                    <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
                        <div className="container mx-auto px-4">
                            <EvidenceBoard scene={scene} theme={theme} />
                        </div>
                    </div>
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
