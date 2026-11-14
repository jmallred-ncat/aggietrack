"use client";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ToggleInput, ToggleInputGroup } from "@/components/ui/toggle-input";
import type { ProgressSlotCourse } from "@/lib/catalog";
import { completionRowMode, labelsNewlyMarkedComplete, markedCompleteToast, saveCompletionRow } from "@/lib/completion-menu";
import { courseCodeLabel, parseCourseCode } from "@/lib/course-code";
import type { TranscriptSource, TranscriptStatus } from "@/lib/generated/prisma/browser";
import { Combobox } from "@base-ui/react/combobox";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowsLeftRightIcon, CaretDownIcon, CheckCircleIcon, XIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { confirmNoPriorCoursework, saveTranscriptProgress } from "./actions";
import { CourseAttempts, getInProgressBadgeText } from "./CourseAttempts";

const courseStatuses = [
    { value: "complete", label: "Complete", icon: CheckCircleIcon },
    { value: "transfer", label: "Transfer", icon: ArrowsLeftRightIcon },
] as const;

const statusSchema = z.enum(["complete", "transfer", ""]);

const studentStandings = [
    { value: "FRESHMAN", label: "Freshman" },
    { value: "SOPHOMORE", label: "Sophomore" },
    { value: "JUNIOR", label: "Junior" },
    { value: "SENIOR", label: "Senior" },
] as const;

const standingSchema = z.enum(["FRESHMAN", "SOPHOMORE", "JUNIOR", "SENIOR", ""]);

const slotSchema = z.object({
    courseId: z.string(),
    subject: z.string(),
    number: z.string(),
    title: z.string(),
    credits: z.string(),
    status: statusSchema,
});

function createFormSchema(inProgressSlotIds: string[]) {
    const inProgressSlots = new Set(inProgressSlotIds);
    return z.object({
        standing: standingSchema,
        courses: z.record(z.string(), statusSchema),
        slots: z.record(z.string(), slotSchema),
    }).superRefine((data, ctx) => {
        for (const [id, slot] of Object.entries(data.slots)) {
            const entered = !slot.courseId && Boolean(slot.subject || slot.number);
            // Skip validation for slots with existing IN_PROGRESS entries
            const isInProgress = inProgressSlots.has(id);
            if ((slot.courseId || entered) && !slot.status && !isInProgress) {
                ctx.addIssue({
                    code: "custom",
                    path: ["slots", id, "status"],
                    message: "Choose complete or transfer for this course.",
                });
            }
            if (!entered) {
                continue;
            }
            if (!slot.title.trim()) {
                ctx.addIssue({
                    code: "custom",
                    path: ["slots", id, "title"],
                    message: "Enter the course title.",
                });
            }
            const credits = Number(slot.credits);
            if (!Number.isInteger(credits) || credits < 1 || credits > 6) {
                ctx.addIssue({
                    code: "custom",
                    path: ["slots", id, "credits"],
                    message: "Enter credit hours from 1 to 6.",
                });
            }
        }
    });
}

type ProgressFormValues = z.infer<ReturnType<typeof createFormSchema>>;
type SlotValue = z.infer<typeof slotSchema>;

export const emptySlotValue: SlotValue = {
    courseId: "",
    subject: "",
    number: "",
    title: "",
    credits: "",
    status: "",
};

export type ProgressTerm = {
    id: string;
    label: string;
    rows: Array<
        | { id: string; kind: "course"; courseId: string; subject: string; number: string; title: string; credits: number }
        | {
            id: string;
            kind: "slot";
            groupId: string;
            badge: string | null;
            title: string;
            allowUnlisted: boolean;
            requiresLab: boolean;
            minNumber: number;
        }
    >;
};

export type ProgressYear = {
    id: string;
    label: string;
    terms: ProgressTerm[];
};

function StatusIcon({ icon: Icon }: { icon: typeof CheckCircleIcon }) {
    if (Icon === ArrowsLeftRightIcon) {
        return <Icon weight="bold" />;
    }

    return (
        <span className="relative inline-flex size-4">
            <Icon weight="fill" className="absolute inset-0 size-4 opacity-20" aria-hidden />
            <Icon weight="bold" className="relative size-4" />
        </span>
    );
}

function CourseStatusField({
    value,
    onChange,
    onBlur,
    disabled,
    inProgress,
    courseCode,
    releaseInteraction = false,
}: {
    value?: SlotValue["status"];
    onChange?: (value: SlotValue["status"]) => void;
    onBlur?: () => void;
    disabled?: boolean;
    inProgress?: boolean;
    courseCode?: string;
    /** Drop leftover focus and hover after a completion is cleared. */
    releaseInteraction?: boolean;
}) {
    const rootRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (!releaseInteraction) {
            return;
        }
        const active = document.activeElement;
        if (active instanceof HTMLElement && rootRef.current?.contains(active)) {
            active.blur();
        }
    }, [releaseInteraction]);

    useEffect(() => {
        if (!releaseInteraction) {
            return;
        }
        const blurInside = () => {
            const active = document.activeElement;
            if (active instanceof HTMLElement && rootRef.current?.contains(active)) {
                active.blur();
            }
        };
        blurInside();
        const frame = requestAnimationFrame(blurInside);
        return () => cancelAnimationFrame(frame);
    }, [releaseInteraction]);

    return (
        <div ref={rootRef} className="flex min-w-0 flex-wrap items-center gap-2">
            {inProgress && !value ? (
                <Badge variant="secondary">In progress</Badge>
            ) : null}
            <ToggleInputGroup
                {...(value === undefined ? {} : { value })}
                onValueChange={(next) => {
                    if (next === "" || next === "complete" || next === "transfer") {
                        onChange?.(next);
                    }
                }}
                onBlur={onBlur}
                disabled={disabled}
                variant="default"
                attached
                aria-label={courseCode ? `Record ${courseCode}` : "Record this course"}
                className="w-full sm:w-fit"
            >
                {courseStatuses.map(({ value: status, label, icon }) => (
                    <ToggleInput
                        key={status}
                        value={status}
                        aria-label={label}
                        title={label}
                        className="h-11 flex-1 gap-1.5 px-3 sm:h-8 sm:flex-none"
                    >
                        <StatusIcon icon={icon} />
                        <span>{label}</span>
                    </ToggleInput>
                ))}
            </ToggleInputGroup>
        </div>
    );
}

