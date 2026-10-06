"use client";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BookOpenTextIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

export default function PlannerNavigation({
    terms,
    children,
}: {
    terms: { id: string; label: string }[];
    children: ReactNode;
}) {
    const requestedTerm = useSearchParams().get("term");
    const activeId = terms.some((term) => term.id === requestedTerm) ? requestedTerm : terms[0]?.id;

    return (
        <nav className="mt-4 flex w-full flex-col items-stretch gap-3">
            <div className="flex flex-wrap gap-2">
                {terms.map((term) => {
                    const active = term.id === activeId;
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
            <Sheet>
                <SheetTrigger className="flex w-full items-start gap-3 rounded-lg border border-border bg-background px-3 py-3 text-left transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                        <BookOpenTextIcon className="size-5" />
                    </span>
                    <span className="min-w-0">
                        <span className="block text-sm font-medium text-foreground">Program Outline</span>
                        <span className="mt-0.5 block text-sm font-normal text-balance text-muted-foreground">
                            See the handbook sequence for your catalog year. Use it as a reference while you choose courses for this term.
                        </span>
                    </span>
                </SheetTrigger>
                <SheetContent side="right" className="w-full gap-0 overflow-y-auto data-[side=right]:sm:max-w-3xl">
                    <SheetHeader className="pr-12">
                        <SheetTitle className="text-lg">Program Outline</SheetTitle>
                    </SheetHeader>
                    {children}
                </SheetContent>
            </Sheet>
        </nav>
    );
}
