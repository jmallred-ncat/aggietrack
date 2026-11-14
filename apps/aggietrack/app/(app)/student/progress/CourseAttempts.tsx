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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
    keepAddAttemptChoice,
    openAddAttempt,
} from "@/lib/add-attempt";
import { attemptCreditPhrase, catalogCreditsReady } from "@/lib/attempt-credits";
import { cn } from "@/lib/utils";
import { CaretDownIcon, PlusIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [localAttempts, setLocalAttempts] = useState(attempts);
    const [confirmId, setConfirmId] = useState<string | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [addOpen, setAddOpen] = useState(false);
    const [addGrade, setAddGrade] = useState<Grade | null>(null);
    const [adding, setAdding] = useState(false);
    const [addNotice, setAddNotice] = useState<"grade" | "credits" | null>(null);
    const courseCode = `${subject} ${number}`;

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
                    let result: Awaited<ReturnType<typeof updateTranscriptGrade>>;
                    try {
                        result = await updateTranscriptGrade({ entryId: attemptId, grade });
                    } catch {
                        setLocalAttempts(oldAttempts);
                        onAttemptsChange?.(oldAttempts);
                        toast.error("Could not update the grade", {
                            description: "The change could not be confirmed. Refresh before trying again.",
                        });
                        return;
                    }

                    if (!result.success) {
                        setLocalAttempts(oldAttempts);
                        onAttemptsChange?.(oldAttempts);
                        toast.error("Could not update the grade", { description: result.error });
                        return;
                    }

                    toast.success(message.title, { description: message.description });
                    onUpdate?.();
                });
            },
            (save) => {
                window.setTimeout(save, 0);
            },
        );
    }

    function openAdd() {
        if (!catalogCreditsReady(credits)) {
            setAddOpen(false);
            setAddNotice("credits");
            return;
        }
        const draft = openAddAttempt(addGrade);
        setAddGrade(draft.grade);
        setAddNotice(null);
        setAddOpen(true);
    }

    function confirmAdd() {
        const decision = confirmAddAttempt({ open: true, grade: addGrade, pending: false });
        if (!decision.ok) {
            setAddNotice("grade");
            setAddOpen(true);
            return;
        }

        const grade = decision.grade;
        const named = courseId.length > 0;
        runAfterConfirmCloses(
            () => {
                setAddOpen(false);
                setAddNotice(null);
                setAdding(true);
            },
            () => {
                startTransition(async () => {
                    let result: Awaited<ReturnType<typeof addTranscriptAttempt>>;
                    try {
                        result = await addTranscriptAttempt({
                            courseId: named ? courseId : null,
                            subject: named ? null : subject,
                            number: named ? null : number,
                            title: named ? null : title,
                            credits,
                            grade,
                            status: "COMPLETED",
                            recommendedTermCourseId: recommendedTermCourseId ?? null,
                        });
                    } catch {
                        const kept = keepAddAttemptChoice({ open: false, grade, pending: true });
                        setAddGrade(kept.grade);
                        setAdding(false);
                        toast.error("Attempt could not be added. Your choice has been kept.");
                        return;
                    }

                    if (!result.success) {
                        const kept = keepAddAttemptChoice({ open: false, grade, pending: true });
                        setAddGrade(kept.grade);
                        setAdding(false);
                        toast.error("Attempt could not be added. Your choice has been kept.");
                        return;
                    }

                    setAddGrade(null);
                    setAdding(false);
                    toast.success("Attempt added");
                    const nextAttempts = [...localAttempts, { ...result.entry, createdAt: new Date(result.entry.createdAt) }];
                    setLocalAttempts(nextAttempts);
                    onAttemptsChange?.(nextAttempts);
                    onUpdate?.();
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
                            {attempt.grade === "I" ? (
                                <>
                                    <Badge variant="secondary" className="h-11 px-3 text-xs sm:h-auto">
                                        Incomplete (I)
                                    </Badge>
                                    <DropdownMenu
                                        open={openMenuId === attempt.id}
                                        onOpenChange={(open) => setOpenMenuId(open ? attempt.id : null)}
                                    >
                                        <DropdownMenuTrigger
                                            type="button"
                                            disabled={isPending}
                                            aria-label={sortedAttempts.length > 1
                                                ? `${subject} ${number} attempt ${index + 1}, grade Incomplete. Set final grade`
                                                : `${subject} ${number}, grade Incomplete. Set final grade`}
                                            className={cn(
                                                buttonVariants({ variant: "outline", size: "sm" }),
                                                "h-11 min-w-fit gap-1 whitespace-nowrap px-2.5 sm:h-7",
                                            )}
                                        >
                                            Set final grade
                                            <CaretDownIcon className="size-4 text-muted-foreground" />
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="min-w-48">
                                            <DropdownMenuRadioGroup
                                                value=""
                                                onValueChange={(value) => {
                                                    if (typeof value === "string" && isCompletionGrade(value)) {
                                                        handleGradeChange(attempt.id, value);
                                                    }
                                                }}
                                            >
                                                {gradeChoices.filter(choice => choice.value !== Grade.I).map((choice) => (
                                                    <DropdownMenuRadioItem key={choice.value} value={choice.value} closeOnClick>
                                                        {choice.label}
                                                    </DropdownMenuRadioItem>
                                                ))}
                                            </DropdownMenuRadioGroup>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </>
                            ) : (
                                <>
                                    <Badge variant="secondary" className="h-11 px-3 text-xs sm:h-auto">
                                        <span className="sm:hidden">In prog.</span>
                                        <span className="hidden sm:inline">In progress</span>
                                    </Badge>
                                    <GradeSelect
                                        value={null}
                                        onChange={(grade) => handleGradeChange(attempt.id, grade)}
                                        disabled={isPending}
                                        size="sm"
                                        placeholder="Set grade"
                                        className="min-w-fit whitespace-nowrap data-[size=sm]:h-11 sm:data-[size=sm]:h-7"
                                        label={sortedAttempts.length > 1
                                            ? `Grade for ${courseCode}, attempt ${index + 1}`
                                            : `Grade for ${courseCode}`}
                                    />
                                </>
                            )}
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
                                    ? `${subject} ${number} attempt ${index + 1}, grade ${completionGradeLabel(attempt.grade)}. Change grade or clear completion`
                                    : `${subject} ${number}, grade ${completionGradeLabel(attempt.grade)}. Change grade or clear completion`}
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
            {adding ? (
                <span className="text-xs text-muted-foreground" aria-live="polite">Adding attempt…</span>
            ) : null}
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={openAdd}
                disabled={isPending}
                className="h-11 gap-1.5 px-3 text-muted-foreground hover:text-foreground sm:h-auto"
            >
                <PlusIcon className="size-4" />
                <span className="text-xs">Add attempt</span>
            </Button>
            {addNotice === "credits" ? (
                <Alert>
                    <AlertTitle>Course details unavailable</AlertTitle>
                    <AlertDescription>Refresh the page before adding an attempt.</AlertDescription>
                    <Button type="button" size="sm" variant="outline" onClick={() => router.refresh()}>
                        Refresh page
                    </Button>
                    <AlertAction>
                        <Button type="button" size="sm" variant="ghost" aria-label="Dismiss message" onClick={() => setAddNotice(null)}>
                            Dismiss message
                        </Button>
                    </AlertAction>
                </Alert>
            ) : null}
            <Dialog
                open={addOpen}
                onOpenChange={(open) => {
                    setAddOpen(open);
                    if (!open) setAddNotice((current) => current === "grade" ? null : current);
                }}
            >
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add an attempt</DialogTitle>
                        <DialogDescription>
                            Record another attempt for {courseCode}. Choose the grade from your record.
                        </DialogDescription>
                    </DialogHeader>
                    <p className="text-sm font-medium">{courseCode} · {attemptCreditPhrase(credits)}</p>
                    {addNotice === "grade" ? (
                        <Alert>
                            <AlertTitle>Choose a grade</AlertTitle>
                            <AlertDescription>Select the grade from your record.</AlertDescription>
                            <AlertAction>
                                <Button type="button" size="sm" variant="ghost" aria-label="Dismiss message" onClick={() => setAddNotice(null)}>
                                    Dismiss message
                                </Button>
                            </AlertAction>
                        </Alert>
                    ) : null}
                    <Field>
                        <FieldLabel>Grade</FieldLabel>
                        <GradeSelect
                            value={addGrade}
                            onChange={(grade) => {
                                setAddGrade(chooseAddAttemptGrade({ open: true, grade: addGrade, pending: false }, grade).grade);
                                setAddNotice(null);
                            }}
                            disabled={isPending}
                            placeholder="Choose a grade"
                            label="Grade"
                            className="w-full"
                        />
                        <FieldDescription>This grade can change your GPA.</FieldDescription>
                    </Field>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setAddOpen(false);
                                setAddGrade(null);
                                setAddNotice(null);
                            }}
                        >
                            Cancel
                        </Button>
                        <Button type="button" onClick={confirmAdd}>
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
                                ? `Attempt ${confirmingIndex + 1} of ${subject} ${number} will be removed.`
                                : `${subject} ${number} goes back to not completed.`}
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