function CoursePicker({
    courses,
    value,
    excludedIds,
    label,
    placeholder = "Choose a course",
    empty,
    onQueryChange,
    onChange,
}: {
    courses: ProgressSlotCourse[];
    value: string;
    excludedIds: ReadonlySet<string>;
    label: string;
    placeholder?: string;
    empty?: ReactNode;
    onQueryChange?: (query: string) => void;
    onChange: (courseId: string) => void;
}) {
    const available = courses.filter((course) => course.id === value || !excludedIds.has(course.id));
    const selected = available.find((course) => course.id === value) ?? null;

    return (
        <Combobox.Root
            items={available}
            value={selected}
            onValueChange={(course) => onChange(course?.id ?? "")}
            onInputValueChange={(inputValue) => onQueryChange?.(inputValue)}
            itemToStringLabel={(course) => `${course.subject} ${course.number} ${course.title}`}
            isItemEqualToValue={(left, right) => left.id === right.id}
            autoHighlight
        >
            <Combobox.InputGroup className="flex h-8 w-full min-w-0 items-center rounded-lg border border-input bg-transparent transition-colors outline-none has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 sm:w-72 dark:bg-input/30">
                <Combobox.Input
                    placeholder={placeholder}
                    aria-label={`Choose a course for ${label}`}
                    className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground"
                />
                {selected ? (
                    <Combobox.Clear
                        type="button"
                        aria-label={`Clear ${label}`}
                        className="mr-1 inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                        <XIcon className="size-3.5" />
                    </Combobox.Clear>
                ) : null}
                <Combobox.Icon className="mr-2 text-muted-foreground">
                    <CaretDownIcon className="size-4" />
                </Combobox.Icon>
            </Combobox.InputGroup>
            <Combobox.Portal>
                <Combobox.Positioner sideOffset={4} className="z-50">
                    <Combobox.Popup className="max-h-64 w-(--anchor-width) min-w-64 origin-(--transform-origin) overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10">
                        <Combobox.Empty className="px-2 py-2 text-sm text-muted-foreground">
                            {empty ?? "No courses match."}
                        </Combobox.Empty>
                        <Combobox.List>
                            {(course: ProgressSlotCourse) => (
                                <Combobox.Item
                                    key={course.id}
                                    value={course}
                                    className="flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                                >
                                    <span className="shrink-0 font-mono">{course.subject} {course.number}</span>
                                    <span className="min-w-0 truncate">{course.title}</span>
                                </Combobox.Item>
                            )}
                        </Combobox.List>
                    </Combobox.Popup>
                </Combobox.Positioner>
            </Combobox.Portal>
        </Combobox.Root>
    );
}

function catalogSelection(courseId: string, status: SlotValue["status"]): SlotValue {
    return {
        ...emptySlotValue,
        courseId,
        status: courseId ? status : "",
    };
}

function unlistedCourseId(subject: string, number: string) {
    return `unlisted:${subject}:${number}`;
}

function unlistedCourse(value: SlotValue): ProgressSlotCourse | null {
    if (value.courseId || !value.subject || !value.number || !value.title.trim()) {
        return null;
    }

    const credits = Number(value.credits);
    return {
        id: unlistedCourseId(value.subject, value.number),
        subject: value.subject,
        number: value.number,
        title: value.title.trim(),
        credits: Number.isInteger(credits) ? credits : 0,
        lab: false,
    };
}

const addedCourseSchema = z.object({
    title: z.string().trim().min(1, "Enter the course title."),
    credits: z.string().refine((value) => {
        const credits = Number(value);
        return Number.isInteger(credits) && credits >= 1 && credits <= 6;
    }, "Enter credit hours from 1 to 6."),
});

