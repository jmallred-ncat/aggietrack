"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { toast } from "@/components/ui/toast";
import type { PlannedTermStatus } from "@/lib/generated/prisma/client";
import { MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react";
import { useRef, useState, useTransition } from "react";
import { addPlannedCourse, markPlannedTermRegistered, removePlannedCourse, submitPlannedTerm } from "./actions";

type CatalogCourse = {
    id: string;
    subject: string;
    number: string;
    title: string;
    credits: number;
};

type PlannedRow = CatalogCourse & { plannedCourseId: string };

export default function PlanEditor({
    termId,
    termLabel,
    advisorName,
    plan,
    courses,
}: {
    termId: string;
    termLabel: string;
    advisorName: string | null;
    plan: {
        id: string;
        status: PlannedTermStatus;
        registrationPin: string | null;
        registered: boolean;
        courses: PlannedRow[];
    } | null;
    courses: CatalogCourse[];
}) {
    const [query, setQuery] = useState("");
    const [resultsOpen, setResultsOpen] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const [pending, startTransition] = useTransition();
    const status = plan?.status ?? "DRAFT";
    const editable = status === "DRAFT";
    const plannedIds = new Set(plan?.courses.map((course) => course.id) ?? []);
    const needle = query.trim().toLowerCase();
    const matches = needle.length < 2
        ? []
        : courses
            .filter((course) => !plannedIds.has(course.id))
            .filter((course) => `${course.subject} ${course.number} ${course.title}`.toLowerCase().includes(needle))
            .slice(0, 8);

    function run(action: () => Promise<{ success: boolean; error?: string }>, success: string) {
        startTransition(async () => {
            const result = await action();
            if (!result.success) {
                toast.add({ title: result.error ?? "That change could not be saved." });
                return;
            }
            toast.add({ title: success });
            setQuery("");
            setResultsOpen(false);
        });
    }

    return (
        <section>
            <header className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-bold not-typeset text-balance">{termLabel}</h2>
                <Badge className="not-typeset" variant={status === "APPROVED" ? "default" : "secondary"}>
                    {status === "DRAFT" ? "Draft" : status === "SUBMITTED" ? "Submitted" : "Approved"}
                </Badge>
            </header>

            <p className="mt-2 max-w-prose text-sm text-balance text-muted-foreground">
                {plan?.registered
                    ? "These courses are on your transcript as in progress."
                    : status === "APPROVED"
                        ? "Your advisor approved this plan. Register with the pin, then record the courses as in progress."
                        : status === "SUBMITTED"
                            ? advisorName
                                ? `Waiting for ${advisorName} to review this plan and add a registration pin.`
                                : "Waiting for an advisor to review this plan. No advisor is assigned yet."
                            : advisorName
                                ? `Add the courses you want to take, then submit the plan for ${advisorName} to review.`
                                : "Add the courses you want to take, then submit the plan. No advisor is assigned yet."}
            </p>

            {status === "APPROVED" && plan?.registrationPin && (
                <p className="mt-4 inline-flex items-center gap-3 rounded-lg bg-muted px-4 py-3 not-typeset">
                    <span className="text-sm text-muted-foreground">Registration pin</span>
                    <span className="font-mono text-lg font-semibold tracking-wide">{plan.registrationPin}</span>
                </p>
            )}

            {editable && (
                <div className="mt-4 not-typeset">
                    <Label className="text-sm font-medium" htmlFor="plan-course-search">Search for a course</Label>
                    <InputGroup ref={searchRef} className="mt-2">
                        <InputGroupAddon>
                            <MagnifyingGlassIcon />
                        </InputGroupAddon>
                        <InputGroupInput
                            id="plan-course-search"
                            value={query}
                            placeholder="Search by course code or title"
                            onChange={(event) => {
                                setQuery(event.target.value);
                                setResultsOpen(true);
                            }}
                            onClick={() => setResultsOpen(true)}
                            onFocus={() => setResultsOpen(true)}
                        />
                    </InputGroup>

                    <Popover
                        open={resultsOpen && matches.length > 0}
                        onOpenChange={setResultsOpen}
                    >
                        <PopoverContent
                            anchor={searchRef}
                            align="start"
                            initialFocus={false}
                            finalFocus={false}
                            className="w-(--anchor-width) max-w-(--available-width) gap-0 overflow-hidden p-0 not-typeset"
                        >
                            <ul className="m-0 list-none p-0">
                                {matches.map((course) => (
                                    <li key={course.id} className="border-b border-border last:border-b-0">
                                        <button
                                            type="button"
                                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                                            disabled={pending}
                                            onMouseDown={(event) => event.preventDefault()}
                                            onClick={() => run(
                                                () => addPlannedCourse(termId, course.id),
                                                `${course.subject} ${course.number} added`,
                                            )}
                                        >
                                            <Badge className="font-mono">{course.subject} {course.number}</Badge>
                                            <span className="min-w-0 truncate">{course.title}</span>
                                            <span className="ml-auto shrink-0 text-muted-foreground tabular-nums">{course.credits} credits</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </PopoverContent>
                    </Popover>
                </div>
            )}

            {plan && plan.courses.length > 0 ? (
                <div className="mt-4 min-h-[300px] space-y-4 rounded-lg border border-dashed border-border px-4 pt-3 pb-3">
                    {plan.courses.map((course) => (
                        <div key={course.plannedCourseId} className="flex items-center justify-between gap-3 not-typeset">
                            <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
                                <Badge className="font-mono">{course.subject} {course.number}</Badge>
                                <span className="min-w-0 truncate">{course.title}</span>
                            </p>
                            <span className="flex shrink-0 items-center gap-2">
                                <span className="text-sm text-muted-foreground tabular-nums">{course.credits} credits</span>
                                {editable && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        aria-label={`Remove ${course.subject} ${course.number}`}
                                        disabled={pending}
                                        onClick={() => run(
                                            () => removePlannedCourse(course.plannedCourseId),
                                            `${course.subject} ${course.number} removed`,
                                        )}
                                    >
                                        <XIcon />
                                    </Button>
                                )}
                            </span>
                        </div>
                    ))}
                </div>
            ) : (
                <Empty className="mt-4 min-h-[300px] border">
                    <EmptyHeader>
                        <EmptyTitle>No courses on this term yet</EmptyTitle>
                        <EmptyDescription>Search for a course to add it to this plan.</EmptyDescription>
                    </EmptyHeader>
                </Empty>
            )}



            <div className="mt-4 flex justify-end">
                {editable && (
                    <Button
                        type="button"
                        disabled={pending || !plan || plan.courses.length === 0}
                        onClick={() => plan && run(() => submitPlannedTerm(plan.id), "Term plan submitted")}
                    >
                        Submit for review
                    </Button>
                )}
                {status === "APPROVED" && plan && !plan.registered && (
                    <Button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => markPlannedTermRegistered(plan.id), "Courses marked in progress")}
                    >
                        I&apos;ve registered
                    </Button>
                )}
            </div>
        </section>
    );
}
