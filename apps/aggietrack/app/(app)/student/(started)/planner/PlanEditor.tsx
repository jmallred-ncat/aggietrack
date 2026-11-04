"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { toast } from "@/components/ui/toast";
import { RuleViolationAlert } from "@/components/rule-violation-alert";
import type { PlannedTermStatus } from "@/lib/generated/prisma/client";
import { finishPlanSave, type PlanSaveResult } from "@/lib/plan-save";
import { applyAddedCourses, applyRemovedCourse, termCreditLabel, termCreditTotal } from "@/lib/plan-view";
import { MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast as sonner } from "sonner";
import { addPlannedCourse, markPlannedTermRegistered, removePlannedCourse, submitPlannedTerm } from "./actions";

type CatalogCourse = {
    id: string;
    subject: string;
    number: string;
    title: string;
    credits: number;
    requirements: string[];
};

function RequirementNames({ requirements }: { requirements: string[] }) {
    if (requirements.length === 0) {
        return null;
    }

    return (
        <span className="block truncate text-xs font-normal text-muted-foreground">
            {requirements.join(", ")}
        </span>
    );
}

type PlannedRow = CatalogCourse & { plannedCourseId: string };

type EditorPlan = {
    id: string;
    status: PlannedTermStatus;
    registrationPin: string | null;
    registered: boolean;
    courses: PlannedRow[];
};