function AddFreeElectiveDialog({
    course,
    open,
    onOpenChange,
    onOpenChangeComplete,
    onSave,
}: {
    course: { subject: string; number: string } | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onOpenChangeComplete?: (open: boolean) => void;
    onSave: (course: { title: string; credits: string }) => void;
}) {
    const titleId = useId();
    const creditsId = useId();
    const code = course ? courseCodeLabel(course.subject, course.number) : "course";
    const form = useForm<z.infer<typeof addedCourseSchema>>({
        resolver: zodResolver(addedCourseSchema),
        defaultValues: { title: "", credits: "" },
    });

    function finishClose(next: boolean) {
        if (!next) {
            form.reset();
        }
        onOpenChangeComplete?.(next);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange} onOpenChangeComplete={finishClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add {code}</DialogTitle>
                    <DialogDescription>
                        Enter the title and credit hours. The course will appear in this free elective list.
                    </DialogDescription>
                </DialogHeader>
                <form
                    onSubmit={(event) => {
                        event.stopPropagation();
                        void form.handleSubmit((data) => {
                            onSave({ title: data.title.trim(), credits: data.credits });
                            onOpenChange(false);
                        })(event);
                    }}
                    className="flex flex-col gap-4"
                >
                    <FieldGroup>
                        <Controller
                            name="title"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor={titleId}>Course title</FieldLabel>
                                    <Input
                                        {...field}
                                        id={titleId}
                                        placeholder="Course title"
                                        aria-invalid={fieldState.invalid}
                                    />
                                    {fieldState.invalid && <FieldError errors={[{ message: fieldState.error?.message }]} />}
                                </Field>
                            )}
                        />
                        <Controller
                            name="credits"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor={creditsId}>Credit hours</FieldLabel>
                                    <Input
                                        {...field}
                                        id={creditsId}
                                        inputMode="numeric"
                                        placeholder="3"
                                        aria-invalid={fieldState.invalid}
                                        onChange={(event) => field.onChange(event.target.value.replace(/\D/g, "").slice(0, 1))}
                                    />
                                    {fieldState.invalid && <FieldError errors={[{ message: fieldState.error?.message }]} />}
                                </Field>
                            )}
                        />
                    </FieldGroup>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit">Add course</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function FreeElectivePicker({
    courses,
    value,
    excludedIds,
    excludedCodes,
    reservedCodes,
    minNumber,
    label,
    onChange,
}: {
    courses: ProgressSlotCourse[];
    value: SlotValue;
    excludedIds: ReadonlySet<string>;
    excludedCodes: ReadonlySet<string>;
    reservedCodes: ReadonlySet<string>;
    minNumber: number;
    label: string;
    onChange: (value: SlotValue) => void;
}) {
    const [query, setQuery] = useState("");
    const [draft, setDraft] = useState<{ subject: string; number: string } | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const openingDialog = useRef(false);
    const added = unlistedCourse(value);
    const parsed = parseCourseCode(query);
    const code = parsed ? courseCodeLabel(parsed.subject, parsed.number) : null;
    const catalogMatch = parsed
        ? courses.find((course) => courseCodeLabel(course.subject, course.number) === code)
        : undefined;

    function openDraft(course: { subject: string; number: string }) {
        openingDialog.current = true;
        setDraft(course);
        setDialogOpen(true);
        setQuery("");
    }

    const courseNumber = parsed ? Number.parseInt(parsed.number, 10) : null;
    const canAdd = parsed != null
        && code != null
        && courseNumber != null
        && courseNumber >= minNumber
        && !catalogMatch
        && !reservedCodes.has(code)
        && !excludedCodes.has(code);
    const enteredOption: ProgressSlotCourse | null = canAdd && parsed
        ? {
            id: `entered:${parsed.subject}:${parsed.number}`,
            subject: parsed.subject,
            number: parsed.number,
            title: "Add this course",
            credits: 0,
            lab: false,
        }
        : null;
    const options = [
        ...(added ? [added] : []),
        ...(enteredOption ? [enteredOption] : []),
        ...courses,
    ];

    let empty: ReactNode = "No courses match. Enter a code like PSYC 320.";
    if (parsed && code) {
        const courseNumber = Number.parseInt(parsed.number, 10);
        if (courseNumber < minNumber) {
            empty = `Free electives must be numbered ${minNumber} or above.`;
        } else if (catalogMatch && excludedIds.has(catalogMatch.id)) {
            empty = `${code} is already selected.`;
        } else if (catalogMatch) {
            empty = (
                <button
                    type="button"
                    className="w-full rounded-md px-1 py-1 text-left text-foreground hover:bg-accent hover:text-accent-foreground"
                    onMouseDown={(event) => {
                        event.preventDefault();
                        onChange(catalogSelection(catalogMatch.id, value.status));
                        setQuery("");
                    }}
                >
                    Use {catalogMatch.subject} {catalogMatch.number} {catalogMatch.title}
                </button>
            );
        } else if (reservedCodes.has(code)) {
            empty = `${code} is already on your plan.`;
        } else if (excludedCodes.has(code)) {
            empty = `${code} is already selected.`;
        } else {
            empty = (
                <button
                    type="button"
                    className="w-full rounded-md px-1 py-1 text-left text-foreground hover:bg-accent hover:text-accent-foreground"
                    onMouseDown={(event) => {
                        event.preventDefault();
                        openDraft(parsed);
                    }}
                >
                    Add {code}
                </button>
            );
        }
    }

    return (
        <>
            <CoursePicker
                courses={options}
                value={value.courseId || added?.id || ""}
                excludedIds={excludedIds}
                label={label}
                placeholder="Search or enter a course code"
                empty={empty}
                onQueryChange={setQuery}
                onChange={(courseId) => {
                    if (courseId.startsWith("entered:") && parsed) {
                        openDraft(parsed);
                        return;
                    }
                    if (openingDialog.current && !courseId) {
                        return;
                    }
                    if (courseId.startsWith("unlisted:")) {
                        return;
                    }
                    onChange(catalogSelection(courseId, value.status));
                }}
            />
            <AddFreeElectiveDialog
                course={draft}
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onOpenChangeComplete={(open) => {
                    if (!open) {
                        openingDialog.current = false;
                        setDraft(null);
                    }
                }}
                onSave={({ title, credits }) => {
                    if (!draft) {
                        return;
                    }
                    onChange({
                        ...emptySlotValue,
                        subject: draft.subject,
                        number: draft.number,
                        title,
                        credits,
                        status: value.status,
                    });
                }}
            />
        </>
    );
}

