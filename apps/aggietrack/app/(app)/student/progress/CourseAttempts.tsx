"use client";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { DismissibleAlert } from "@/components/dismissible-alert";
import { Grade, type TranscriptSource, type TranscriptStatus } from "@/lib/generated/prisma/browser";
import {
    canClearAttempt,
    clearCompletionRow,
    clearCompletionToast,
    completionGradeChoices,
    completionGradeLabel,
    gradeCompletionRow,
    gradeUpdatedToast,
    isCompletionGrade,
    runAfterConfirmCloses,
} from "@/lib/completion-menu";
import {
    chooseAddAttemptGrade,
    confirmAddAttempt,
    creditFactLabel,
    openAddAttempt,
    type AddAttemptDraft,
} from "@/lib/retake-attempt";
import { cn } from "@/lib/utils";
import { CaretDownIcon, PlusIcon, XIcon } from "@phosphor-icons/react";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { addTranscriptAttempt, removeTranscriptAttempt, updateTranscriptGrade } from "./grade-actions";
import { GradeSelect } from "./GradeSelect";

type Attempt = {
    id: string;
    grade: string | null;
    status: TranscriptStatus;
    source: TranscriptSource;
    createdAt: Date;
};

const gradeChoices = completionGradeChoices();

export function CourseAttempts({
    courseId,
    subject,
    number,
    title,
    credits,
    attempts,
    recommendedTermCourseId,
    onUpdate,
    onAttemptsChange,
    onLastAttemptCleared,
    onClearFailed,
}: {
    courseId: string;
    subject: string;
    number: string;
    title: string;
    credits: number;
    attempts: Attempt[];
    recommendedTermCourseId?: string | null;
    onUpdate?: () => void;
    /** Keep the parent row on these attempts so a refresh is not required. */
    onAttemptsChange?: (attempts: Attempt[]) => void;
    onLastAttemptCleared?: () => void;
    onClearFailed?: () => void;
}) {
    const gradeFieldId = useId();
    const courseCode = `${subject} ${number}`;
    const namedCourse = courseId.length > 0;
    const [isPending, startTransition] = useTransition();
    const [localAttempts, setLocalAttempts] = useState(attempts);
    const [confirmId, setConfirmId] = useState<string | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [addDraft, setAddDraft] = useState<AddAttemptDraft | null>(null);
    const [adding, setAdding] = useState(false);
    const [retainedGrade, setRetainedGrade] = useState<Grade | null>(null);
    const [courseUnavailable, setCourseUnavailable] = useState(false);

    function handleGradeChange(attemptId: string, grade: Grade) {
        const oldAttempts = [...localAttempts];
        const nextAttempts = gradeCompletionRow(localAttempts, attemptId, grade);
        const message = gradeUpdatedToast(completionGradeLabel(grade));

        runAfterConfirmCloses(
            () => {
                setOpenMenuId(null);
                setLocalAttempts(nextAttempts);
                onAttemptsChange?.(nextAttempts);
            },
            () => {
                startTransition(async () => {
                    try {
                        const result = await updateTranscriptGrade({ entryId: attemptId, grade });
                        if (!result.success) {
                            setLocalAttempts(oldAttempts);
                            onAttemptsChange?.(oldAttempts);
                            toast.error("Could not update the grade", { description: result.error });
                            return;
                        }
                        toast.success(message.title, { description: message.description });
                        onUpdate?.();
                    } catch {
                        setLocalAttempts(oldAttempts);
                        onAttemptsChange?.(oldAttempts);
                        toast.error("The change could not be confirmed. Refresh before trying again.");
                    }
                });
            },
            (save) => {
                window.setTimeout(save, 0);
            },
        );
    }

    function openAddDialog() {
        if (namedCourse && (!Number.isInteger(credits) || credits < 1)) {
            setCourseUnavailable(true);
            return;
        }
        const opened = openAddAttempt();
        setAddDraft(retainedGrade ? chooseAddAttemptGrade(opened, retainedGrade) : opened);
    }

    function confirmNewAttempt() {
        if (!addDraft) return;
        const decision = confirmAddAttempt(addDraft, {
            courseId: namedCourse ? courseId : null,
            clientCredits: credits,
            catalogCredits: namedCourse ? credits : null,
        });
        setAddDraft(decision.draft);
        if (!decision.write) {
            if (decision.reason === "course-unavailable") setCourseUnavailable(true);
            return;
        }

        const grade = decision.grade;
        runAfterConfirmCloses(
            () => {
                setAddDraft(null);
                setAdding(true);
            },
            () => {
                startTransition(async () => {
                    try {
                        const result = await addTranscriptAttempt({
                            courseId: namedCourse ? courseId : null,
                            subject: namedCourse ? null : subject,
                            number: namedCourse ? null : number,
                            title: namedCourse ? null : title,
                            credits: decision.credits,
                            grade,
                            status: decision.status,
                            recommendedTermCourseId: recommendedTermCourseId ?? null,
                        });
                        setAdding(false);
                        if (!result.success) {
                            setRetainedGrade(grade);
                            if (result.error.toLowerCase().includes("course details unavailable")) {
                                setCourseUnavailable(true);
                                return;
                            }
                            toast.error("Attempt could not be added. Your choice has been kept.");
                            return;
                        }
                        setRetainedGrade(null);
                        toast.success("Attempt added");
                        const nextAttempts = [...localAttempts, { ...result.entry, createdAt: new Date(result.entry.createdAt) }];
                        setLocalAttempts(nextAttempts);
                        onAttemptsChange?.(nextAttempts);
                        onUpdate?.();
                    } catch {
                        setAdding(false);
                        setRetainedGrade(grade);
                        toast.error("Attempt could not be added. Your choice has been kept.");
                    }
                });
            },
            (save) => {
                window.setTimeout(save, 0);
            },
        );
    }

    function handleClear(attemptId: string) {
        const previous = localAttempts;
        const next = clearCompletionRow(localAttempts, attemptId);
        const menuStays = next.status === "complete";
        const message = clearCompletionToast({
            subject,
            number,
            anotherAttemptRemains: menuStays,
        });

        runAfterConfirmCloses(
            () => {
                setConfirmId(null);
                setOpenMenuId(null);
                if (menuStays) {
                    setLocalAttempts(next.attempts);
                    onAttemptsChange?.(next.attempts);
                } else {
                    onLastAttemptCleared?.();
                }
            },
            () => {
                startTransition(async () => {
                    try {
                        const result = await removeTranscriptAttempt({ entryId: attemptId });
                        if (!result.success) {
                            if (menuStays) {
                                setLocalAttempts(previous);
                                onAttemptsChange?.(previous);
                            } else {
                                onClearFailed?.();
                            }
                            toast.error("Could not clear this completion", { description: result.error });
                            return;
                        }
                        toast.success(message.title, { description: message.description });
                        onUpdate?.();
                    } catch {
                        if (menuStays) {
                            setLocalAttempts(previous);
                            onAttemptsChange?.(previous);
                        } else {
                            onClearFailed?.();
                        }
                        toast.error("The change could not be confirmed. Refresh before trying again.");
                    }
                });
            },
            (save) => {
                window.setTimeout(save, 0);
            },
        );
    }

    const sortedAttempts = [...localAttempts].sort((a, b) => {
        const timeCompare = a.createdAt.getTime() - b.createdAt.getTime();
        if (timeCompare !== 0) return timeCompare;
        return a.id.localeCompare(b.id);
    });
    const confirming = sortedAttempts.find((attempt) => attempt.id === confirmId) ?? null;
    const confirmingIndex = confirming ? sortedAttempts.indexOf(confirming) : -1;

    if (sortedAttempts.length === 0) {
        return null;
    }

    return (
        <div className="flex min-w-0 flex-col gap-2">
            {courseUnavailable ? (
                <DismissibleAlert
                    title="Course details unavailable"
                    onDismiss={() => setCourseUnavailable(false)}
                    action={
                        <Button type="button" size="sm" onClick={() => window.location.reload()}>
                            Refresh page
                        </Button>
                    }
                >
                    Refresh the page before adding an attempt.
                </DismissibleAlert>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
                {sortedAttempts.map((attempt, index) => (
                    <div key={attempt.id} className="flex items-center gap-2">
                        {sortedAttempts.length > 1 && (
                            <span className="text-xs text-muted-foreground">
                                #{index + 1}
                            </span>
                        )}
                        {attempt.status === "IN_PROGRESS" ? (
                            <>
                                <Badge variant="secondary" className="h-11 px-3 text-xs sm:h-auto">
                                    In progress
                                </Badge>
                                <GradeSelect
                                    value={null}
                                    onChange={(grade) => handleGradeChange(attempt.id, grade)}
                                    disabled={isPending}
                                    size="sm"
                                    placeholder="Set grade"
                                    courseCode={courseCode}
                                    attempt={sortedAttempts.length > 1 ? index + 1 : undefined}
                                />
                            </>
                        ) : (
                            <DropdownMenu
                                open={openMenuId === attempt.id}
                                onOpenChange={(open) => setOpenMenuId(open ? attempt.id : null)}
                            >
                                <DropdownMenuTrigger
                                    type="button"
                                    disabled={isPending}
                                    aria-label={sortedAttempts.length > 1
                                        ? `Grade for ${courseCode}, attempt ${index + 1}`
                                        : `Grade for ${courseCode}`}
                                    className={cn(
                                        buttonVariants({ variant: "outline", size: "sm" }),
                                        "h-11 min-w-[4.5rem] gap-1 px-2.5 sm:h-7",
                                    )}
                                >
                                    {completionGradeLabel(attempt.grade)}
                                    <CaretDownIcon className="size-4 text-muted-foreground" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="min-w-36">
                                    <DropdownMenuRadioGroup
                                        value={attempt.grade ?? ""}
                                        onValueChange={(value) => {
                                            if (typeof value === "string" && isCompletionGrade(value) && value !== attempt.grade) {
                                                handleGradeChange(attempt.id, value);
                                            }
                                        }}
                                    >
                                        {gradeChoices.map((choice) => (
                                            <DropdownMenuRadioItem key={choice.value} value={choice.value} closeOnClick>
                                                {choice.label}
                                            </DropdownMenuRadioItem>
                                        ))}
                                    </DropdownMenuRadioGroup>
                                    {canClearAttempt(attempt) ? (
                                        <>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                variant="destructive"
                                                onClick={() => {
                                                    setOpenMenuId(null);
                                                    setConfirmId(attempt.id);
                                                }}
                                            >
                                                Clear completion
                                            </DropdownMenuItem>
                                        </>
                                    ) : null}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                ))}
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={openAddDialog}
                    disabled={isPending || adding}
                    aria-busy={adding}
                    className="h-11 gap-1.5 px-3 text-muted-foreground hover:text-foreground sm:h-auto"
                >
                    <PlusIcon className="size-4" />
                    <span className="text-xs">{adding ? "Adding attempt…" : "Add attempt"}</span>
                </Button>
            </div>
            <Dialog
                open={addDraft?.open === true}
                onOpenChange={(open) => {
                    if (!open) setAddDraft(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add an attempt</DialogTitle>
                        <DialogDescription>
                            Record another attempt for {courseCode}. Choose the grade from your record.
                        </DialogDescription>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        {courseCode} · {creditFactLabel(credits)}
                    </p>
                    {addDraft?.validation ? (
                        <Alert>
                            <AlertTitle>Choose a grade</AlertTitle>
                            <AlertDescription>Select the grade from your record.</AlertDescription>
                            <AlertAction>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label="Dismiss message"
                                    onClick={() => setAddDraft((current) => current ? { ...current, validation: false } : current)}
                                >
                                    <XIcon />
                                </Button>
                            </AlertAction>
                        </Alert>
                    ) : null}
                    <Field>
                        <FieldLabel htmlFor={gradeFieldId}>Grade</FieldLabel>
                        <GradeSelect
                            id={gradeFieldId}
                            value={addDraft?.grade ?? null}
                            onChange={(grade) => setAddDraft((current) => current ? chooseAddAttemptGrade(current, grade) : current)}
                            placeholder="Choose a grade"
                            courseCode={courseCode}
                            size="default"
                            className="w-full min-w-36"
                        />
                        <FieldDescription>This grade can change your GPA.</FieldDescription>
                    </Field>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setAddDraft(null)}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={confirmNewAttempt}>
                            Add attempt
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <AlertDialog open={confirmId !== null} onOpenChange={(open) => { if (!open) setConfirmId(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Clear this completion?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {sortedAttempts.length > 1 && confirmingIndex >= 0
                                ? `Attempt ${confirmingIndex + 1} of ${courseCode} will be removed.`
                                : `${courseCode} goes back to not completed.`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            type="button"
                            variant="destructive"
                            onClick={() => {
                                if (confirmId) handleClear(confirmId);
                            }}
                        >
                            Clear completion
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
