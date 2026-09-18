"use client";

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { useSelectedLayoutSegments } from "next/navigation";
import { Fragment } from "react/jsx-runtime";

const labels: Record<string, string> = {
    dashboard: "Dashboard",
    progress: "Progress",
    courses: "Courses",
    planner: "Planner",
    advising: "Advising",
    profile: "Profile",
    security: "Security",
    notifications: "Notifications",
    account: "Account",
}

export default function DashboardBreadcrumbs() {
    const segments = useSelectedLayoutSegments().filter((s) => s !== "dashboard");

    return (
        <Breadcrumb>
            <BreadcrumbList className="font-semibold">
                <BreadcrumbItem>
                    <BreadcrumbLink href="/dashboard" className={cn(segments.length > 0 ? "text-muted-foreground" : "text-foreground pointer-events-none")}>
                        Dashboard
                    </BreadcrumbLink>
                </BreadcrumbItem>
                {segments.length > 0 && <BreadcrumbSeparator />}
                {segments.map((segment, i) => {
                    const href = `/dashboard/${segments.slice(0, i + 1).join("/")}`;
                    const isLast = i === segments.length - 1;

                    return (
                        <Fragment key={href}>
                            <BreadcrumbItem>
                                <BreadcrumbLink href={href} className={cn(isLast && "text-foreground pointer-events-none")}>{labels[segment as keyof typeof labels]}</BreadcrumbLink>
                            </BreadcrumbItem>
                            {!isLast && (
                                <BreadcrumbSeparator />
                            )}
                        </Fragment>
                    )
                })}
            </BreadcrumbList>

        </Breadcrumb>
    )
}
