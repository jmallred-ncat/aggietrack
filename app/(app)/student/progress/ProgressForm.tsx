"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { ToggleInput, ToggleInputGroup } from "@/components/ui/toggle-input";
import type { ProgressSlotCourse } from "@/lib/catalog";
import { courseCodeLabel, parseCourseCode } from "@/lib/course-code";
import { zodResolver } from "@hookform/resolvers/zod";
import { Combobox } from "@base-ui/react/combobox";
import { ArrowsLeftRightIcon, CaretDownIcon, CheckCircleIcon, CircleIcon, ClockIcon, XIcon } from "@phosphor-icons/react";
import { useId, useRef, useState, type ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { saveTranscriptProgress } from "./actions";

const courseStatuses = [
    { value: "complete", label: "Complete", icon: CheckCircleIcon },
    { value: "transfer", label: "Transfer", icon: ArrowsLeftRightIcon },
    { value: "active", label: "Active", icon: ClockIcon },
] as const;

const statusSchema = z.enum(["complete", "transfer", "active", ""]);

const slotSchema = z.object({
    courseId: z.string(),
    subject: z.string(),
    number: z.string(),
    title: z.string(),
    credits: z.string(),
    status: statusSchema,
});

const formSchema = z.object({
    courses: z.record(z.string(), statusSchema),
    slots: z.record(z.string(), slotSchema),
}).superRefine((data, ctx) => {
    for (const [id, slot] of Object.entries(data.slots)) {
        const entered = !slot.courseId && Boolean(slot.subject || slot.number);
        if ((slot.courseId || entered) && !slot.status) {
            ctx.addIssue({
                code: "custom",
                path: ["slots", id, "status"],
                message: "Choose complete, transfer, or active for this course.",
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

type ProgressFormValues = z.infer<typeof formSchema>;
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
        | { id: string; kind: "course"; courseId: string; subject: string; number: string; title: string }
        | {
            id: string;
            kind: "slot";
            groupId: string;
            badge: string | null;
            title: string;
            allowUnlisted: boolean;
            minNumber: number;
        }
    >;
};

export type ProgressYear = {
    id: string;
    label: string;
    terms: ProgressTerm[];
};

function StatusIcon({ value, icon: Icon }: { value: string; icon: typeof CheckCircleIcon }) {
    if (value === "transfer") {
        return <Icon weight="bold" />;
    }

    return (
        <span className="relative inline-flex size-4">
            {value === "active" ? (
                <CircleIcon weight="fill" className="absolute inset-0 size-4 opacity-20" aria-hidden />
            ) : (
                <Icon weight="fill" className="absolute inset-0 size-4 opacity-20" aria-hidden />
            )}
            <Icon weight="bold" className="relative size-4" />
        </span>
    );
}

function CourseStatusField({
    value,
    onChange,
    onBlur,
    disabled,
}: {
    value?: SlotValue["status"];
    onChange?: (value: SlotValue["status"]) => void;
    onBlur?: () => void;
    disabled?: boolean;
}) {
    return (
        <ToggleInputGroup
            {...(value === undefined ? {} : { value })}
            onValueChange={(next) => {
                if (next === "" || next === "complete" || next === "transfer" || next === "active") {
                    onChange?.(next);
                }
            }}
            onBlur={onBlur}
            disabled={disabled}
            variant="default"
            attached
            className="w-full sm:w-fit"
        >
            {courseStatuses.map(({ value: status, label, icon }) => (
                <ToggleInput key={status} value={status} aria-label={label} title={label} className="flex-1 px-0 sm:flex-none">
                    <StatusIcon value={status} icon={icon} />
                </ToggleInput>
            ))}
        </ToggleInputGroup>
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
    onChange: (value: SlotValue) => void;
    onBlur: () => void;
}) {
    const hasCourse = Boolean(value.courseId || (value.subject && value.number));

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
                    disabled={!hasCourse}
                    onChange={(status) => onChange({ ...value, status })}
                    onBlur={onBlur}
                />
            </div>
            {statusError ? <p className="text-xs text-destructive">{statusError}</p> : null}
        </div>
    );
}

export default function ProgressForm({
    years,
    defaultCourses,
    defaultSlots,
    slotCourses,
    reservedCourseCodes,
}: {
    years: ProgressYear[];
    defaultCourses: ProgressFormValues["courses"];
    defaultSlots: ProgressFormValues["slots"];
    slotCourses: Record<string, ProgressSlotCourse[]>;
    reservedCourseCodes: string[];
}) {
    const form = useForm<ProgressFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: { courses: defaultCourses, slots: defaultSlots },
    });
    const watchedSlots = useWatch({ control: form.control, name: "slots" });

    async function onSubmit(data: ProgressFormValues) {
        const result = await saveTranscriptProgress({
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
        });

        if (!result.success) {
            toast.add({ title: result.error });
            return;
        }

        form.reset(data);
        toast.add({
            title: "Progress saved",
            description: "Your transcript now includes the courses you marked.",
        });
    }

    const { isSubmitting, isDirty } = form.formState;

    return (
        <form onSubmit={form.handleSubmit(onSubmit, () => {
            toast.add({ title: "Enter a title, credit hours, and a status for each course you add." });
        })}>
            <section className="mt-6 space-y-8 pb-6">
                {years.map((year) => (
                    <div key={year.id}>
                        <h2 className="px-4 text-lg font-semibold">{year.label}</h2>
                        <div className="mt-3 space-y-6">
                            {year.terms.map((term) => (
                                <div key={term.id}>
                                    <h3 className="rounded-lg bg-muted px-4 py-2 text-sm font-medium">{term.label}</h3>
                                    <div className="space-y-4 px-4 pt-3">
                                        {term.rows.map((row) => (
                                <div key={row.id} className="flex flex-col gap-2 not-typeset sm:flex-row sm:items-center sm:justify-between">
                                    <p className="flex min-w-0 items-center gap-2 overflow-hidden text-sm font-medium">
                                        {row.kind === "course" ? (
                                            <>
                                                <Badge className="font-mono">{row.subject} {row.number}</Badge>
                                                <span className="min-w-0 truncate">{row.title}</span>
                                            </>
                                        ) : (
                                            <>
                                                {row.badge && <Badge variant="outline" className="font-mono">{row.badge}</Badge>}
                                                <span className="min-w-0 truncate">{row.title}</span>
                                            </>
                                        )}
                                    </p>
                                    {row.kind === "course" ? (
                                        <Controller
                                            control={form.control}
                                            name={`courses.${row.courseId}`}
                                            render={({ field }) => (
                                                <CourseStatusField
                                                    value={field.value ?? ""}
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
                                                    courses={slotCourses[row.groupId] ?? []}
                                                    label={row.title}
                                                    value={field.value ?? emptySlotValue}
                                                    excludedIds={claimedCourseIds(watchedSlots, row.id)}
                                                    excludedCodes={claimedCourseCodes(watchedSlots, row.id, slotCourses)}
                                                    reservedCodes={new Set(reservedCourseCodes)}
                                                    allowUnlisted={row.allowUnlisted}
                                                    minNumber={row.minNumber}
                                                    statusError={form.formState.errors.slots?.[row.id]?.status?.message}
                                                    onChange={field.onChange}
                                                    onBlur={field.onBlur}
                                                />
                                            )}
                                        />
                                    )}
                                </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </section>
            <div className="flex justify-end pb-6">
                <Button type="submit" disabled={!isDirty || isSubmitting}>
                    {isSubmitting ? "Saving" : "Save progress"}
                </Button>
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
