"use client";

import { PlanNotes } from "@/components/plan-notes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { RuleViolationAlert } from "@/components/rule-violation-alert";
import { courseMatchesSearch } from "@/lib/course-search";
import type { PlannedTermStatus } from "@/lib/generated/prisma/client";
import type { HandbookReference } from "@/lib/handbook-guidance";
import { announcePlanViolations, finishPlanSave, type PlanSaveResult } from "@/lib/plan-save";
import type { PresentedNote } from "@/lib/plan-notes";
import { courseOverrideNote } from "@/lib/plan-rules";
import { planCoursesLocked, plannedTermStatusLabel, plannedTermStatusVariant } from "@/lib/plan-status";
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
    requiresCourseOverride?: boolean;
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

function CourseOverrideNote({ show }: { show: boolean }) {
    if (!show) return null;
    return (
        <span className="block truncate text-xs font-normal text-muted-foreground">
            {courseOverrideNote}
        </span>
    );
}

function HandbookReferenceNote({ reference }: { reference: HandbookReference }) {
    return (
        <div className="mt-4 rounded-lg border border-dashed border-border px-4 py-3 not-typeset" data-handbook-reference>
            <p className="flex min-w-0 items-start gap-2 text-sm text-muted-foreground">
                <Badge variant="outline" className="mt-0.5 shrink-0 font-mono text-muted-foreground">
                    {reference.code}
                </Badge>
                <span className="min-w-0 text-balance">
                    <span className="block">{reference.classYear} calls for {reference.title}.</span>
                    {reference.aside ? <span className="mt-1 block">{reference.aside}</span> : null}
                </span>
            </p>
        </div>
    );
}

type PlannedRow = CatalogCourse & { plannedCourseId: string };

type EditorPlan = {
    id: string;
    status: PlannedTermStatus;
    revision: number;
    registrationPin: string | null;
    registered: boolean;
    returnComment: string | null;
    courses: PlannedRow[];
};

function withCourses(current: EditorPlan | null, next: { id: string | null; courses: PlannedRow[] }): EditorPlan {
    return {
        id: next.id ?? current?.id ?? "",
        status: current?.status ?? "DRAFT",
        revision: current?.revision ?? 0,
        registrationPin: current?.registrationPin ?? null,
        registered: current?.registered ?? false,
        returnComment: current?.returnComment ?? null,
        courses: next.courses,
    };
}