function withCourses(current: EditorPlan | null, next: { id: string | null; courses: PlannedRow[] }): EditorPlan {
    return {
        id: next.id ?? current?.id ?? "",
        status: current?.status ?? "DRAFT",
        registrationPin: current?.registrationPin ?? null,
        registered: current?.registered ?? false,
        courses: next.courses,
    };
}

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
    plan: EditorPlan | null;
    courses: CatalogCourse[];
}) {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [resultsOpen, setResultsOpen] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const [pending, startTransition] = useTransition();
    const [violations, setViolations] = useState<string[]>([]);
    const [violationTitle, setViolationTitle] = useState("Requirement not met");
    // The open term is drawn from this state so a finished save shows before a reload.
    // A refreshed plan from the server replaces that local copy.
    const [localPlan, setLocalPlan] = useState(plan);
    const [serverPlan, setServerPlan] = useState(plan);
    if (serverPlan !== plan) {
        setServerPlan(plan);
        setLocalPlan(plan);
    }
    const shown = localPlan;
    const status = shown?.status ?? "DRAFT";
    const editable = status === "DRAFT";
    const plannedIds = new Set(shown?.courses.map((course) => course.id) ?? []);
    const creditLabel = termCreditLabel(termCreditTotal(shown?.courses ?? []));
    const needle = query.trim().toLowerCase();
    const matches = needle.length < 2
        ? []
        : courses
            .filter((course) => !plannedIds.has(course.id))
            .filter((course) => `${course.subject} ${course.number} ${course.title}`.toLowerCase().includes(needle))
            .slice(0, 8);

    function run<T extends { success: boolean; error?: string; violations?: string[] }>(
        action: () => Promise<T>,
        success: string,
        apply?: (result: T & { success: true }) => void,
        violationTitleText = "Requirement not met",
    ) {
        startTransition(async () => {
            const result = await action();
            if (!result.success) {
                if (result.violations && result.violations.length > 0) {
                    setViolationTitle(violationTitleText);
                    setViolations(result.violations);
                    return;
                }
                setViolations([]);
                toast.add({ title: result.error ?? "That change could not be saved." });
                return;
            }
            apply?.(result as T & { success: true });
            if (result.violations && result.violations.length > 0) {
                setViolationTitle(violationTitleText);
                setViolations(result.violations);
            } else {
                setViolations([]);
                toast.add({ title: success });
            }
            setQuery("");
            setResultsOpen(false);
            router.refresh();
        });
    }

    function runCourseChange<T extends PlanSaveResult>(
        action: () => Promise<T>,
        success: string,
        apply?: (result: T & { success: true }) => void,
    ) {
        startTransition(async () => {
            const outcome = await finishPlanSave(action, { onLate: () => router.refresh() });
            if (outcome.status === "violations") {
                setViolationTitle("Requirement not met");
                setViolations(outcome.violations);
                return;
            }
            if (outcome.status === "failed") {
                setViolations([]);
                if (outcome.sonner) sonner.error(outcome.message);
                else toast.add({ title: outcome.message });
                router.refresh();
                return;
            }
            apply?.(outcome.result as T & { success: true });
            if (outcome.result.violations && outcome.result.violations.length > 0) {
                setViolationTitle("Requirement not met");
                setViolations(outcome.result.violations);
            } else {
                setViolations([]);
                toast.add({ title: success });
            }
            setQuery("");
            setResultsOpen(false);
            router.refresh();
        });
    }

    function requirementsFor(courseId: string, selected: CatalogCourse) {
        if (selected.id === courseId) {
            return selected.requirements;
        }
        return courses.find((course) => course.id === courseId)?.requirements ?? [];
    }

    return (
        <section>
            <header className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h2 className="text-2xl font-bold not-typeset text-balance">{termLabel}</h2>
                    <p className="text-sm text-muted-foreground tabular-nums not-typeset">{creditLabel}</p>
                </div>
                <Badge className="not-typeset" variant={status === "APPROVED" ? "default" : "secondary"}>
                    {status === "DRAFT" ? "Draft" : status === "SUBMITTED" ? "Submitted" : "Approved"}
                </Badge>
            </header>

            <p className="mt-2 max-w-prose text-sm text-balance text-muted-foreground">
                {shown?.registered
                    ? "These courses are on your transcript as in progress. You confirmed that you registered."
                    : status === "APPROVED"
                        ? "Your advisor approved this plan, so these courses are in progress. Register with the pin, then confirm that you registered."
                        : status === "SUBMITTED"
                            ? advisorName
                                ? `Waiting for ${advisorName} to review this plan and add a registration pin.`
                                : "Waiting for an advisor to review this plan. No advisor is assigned yet."
                            : advisorName
                                ? `Add the courses you want to take, then submit the plan for ${advisorName} to review.`
                                : "Add the courses you want to take, then submit the plan. No advisor is assigned yet."}
            </p>

            <RuleViolationAlert
                title={violationTitle}
                violations={violations}
                onDismiss={() => setViolations([])}
            />

            {status === "APPROVED" && shown?.registrationPin && (
                <p className="mt-4 inline-flex items-center gap-3 rounded-lg bg-muted px-4 py-3 not-typeset">
                    <span className="text-sm text-muted-foreground">Registration pin</span>
                    <span className="font-mono text-lg font-semibold tracking-wide">{shown.registrationPin}</span>
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
                                            onClick={() => runCourseChange(
                                                () => addPlannedCourse(termId, course.id),
                                                `${course.subject} ${course.number} added`,
                                                (result) => {
                                                    setLocalPlan((current) => withCourses(current, applyAddedCourses(current, {
                                                        planId: result.planId,
                                                        courses: result.courses.map((row) => ({
                                                            plannedCourseId: row.plannedCourseId,
                                                            id: row.id,
                                                            subject: row.subject,
                                                            number: row.number,
                                                            title: row.title,
                                                            credits: row.credits,
                                                            requirements: requirementsFor(row.id, course),
                                                        })),
                                                    })));
                                                },
                                            )}
                                        >
                                            <Badge className="font-mono">{course.subject} {course.number}</Badge>
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate">{course.title}</span>
                                                <RequirementNames requirements={course.requirements} />
                                            </span>
                                            <span className="ml-auto shrink-0 text-muted-foreground tabular-nums">{course.credits} credits</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </PopoverContent>
                    </Popover>
                </div>
            )}

            {shown && shown.courses.length > 0 ? (
                <div className="mt-4 min-h-[300px] space-y-4 rounded-lg border border-dashed border-border px-4 pt-3 pb-3">
                    {shown.courses.map((course) => (
                        <div key={course.plannedCourseId} className="flex items-center justify-between gap-3 not-typeset">
                            <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
                                <Badge className="font-mono">{course.subject} {course.number}</Badge>
                                <span className="min-w-0">
                                    <span className="block truncate">{course.title}</span>
                                    <RequirementNames requirements={course.requirements} />
                                </span>
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
                                        onClick={() => runCourseChange(
                                            () => removePlannedCourse(course.plannedCourseId),
                                            `${course.subject} ${course.number} removed`,
                                            () => {
                                                setLocalPlan((current) => current
                                                    ? withCourses(current, applyRemovedCourse(current, course.plannedCourseId))
                                                    : current);
                                            },
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
                        disabled={pending || !shown || shown.courses.length === 0}
                        onClick={() => shown && run(
                            () => submitPlannedTerm(shown.id),
                            "Term plan submitted",
                            () => setLocalPlan((current) => current ? { ...current, status: "SUBMITTED" } : current),
                            "This plan cannot be submitted",
                        )}
                    >
                        Submit for review
                    </Button>
                )}
                {status === "APPROVED" && shown && !shown.registered && (
                    <Button
                        type="button"
                        disabled={pending}
                        onClick={() => run(
                            () => markPlannedTermRegistered(shown.id),
                            "Registration recorded",
                            () => setLocalPlan((current) => current ? { ...current, registered: true } : current),
                        )}
                    >
                        I&apos;ve registered
                    </Button>
                )}
            </div>
        </section>
    );
}
