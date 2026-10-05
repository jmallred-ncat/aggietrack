"use client";

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { useSelectedLayoutSegments } from "next/navigation";
import { Fragment } from "react/jsx-runtime";

const labels: Record<string, string> = {
    student: "Dashboard",
    advisor: "Dashboard",
    admin: "Dashboard",
    students: "Students",
    plans: "Plans",
    appointments: "Appointments",
    progress: "Progress",
    courses: "Courses",
    planner: "Planner",
    advising: "Advising",
    profile: "Profile",
    security: "Security",
    notifications: "Notifications",
    account: "Account",
    outline: "Program Outline",
}

export default function DashboardBreadcrumbs() {
    const segments = useSelectedLayoutSegments().filter((segment) => !segment.startsWith("("));

    return (
        <Breadcrumb>
            <BreadcrumbList className="font-semibold">
                {segments.map((segment, i) => {
                    const href = `/${segments.slice(0, i + 1).join("/")}`;
                    const isLast = i === segments.length - 1;

                    return (
                        <Fragment key={href}>
                            <BreadcrumbItem>
                                <BreadcrumbLink href={href} className={cn(isLast && "text-foreground pointer-events-none")}>{labels[segment] ?? segment}</BreadcrumbLink>
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