export default function PlanEditor({
    termId,
    termLabel,
    advisorName,
    plan,
    courses,
    reference,
    notes,
    earlierCursor,
}: {
    termId: string;
    termLabel: string;
    advisorName: string | null;
    plan: EditorPlan | null;
    courses: CatalogCourse[];
    reference: HandbookReference | null;
    notes: PresentedNote[];
    earlierCursor: string | null;
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
    const editable = !planCoursesLocked(status);
    const plannedIds = new Set(shown?.courses.map((course) => course.id) ?? []);
    const creditLabel = termCreditLabel(termCreditTotal(shown?.courses ?? []));
    const needle = query.trim().toLowerCase();
    const matches = needle.length < 2
        ? []
        : courses
            .filter((course) => !plannedIds.has(course.id))
            .filter((course) => courseMatchesSearch(course, needle))
            .slice(0, 8);

    function run<T extends { success: boolean; error?: string; violations?: string[] }>(
        action: () => Promise<T>,
        success: string,
        apply?: (result: T & { success: true }) => void,
        violationTitleText = "Requirement not met",
    ) {
        startTransition(async () => {
            let result: T;
            try {
                result = await action();
            } catch {
                setViolations([]);
                sonner.error("The change could not be confirmed. Refresh before trying again.");
                return;
            }
            if (!result.success) {
                if (result.violations && result.violations.length > 0) {
                    setViolationTitle(violationTitleText);
                    setViolations(result.violations);
                    return;
                }
                setViolations([]);
                sonner.error(result.error ?? (
                    success === "Plan submitted for review"
                        ? "Plan could not be submitted. Try again."
                        : success === "Registration recorded"
                            ? "Registration could not be recorded. Try again."
                            : "That change could not be saved."
                ));
                return;
            }
            apply?.(result as T & { success: true });
            if (result.violations && result.violations.length > 0) {
                setViolationTitle(violationTitleText);
                setViolations(result.violations);
            } else {
                setViolations([]);
                sonner.success(success);
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
                const notices = announcePlanViolations(outcome.violations);
                for (const message of notices.sonner) sonner.error(message);
                if (notices.alert.length > 0) {
                    setViolationTitle("Requirement not met");
                    setViolations(notices.alert);
                } else {
                    setViolations([]);
                }
                return;
            }
            if (outcome.status === "failed") {
                setViolations([]);
                sonner.error(outcome.message || (
                    success.endsWith("removed")
                        ? "Course could not be removed. Try again."
                        : "Course could not be added. Try again."
                ));
                router.refresh();
                return;
            }
            apply?.(outcome.result as T & { success: true });
            if (outcome.result.violations && outcome.result.violations.length > 0) {
                setViolationTitle("Requirement not met");
                setViolations(outcome.result.violations);
            } else {
                setViolations([]);
                sonner.success(success);
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
                    <h2 className="text-2xl font-bold not-typeset text-balance">{termLabel} plan</h2>
                    <p className="text-sm text-muted-foreground tabular-nums not-typeset">{creditLabel}</p>
                </div>
                <Badge className="not-typeset" variant={plannedTermStatusVariant(status)}>
                    {plannedTermStatusLabel(status)}
                </Badge>
            </header>

            <p className="mt-2 max-w-prose text-sm text-balance text-muted-foreground">
                {status === "APPROVED"
                    ? "Your advisor approved this plan. These courses are in progress."
                    : status === "SUBMITTED"
                        ? advisorName
                            ? `Waiting for ${advisorName} to review this plan and add a registration pin.`
                            : "Waiting for an advisor to review this plan. No advisor is assigned yet."
                        : status === "RETURNED"
                            ? "Your advisor requested changes. Read the comment, update your courses, then submit the plan again."
                            : status !== "DRAFT"
                                ? "Status unavailable."
                                : advisorName
                                    ? `Add the courses you want to take, then submit the plan for ${advisorName} to review.`
                                    : "Add the courses you want to take, then submit the plan. No advisor is assigned yet."}
            </p>

            <RuleViolationAlert
                title={violationTitle}
                violations={violations}
                onDismiss={() => setViolations([])}
            />

            {editable && reference ? <HandbookReferenceNote reference={reference} /> : null}

            {status === "RETURNED" && shown?.returnComment ? (
                <div className="mt-4 rounded-lg border bg-muted p-4">
                    <p className="text-sm font-medium">Changes to make</p>
                    <p className="mt-2 text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">{shown.returnComment}</p>
                    <a className="mt-2 inline-block text-sm underline" href="#plan-notes">View in Plan notes</a>
                </div>
            ) : null}

            {status === "APPROVED" && shown && !shown.registrationPin ? (
                <p className="mt-4 rounded-lg border p-4 text-sm">Registration pin unavailable</p>
            ) : null}

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
                                                () => addPlannedCourse(termId, course.id, [], shown?.revision),
                                                `${course.subject} ${course.number} added`,
                                                (result) => {
                                                    if (result.revision == null || !result.planId || !result.courses) return;
                                                    const added = result.courses;
                                                    const revision = result.revision;
                                                    const planId = result.planId;
                                                    setLocalPlan((current) => ({
                                                    ...withCourses(current, applyAddedCourses(current, {
                                                        planId,
                                                        courses: added.map((row) => ({
                                                            plannedCourseId: row.plannedCourseId,
                                                            id: row.id,
                                                            subject: row.subject,
                                                            number: row.number,
                                                            title: row.title,
                                                            credits: row.credits,
                                                            requirements: requirementsFor(row.id, course),
                                                            requiresCourseOverride: row.requiresCourseOverride,
                                                        })),
                                                    })),
                                                    revision,
                                                }));
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
                        <div key={course.plannedCourseId} className="flex items-start justify-between gap-3 not-typeset">
                            <p className="flex min-w-0 items-start gap-2 text-sm font-medium">
                                <Badge className="font-mono">{course.subject} {course.number}</Badge>
                                <span className="min-w-0">
                                    <span className="block text-pretty">{course.title}</span>
                                    <RequirementNames requirements={course.requirements} />
                                    <CourseOverrideNote show={course.requiresCourseOverride === true} />
                                </span>
                            </p>
                            <span className="flex shrink-0 items-center gap-2">
                                {status === "APPROVED" ? <Badge variant="secondary">In progress</Badge> : null}
                                <span className="text-sm text-muted-foreground tabular-nums">{course.credits} credits</span>
                                {editable && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        aria-label={`Remove ${course.subject} ${course.number}`}
                                        disabled={pending}
                                        onClick={() => runCourseChange(
                                            () => removePlannedCourse(course.plannedCourseId, shown?.revision),
                                            `${course.subject} ${course.number} removed`,
                                            (result) => {
                                                if (result.revision == null) return;
                                                const revision = result.revision;
                                                setLocalPlan((current) => current
                                                    ? {
                                                        ...withCourses(current, applyRemovedCourse(current, course.plannedCourseId)),
                                                        revision,
                                                    }
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
                            () => submitPlannedTerm(shown.id, shown.revision),
                            "Plan submitted for review",
                            (result) => setLocalPlan((current) => current ? {
                                ...current,
                                status: "SUBMITTED",
                                returnComment: null,
                                revision: result.revision,
                            } : current),
                            "This plan cannot be submitted",
                        )}
                    >
                        {status === "RETURNED" ? "Submit again for review" : "Submit for review"}
                    </Button>
                )}
                {status === "APPROVED" && shown?.registrationPin && !shown.registered && (
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
            {shown?.id ? (
                <div className="mt-6">
                    <PlanNotes
                        plannedTermId={shown.id}
                        audience="student"
                        advisorAssigned={advisorName !== null}
                        notes={notes}
                        earlierCursor={earlierCursor}
                    />
                </div>
            ) : (
                <p className="mt-6 text-sm text-muted-foreground">Add a course to create this term plan before posting a note.</p>
            )}
        </section>
    );
}