function SlotField({
    courses,
    label,
    value,
    excludedIds,
    excludedCodes,
    reservedCodes,
    allowUnlisted,
    minNumber,
    statusError,
    inProgress,
    releaseInteraction,
    onChange,
    onBlur,
}: {
    courses: ProgressSlotCourse[];
    label: string;
    value: SlotValue;
    excludedIds: ReadonlySet<string>;
    excludedCodes: ReadonlySet<string>;
    reservedCodes: ReadonlySet<string>;
    allowUnlisted: boolean;
    minNumber: number;
    statusError?: string;
    inProgress?: boolean;
    releaseInteraction?: boolean;
    onChange: (value: SlotValue) => void;
    onBlur: () => void;
}) {
    const hasCourse = Boolean(value.courseId || (value.subject && value.number));
    const selectedCourse = courses.find((course) => course.id === value.courseId);
    const courseCode = selectedCourse
        ? `${selectedCourse.subject} ${selectedCourse.number}`
        : value.subject && value.number
            ? `${value.subject} ${value.number}`
            : label;

    return (
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                {allowUnlisted ? (
                    <FreeElectivePicker
                        courses={courses}
                        value={value}
                        excludedIds={excludedIds}
                        excludedCodes={excludedCodes}
                        reservedCodes={reservedCodes}
                        minNumber={minNumber}
                        label={label}
                        onChange={onChange}
                    />
                ) : (
                    <CoursePicker
                        courses={courses}
                        value={value.courseId}
                        excludedIds={excludedIds}
                        label={label}
                        onChange={(courseId) => onChange(catalogSelection(courseId, value.status))}
                    />
                )}
                <CourseStatusField
                    value={value.status}
                    courseCode={courseCode}
                    disabled={!hasCourse}
                    inProgress={inProgress}
                    releaseInteraction={releaseInteraction}
                    onChange={(status) => onChange({ ...value, status })}
                    onBlur={onBlur}
                />
            </div>
            {statusError ? <FieldError errors={[{ message: statusError }]} /> : null}
        </div>
    );
}

function progressPayload(data: ProgressFormValues, confirmStart = false) {
    return {
        standing: data.standing === "" ? null : data.standing,
        courses: Object.entries(data.courses).map(([courseId, status]) => ({
            courseId,
            status: status === "" ? null : status,
        })),
        slots: Object.entries(data.slots).map(([recommendedTermCourseId, slot]) => ({
            recommendedTermCourseId,
            courseId: slot.courseId || null,
            subject: slot.courseId ? null : slot.subject || null,
            number: slot.courseId ? null : slot.number || null,
            title: slot.courseId ? null : slot.title.trim() || null,
            credits: slot.courseId || !slot.credits ? null : Number(slot.credits),
            status: slot.status === "" ? null : slot.status,
        })),
        confirmStart,
    };
}

function formRecordsCoursework(data: {
    courses?: Partial<Record<string, string | undefined>>;
    slots?: Partial<Record<string, Partial<SlotValue> | undefined>>;
}) {
    if (Object.values(data.courses ?? {}).some((status) => status)) {
        return true;
    }
    return Object.values(data.slots ?? {}).some((slot) => Boolean(
        slot?.status || slot?.courseId || slot?.subject || slot?.number || slot?.title,
    ));
}

type TranscriptAttempt = {
    id: string;
    grade: string | null;
    status: TranscriptStatus;
    source: TranscriptSource;
    createdAt: Date;
};

function attemptListKey(attempts: Array<{ id: string; grade: string | null; status: string }>) {
    return attempts.map((attempt) => `${attempt.id}:${attempt.grade ?? ""}:${attempt.status}`).join("|");
}

function reviveAttemptMap(attempts: Record<string, Array<Omit<TranscriptAttempt, "createdAt"> & { createdAt: Date | string }>>) {
    const revived: Record<string, TranscriptAttempt[]> = {};
    for (const [id, rows] of Object.entries(attempts)) {
        revived[id] = saveCompletionRow(rows).map((attempt) => ({
            ...attempt,
            createdAt: new Date(attempt.createdAt),
        }));
    }
    return revived;
}

function slotCourseLabel(
    slot: { courseId?: string; subject?: string; number?: string; title?: string } | undefined,
    courses: ProgressSlotCourse[] | undefined,
    fallback: string,
) {
    if (slot?.courseId) {
        const course = courses?.find((item) => item.id === slot.courseId);
        if (course) {
            return `${course.subject} ${course.number}`;
        }
    }
    if (slot?.subject && slot?.number) {
        return `${slot.subject} ${slot.number}`;
    }
    return slot?.title?.trim() || fallback;
}

function markedCompleteRows(
    planYears: ProgressYear[],
    slotCourses: Record<string, ProgressSlotCourse[]>,
    previous: {
        courses?: Partial<Record<string, string | undefined>>;
        slots?: Partial<Record<string, Partial<SlotValue> | undefined>>;
    } | undefined,
    next: ProgressFormValues,
) {
    const rows: Array<{ label: string; previous?: string | null; next?: string | null }> = [];
    for (const year of planYears) {
        for (const term of year.terms) {
            for (const row of term.rows) {
                if (row.kind === "course") {
                    rows.push({
                        label: `${row.subject} ${row.number}`,
                        previous: previous?.courses?.[row.courseId],
                        next: next.courses[row.courseId],
                    });
                    continue;
                }
                const nextSlot = next.slots[row.id];
                const previousSlot = previous?.slots?.[row.id];
                rows.push({
                    label: slotCourseLabel(nextSlot?.subject || nextSlot?.courseId ? nextSlot : previousSlot, slotCourses[row.groupId], row.title),
                    previous: previousSlot?.status,
                    next: nextSlot?.status,
                });
            }
        }
    }
    return rows;
}

export type OutsidePlanCourse = {
    courseId: string;
    subject: string;
    number: string;
    title: string;
    credits: number;
    attempts: TranscriptAttempt[];
};

