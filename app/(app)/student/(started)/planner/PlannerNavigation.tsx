"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export default function PlannerNavigation({
    terms,
}: {
    terms: { id: string; label: string }[];
}) {
    const pathname = usePathname();
    const requestedTerm = useSearchParams().get("term");
    const onOutline = pathname === "/student/planner/outline";
    const activeId = terms.some((term) => term.id === requestedTerm) ? requestedTerm : terms[0]?.id;

    return (
        <nav className="mt-4 flex w-full flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
                {terms.map((term) => {
                    const active = !onOutline && term.id === activeId;
                    return (
                        <Button
                            key={term.id}
                            variant={active ? "secondary" : "ghost"}
                            nativeButton={false}
                            render={
                                <Link
                                    href={`/student/planner?term=${term.id}`}
                                    aria-current={active ? "page" : undefined}
                                />
                            }
                        >
                            {term.label}
                        </Button>
                    );
                })}
            </div>
            <Button
                variant="outline"
                nativeButton={false}
                className={cn(onOutline && "bg-muted")}
                render={
                    <Link
                        href="/student/planner/outline"
                        aria-current={onOutline ? "page" : undefined}
                    />
                }
            >
                Program Outline
            </Button>
        </nav>
    );
}
