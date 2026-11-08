"use client";

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";

export function EvidenceCrumbs({ home, crumb }: { home: string; crumb: string }) {
    return (
        <Breadcrumb>
            <BreadcrumbList className="font-semibold">
                <BreadcrumbItem>
                    <BreadcrumbLink href={home}>Dashboard</BreadcrumbLink>
                </BreadcrumbItem>
                {crumb === "Dashboard" ? null : (
                    <>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbPage className="text-foreground">{crumb}</BreadcrumbPage>
                        </BreadcrumbItem>
                    </>
                )}
            </BreadcrumbList>
        </Breadcrumb>
    );
}