export default function ProgressForm({
    years,
    defaultCourses,
    defaultSlots,
    courseAttempts,
    slotAttempts,
    slotCourses,
    reservedCourseCodes,
    outsidePlan,
    inProgressCourseIds,
    inProgressSlotIds,
    startConfirmed,
    standing,
}: {
    years: ProgressYear[];
    defaultCourses: ProgressFormValues["courses"];
    defaultSlots: ProgressFormValues["slots"];
    courseAttempts: Record<string, TranscriptAttempt[]>;
    slotAttempts: Record<string, TranscriptAttempt[]>;
    slotCourses: Record<string, ProgressSlotCourse[]>;
    reservedCourseCodes: string[];
    outsidePlan: OutsidePlanCourse[];
    inProgressCourseIds: string[];
    inProgressSlotIds: string[];
    startConfirmed: boolean;
    standing: ProgressFormValues["standing"];
}) {
    const inProgressCourses = new Set(inProgressCourseIds);
    const inProgressSlots = new Set(inProgressSlotIds);
    const router = useRouter();
    const [attemptOverrides, setAttemptOverrides] = useState<{
        courses: Record<string, TranscriptAttempt[]>;
        slots: Record<string, TranscriptAttempt[]>;
    }>({ courses: {}, slots: {} });
    const [releasedRows, setReleasedRows] = useState<Record<string, true>>({});
    const restoredDefaults = useRef<Array<{ kind: "course"; courseId: string } | { kind: "slot"; slotId: string; value: SlotValue }>>([]);
    const formSchema = createFormSchema(inProgressSlotIds);
    const form = useForm<ProgressFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: { standing, courses: defaultCourses, slots: defaultSlots },
    });

    function attemptsFor(
        kind: "courses" | "slots",
        id: string,
        server: TranscriptAttempt[],
    ) {
        const override = attemptOverrides[kind][id];
        return override ?? server;
    }

    function replaceAttempts(kind: "courses" | "slots", id: string, attempts: TranscriptAttempt[]) {
        setAttemptOverrides((current) => ({
            ...current,
            [kind]: { ...current[kind], [id]: saveCompletionRow(attempts) },
        }));
    }

    function forgetAttempts(kind: "courses" | "slots", id: string) {
        setAttemptOverrides((current) => {
            if (!(id in current[kind])) {
                return current;
            }
            const next = { ...current[kind] };
            delete next[id];
            return { ...current, [kind]: next };
        });
    }

    function rememberRelease(rowId: string) {
        setReleasedRows((current) => current[rowId] ? current : { ...current, [rowId]: true });
    }

    function forgetRelease(rowId: string) {
        setReleasedRows((current) => {
            if (!current[rowId]) {
                return current;
            }
            const next = { ...current };
            delete next[rowId];
            return next;
        });
    }

    useLayoutEffect(() => {
        const pending = restoredDefaults.current.splice(0);
        for (const field of pending) {
            if (field.kind === "course") {
                form.resetField(`courses.${field.courseId}`, { defaultValue: "" });
            } else {
                form.resetField(`slots.${field.slotId}`, { defaultValue: field.value });
            }
        }
    });
    const watched = useWatch({ control: form.control });
    const watchedSlots = useWatch({ control: form.control, name: "slots" });
    const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
        startConfirmed ? "saved" : "idle",
    );
    const [saveError, setSaveError] = useState<string | null>(null);
    const [errorDismissed, setErrorDismissed] = useState(false);
    const [startKnown, setStartKnown] = useState(startConfirmed);
    const { isDirty } = form.formState;
    const recordsCoursework = formRecordsCoursework(watched);
    const formIsValid = formSchema.safeParse(watched).success;

    async function persist(confirmStart: boolean) {
        const parsed = formSchema.safeParse(form.getValues());
        if (!parsed.success) {
            setSaveState("error");
            setSaveError("Finish the course you started before you confirm.");
            setErrorDismissed(false);
            return;
        }
        if (confirmStart && !formRecordsCoursework(parsed.data)) {
            setSaveState("error");
            setSaveError("Mark the courses you have completed, or say you have no prior coursework.");
            setErrorDismissed(false);
            return;
        }

        setSaveState("saving");
        let result: Awaited<ReturnType<typeof saveTranscriptProgress>>;
        try {
            result = await saveTranscriptProgress(progressPayload(parsed.data, confirmStart));
        } catch {
            setSaveState("error");
            setSaveError("Your changes are still on this page. Try saving again.");
            setErrorDismissed(false);
            return;
        }
        if (!result.success) {
            setSaveState("error");
            setSaveError("Your changes are still on this page. Try saving again.");
            setErrorDismissed(false);
            return;
        }

        const previousValues = form.formState.defaultValues;
        form.reset(parsed.data);
        setAttemptOverrides((current) => ({
            courses: {
                ...current.courses,
                ...reviveAttemptMap(result.courseAttempts),
            },
            slots: {
                ...current.slots,
                ...reviveAttemptMap(result.slotAttempts),
            },
        }));
        setSaveError(null);
        setSaveState("saved");
        const marked = markedCompleteToast(labelsNewlyMarkedComplete(markedCompleteRows(
            years,
            slotCourses,
            previousValues,
            parsed.data,
        )));
        if (marked) {
            toast.success(marked.title, { description: marked.description });
        } else {
            toast.success("Progress saved");
        }
        if (result.startConfirmed && !startKnown) {
            setStartKnown(true);
            router.push("/student");
            return;
        }
        router.refresh();
    }

    async function onNoPriorCoursework() {
        setSaveState("saving");
        let result: Awaited<ReturnType<typeof confirmNoPriorCoursework>>;
        try {
            result = await confirmNoPriorCoursework({
                standing: progressPayload(form.getValues()).standing,
            });
        } catch {
            setSaveState("error");
            setSaveError("Your changes are still on this page. Try saving again.");
            setErrorDismissed(false);
            return;
        }
        if (!result.success) {
            setSaveState("error");
            setSaveError("Your changes are still on this page. Try saving again.");
            setErrorDismissed(false);
            return;
        }

        setSaveError(null);
        setSaveState("saved");
        if (!startKnown) {
            setStartKnown(true);
            router.push("/student");
            return;
        }
        router.refresh();
    }

    const showNoPrior = !startKnown && !recordsCoursework && saveState !== "saving";
    const showConfirm = !startKnown && recordsCoursework && saveState !== "saving";
    const saveMessage = saveState === "saving"
        ? "Saving progress…"
        : saveState === "error"
            ? ""
            : !startKnown && recordsCoursework && !formIsValid
                ? "Finish the course you started before you confirm."
                : !startKnown && recordsCoursework
                    ? "Save these courses to continue."
                    : !startKnown
                        ? "Mark the courses you have completed, or say you have none."
                        : isDirty
                            ? "You have unsaved changes."
                            : "";

    return (
        <form
            className="flex flex-1 flex-col"
            onSubmit={(event) => event.preventDefault()}
        >
            <section id="progress-courses" className="mt-6 space-y-8 pb-24">
                <fieldset className="not-typeset space-y-2">
                    <legend className="text-sm font-medium">Student status</legend>
                    <p className="max-w-prose text-sm text-balance text-muted-foreground">
                        Some courses require a class status. CST 231, for example, requires sophomore status. Choose the status that applies to you. It saves with the rest of this page.
                    </p>
                    <Controller
                        control={form.control}
                        name="standing"
                        render={({ field }) => (
                            <ToggleInputGroup
                                value={field.value}
                                onValueChange={(next) => {
                                    if (
                                        next === ""
                                        || next === "FRESHMAN"
                                        || next === "SOPHOMORE"
                                        || next === "JUNIOR"
                                        || next === "SENIOR"
                                    ) {
                                        field.onChange(next);
                                    }
                                }}
                                onBlur={field.onBlur}
                                variant="outline"
                                className="flex flex-wrap"
                            >
                                {studentStandings.map((status) => (
                                    <ToggleInput
                                        key={status.value}
                                        value={status.value}
                                        className="aria-pressed:border-transparent aria-pressed:bg-primary! aria-pressed:text-primary-foreground! aria-pressed:hover:bg-primary/80! aria-pressed:hover:text-primary-foreground! data-[state=on]:border-transparent data-[state=on]:bg-primary! data-[state=on]:text-primary-foreground!"
                                    >
                                        {status.label}
                                    </ToggleInput>
                                ))}
                            </ToggleInputGroup>
                        )}
                    />
                </fieldset>
                {years.map((year) => (
                    <div key={year.id}>
                        <h2 className="px-4 text-lg font-semibold">{year.label}</h2>
                        <div className="mt-3 space-y-6">
                            {year.terms.map((term) => (
                                <div key={term.id}>
                                    <h3 className="rounded-lg bg-muted px-4 py-2 text-sm font-medium">{term.label}</h3>
                                    <div className="space-y-4 px-4 pt-3">
                                        {term.rows.map((row) => {
                                            const pendingRestore = { run: () => {} };
                                            const attemptKind = row.kind === "course" ? "courses" : "slots";
                                            const attemptId = row.kind === "course" ? row.courseId : row.id;
                                            const attempts = attemptsFor(
                                                attemptKind,
                                                attemptId,
                                                row.kind === "course" ? courseAttempts[row.courseId] ?? [] : slotAttempts[row.id] ?? [],
                                            );
                                            const listKey = attemptListKey(attempts);
                                            const showCompleted = completionRowMode({ attempts }) === "menu";
                                            const showAttempts = showCompleted || attempts.some((attempt) => 
                                                attempt.status === "IN_PROGRESS" || attempt.status === "FAILED" || attempt.status === "WITHDRAWN"
                                            );
                                            const slotSelection = row.kind === "slot" ? watchedSlots?.[row.id] : undefined;
                                            const slotCourse =
                                                row.kind === "slot" && slotSelection?.courseId
                                                    ? (slotCourses[row.groupId] ?? []).find(
                                                          (course) => course.id === slotSelection.courseId,
                                                      )
                                                    : null;
                                            const enteredCourse =
                                                row.kind === "slot" && !slotCourse && slotSelection?.subject && slotSelection?.number
                                                    ? slotSelection
                                                    : null;

                                            return (
                                                <div
                                                    key={row.id}
                                                    id={row.kind === "course" ? `progress-course-${row.courseId}` : `progress-slot-${row.id}`}
                                                    className="not-typeset scroll-mt-28"
                                                >
                                                    {/* Desktop: single row with centered items */}
                                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                                                        {/* Course info */}
                                                        <div className="flex min-w-0 items-start gap-2 text-sm font-medium sm:items-center">
                                                            {row.kind === "course" ? (
                                                                <>
                                                                    <Badge className="shrink-0 font-mono">{row.subject} {row.number}</Badge>
                                                                    <span className="min-w-0 whitespace-normal">{row.title}</span>
                                                                    {(() => {
                                                                        const badgeText = getInProgressBadgeText(attempts);
                                                                        return badgeText ? (
                                                                            <Badge variant="secondary" className="px-3 text-xs sm:hidden">
                                                                                {badgeText}
                                                                            </Badge>
                                                                        ) : null;
                                                                    })()}
                                                                </>
                                                            ) : (
                                                                <>
                                                                    {slotCourse ? (
                                                                        <Badge className="shrink-0 font-mono">{slotCourse.subject} {slotCourse.number}</Badge>
                                                                    ) : enteredCourse ? (
                                                                        <Badge className="shrink-0 font-mono">{enteredCourse.subject} {enteredCourse.number}</Badge>
                                                                    ) : row.badge ? (
                                                                        <Badge variant="outline" className="shrink-0 font-mono">{row.badge}</Badge>
                                                                    ) : null}
                                                                    <span className="min-w-0 whitespace-normal">{slotCourse?.title ?? enteredCourse?.title ?? row.title}</span>
                                                                    {(() => {
                                                                        const badgeText = getInProgressBadgeText(attempts);
                                                                        return badgeText ? (
                                                                            <Badge variant="secondary" className="px-3 text-xs sm:hidden">
                                                                                {badgeText}
                                                                            </Badge>
                                                                        ) : null;
                                                                    })()}
                                                                </>
                                                            )}
                                                        </div>

                                                        {/* Actions: grade select or attempts */}
                                                        <div className="flex shrink-0 items-center justify-start sm:justify-end">
                                                            {showAttempts ? (
                                                                row.kind === "course" ? (
                                                                    <CourseAttempts
                                                                        key={listKey}
                                                                        courseId={row.courseId}
                                                                        subject={row.subject}
                                                                        number={row.number}
                                                                        title={row.title}
                                                                        credits={row.credits}
                                                                        attempts={attempts}
                                                                        onUpdate={() => router.refresh()}
                                                                        onAttemptsChange={(next) => replaceAttempts("courses", row.courseId, next)}
                                                                        onLastAttemptCleared={() => {
                                                                            const previous = form.getValues(`courses.${row.courseId}`);
                                                                            pendingRestore.run = () => {
                                                                                form.setValue(`courses.${row.courseId}`, previous ?? "");
                                                                                forgetAttempts("courses", row.courseId);
                                                                            };
                                                                            form.setValue(`courses.${row.courseId}`, "");
                                                                            restoredDefaults.current.push({ kind: "course", courseId: row.courseId });
                                                                            replaceAttempts("courses", row.courseId, []);
                                                                            rememberRelease(row.id);
                                                                        }}
                                                                        onClearFailed={() => {
                                                                            pendingRestore.run();
                                                                            forgetRelease(row.id);
                                                                        }}
                                                                    />
                                                                ) : (() => {
                                                                    const slotValue = watchedSlots[row.id];
                                                                    const courseData = slotValue?.courseId 
                                                                        ? (() => {
                                                                            const course = (slotCourses[row.groupId] ?? []).find(c => c.id === slotValue.courseId);
                                                                            return course ? {
                                                                                courseId: course.id,
                                                                                subject: course.subject,
                                                                                number: course.number,
                                                                                title: course.title,
                                                                                credits: course.credits,
                                                                            } : null;
                                                                        })()
                                                                        : slotValue?.subject && slotValue?.number && slotValue?.title
                                                                            ? {
                                                                                courseId: "",
                                                                                subject: slotValue.subject,
                                                                                number: slotValue.number,
                                                                                title: slotValue.title,
                                                                                credits: Number(slotValue.credits),
                                                                            }
                                                                            : null;

                                                                    return courseData ? (
                                                                        <CourseAttempts
                                                                            key={listKey}
                                                                            courseId={courseData.courseId}
                                                                            subject={courseData.subject}
                                                                            number={courseData.number}
                                                                            title={courseData.title}
                                                                            credits={courseData.credits}
                                                                            attempts={attempts}
                                                                            recommendedTermCourseId={row.id}
                                                                            onUpdate={() => router.refresh()}
                                                                            onAttemptsChange={(next) => replaceAttempts("slots", row.id, next)}
                                                                            onLastAttemptCleared={() => {
                                                                                const previous = form.getValues(`slots.${row.id}`) ?? emptySlotValue;
                                                                                const cleared = { ...previous, status: "" as const };
                                                                                pendingRestore.run = () => {
                                                                                    form.setValue(`slots.${row.id}`, previous);
                                                                                    forgetAttempts("slots", row.id);
                                                                                };
                                                                                form.setValue(`slots.${row.id}`, cleared);
                                                                                restoredDefaults.current.push({ kind: "slot", slotId: row.id, value: cleared });
                                                                                replaceAttempts("slots", row.id, []);
                                                                                rememberRelease(row.id);
                                                                            }}
                                                                            onClearFailed={() => {
                                                                                pendingRestore.run();
                                                                                forgetRelease(row.id);
                                                                            }}
                                                                        />
                                                                    ) : null;
                                                                })()
                                                            ) : (
                                                                row.kind === "course" ? (
                                                                    <Controller
                                                                        control={form.control}
                                                                        name={`courses.${row.courseId}`}
                                                                        render={({ field }) => (
                                                                            <CourseStatusField
                                                                                value={field.value ?? ""}
                                                                                courseCode={`${row.subject} ${row.number}`}
                                                                                inProgress={inProgressCourses.has(row.courseId)}
                                                                                releaseInteraction={releasedRows[row.id] === true}
                                                                                onChange={field.onChange}
                                                                                onBlur={field.onBlur}
                                                                            />
                                                                        )}
                                                                    />
                                                                ) : (
                                                                    <Controller
                                                                        control={form.control}
                                                                        name={`slots.${row.id}`}
                                                                        render={({ field }) => (
                                                                            <SlotField
                                                                                courses={(slotCourses[row.groupId] ?? []).filter((course) => !row.requiresLab || course.lab)}
                                                                                label={row.title}
                                                                                value={field.value ?? emptySlotValue}
                                                                                excludedIds={claimedCourseIds(watchedSlots, row.id)}
                                                                                excludedCodes={claimedCourseCodes(watchedSlots, row.id, slotCourses)}
                                                                                reservedCodes={new Set(reservedCourseCodes)}
                                                                                allowUnlisted={row.allowUnlisted}
                                                                                minNumber={row.minNumber}
                                                                                statusError={form.formState.errors.slots?.[row.id]?.status?.message}
                                                                                inProgress={inProgressSlots.has(row.id)}
                                                                                releaseInteraction={releasedRows[row.id] === true}
                                                                                onChange={field.onChange}
                                                                                onBlur={field.onBlur}
                                                                            />
                                                                        )}
                                                                    />
                                                                )
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
                {outsidePlan.length > 0 ? (
                    <div>
                        <h2 className="px-4 text-lg font-semibold">Other courses</h2>
                        <p className="mt-1 max-w-prose px-4 text-sm text-balance text-muted-foreground">
                            These courses are on your transcript and do not fill a requirement on this degree. A letter grade still counts in your GPA.
                        </p>
                        <div className="mt-3 space-y-4 px-4">
                            {outsidePlan.map((course) => {
                                const attempts = course.courseId
                                    ? attemptsFor("courses", course.courseId, course.attempts)
                                    : course.attempts;
                                const listKey = attemptListKey(attempts);
                                if (attempts.length === 0) {
                                    return null;
                                }
                                return (
                                    <div key={`${course.subject} ${course.number}`} className="not-typeset flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                                        <div className="flex min-w-0 flex-wrap items-start gap-2 text-sm font-medium sm:items-center">
                                            <Badge className="shrink-0 font-mono">{course.subject} {course.number}</Badge>
                                            <span className="min-w-0 whitespace-normal sm:truncate">{course.title}</span>
                                            <span className="shrink-0 text-muted-foreground">{course.credits} credits</span>
                                            {(() => {
                                                const badgeText = getInProgressBadgeText(attempts);
                                                return badgeText ? (
                                                    <Badge variant="secondary" className="px-3 text-xs sm:hidden">
                                                        {badgeText}
                                                    </Badge>
                                                ) : null;
                                            })()}
                                        </div>
                                        {course.courseId ? (
                                            <CourseAttempts
                                                key={listKey}
                                                courseId={course.courseId}
                                                subject={course.subject}
                                                number={course.number}
                                                title={course.title}
                                                credits={course.credits}
                                                attempts={attempts}
                                                onUpdate={() => router.refresh()}
                                                onAttemptsChange={(next) => replaceAttempts("courses", course.courseId, next)}
                                                onLastAttemptCleared={() => replaceAttempts("courses", course.courseId, [])}
                                                onClearFailed={() => forgetAttempts("courses", course.courseId)}
                                            />
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : null}
            </section>
            <div className="sticky bottom-0 z-10 mt-auto flex min-w-0 flex-col gap-3 border-t bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                {saveState === "error" && !errorDismissed ? (
                    <Alert variant="destructive">
                        <AlertTitle>Progress not saved</AlertTitle>
                        <AlertDescription>{saveError ?? "Your changes are still on this page. Try saving again."}</AlertDescription>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="mt-2 w-full sm:w-auto"
                            onClick={() => void (showNoPrior ? onNoPriorCoursework() : persist(showConfirm || !startKnown))}
                        >
                            Try again
                        </Button>
                        <AlertAction>
                            <Button type="button" size="sm" variant="ghost" aria-label="Dismiss message" onClick={() => setErrorDismissed(true)}>
                                Dismiss message
                            </Button>
                        </AlertAction>
                    </Alert>
                ) : null}
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    {saveMessage ? (
                        <p className="min-w-0 text-sm text-balance text-muted-foreground not-typeset">
                            {saveMessage}
                        </p>
                    ) : <span className="min-w-0" />}
                    <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                        {showNoPrior ? (
                            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => void onNoPriorCoursework()}>
                                I have no prior coursework
                            </Button>
                        ) : null}
                        {saveState === "saving" ? (
                            <Button type="button" className="w-full sm:w-auto" disabled aria-busy="true">
                                Saving…
                            </Button>
                        ) : null}
                        {showConfirm ? (
                            <Button type="button" className="w-full sm:w-auto" onClick={() => void persist(true)} disabled={!formIsValid}>
                                Save and continue
                            </Button>
                        ) : null}
                        {startKnown && isDirty ? (
                            <Button type="button" className="w-full sm:w-auto" onClick={() => void persist(false)} disabled={saveState === "saving" || !formIsValid}>
                                Save progress
                            </Button>
                        ) : null}
                    </div>
                </div>
            </div>
        </form>
    );
}

function claimedCourseIds(
    slots: ProgressFormValues["slots"] | undefined,
    exceptSlotId: string,
) {
    const ids = new Set<string>();
    for (const [id, slot] of Object.entries(slots ?? {})) {
        if (id !== exceptSlotId && slot?.courseId) {
            ids.add(slot.courseId);
        }
    }
    return ids;
}

function claimedCourseCodes(
    slots: ProgressFormValues["slots"] | undefined,
    exceptSlotId: string,
    slotCourses: Record<string, ProgressSlotCourse[]>,
) {
    const coursesById = new Map<string, ProgressSlotCourse>();
    for (const courses of Object.values(slotCourses)) {
        for (const course of courses) {
            coursesById.set(course.id, course);
        }
    }

    const codes = new Set<string>();
    for (const [id, slot] of Object.entries(slots ?? {})) {
        if (id === exceptSlotId || !slot) {
            continue;
        }
        if (slot.subject && slot.number) {
            codes.add(courseCodeLabel(slot.subject, slot.number));
        }
        const course = slot.courseId ? coursesById.get(slot.courseId) : undefined;
        if (course) {
            codes.add(courseCodeLabel(course.subject, course.number));
        }
    }
    return codes;
}
