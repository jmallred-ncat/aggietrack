"use client";

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
    completionGradeChoices,
    completionGradeLabel,
    isCompletionGrade,
    startClearCompletion,
} from "@/lib/completion-menu";
import { cn } from "@/lib/utils";
import { CaretDownIcon, PlusIcon } from "@phosphor-icons/react";
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
    credits,
    attempts,
    recommendedTermCourseId,
    onUpdate,
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
    onLastAttemptCleared?: () => void;
    onClearFailed?: () => void;
}) {
    const [isPending, startTransition] = useTransition();
    const [localAttempts, setLocalAttempts] = useState(attempts);
    const [confirmId, setConfirmId] = useState<string | null>(null);

    function handleGradeChange(attemptId: string, grade: Grade) {
        const oldAttempts = [...localAttempts];
        const label = completionGradeLabel(grade);

        setLocalAttempts((current) =>
            current.map((attempt) => attempt.id === attemptId ? { ...attempt, grade, status: "COMPLETED" } : attempt),
        );

        startTransition(async () => {
            const result = await updateTranscriptGrade({ entryId: attemptId, grade });

            if (!result.success) {
                setLocalAttempts(oldAttempts);
                toast.error("Could not update the grade", { description: result.error });
                return;
            }

            toast.success("Grade updated", { description: `Saved as ${label}.` });
            onUpdate?.();
        });
    }

    function handleAddAttempt(asInProgress = false) {
        startTransition(async () => {
            const result = await addTranscriptAttempt({
                courseId,
                subject: null,
                number: null,
                title: null,
                credits,
                grade: asInProgress ? null : Grade.C,
                status: asInProgress ? "IN_PROGRESS" : "COMPLETED",
                recommendedTermCourseId: recommendedTermCourseId ?? null,
            });

            if (!result.success) {
                toast.error("Could not add the attempt", { description: result.error });
                return;
            }

            toast.success(asInProgress ? "Marked as in progress" : "Attempt added");
            setLocalAttempts((current) => [...current, result.entry]);
            onUpdate?.();
        });
    }

    function handleClear(attemptId: string) {
        const previous = localAttempts;
        const next = startClearCompletion(localAttempts, attemptId);
        setConfirmId(next.dialogOpen ? attemptId : null);

        if (next.completed) {
            setLocalAttempts(next.attempts);
        } else {
            onLastAttemptCleared?.();
        }

        startTransition(async () => {
            const result = await removeTranscriptAttempt({ entryId: attemptId });

            if (!result.success) {
                if (next.completed) {
                    setLocalAttempts(previous);
                } else {
                    onClearFailed?.();
                }
                toast.error("Could not clear this completion", { description: result.error });
                return;
            }

            const description = next.completed
                ? "That attempt was removed."
                : `${subject} ${number} is not completed.`;
            toast.success(next.completed ? "Attempt removed" : "Completion cleared", { description });
            onUpdate?.();
        });
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
                            <Badge variant="secondary" className="h-11 px-3 text-xs sm:h-auto">
                                In progress
                            </Badge>
                            <GradeSelect
                                value={null}
                                onChange={(grade) => handleGradeChange(attempt.id, grade)}
                                disabled={isPending}
                                size="sm"
                                placeholder="Set grade"
                            />
                        </>
                    ) : (
                        <DropdownMenu>
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
                                        <DropdownMenuRadioItem key={choice.value} value={choice.value}>
                                            {choice.label}
                                        </DropdownMenuRadioItem>
                                    ))}
                                </DropdownMenuRadioGroup>
                                {canClearAttempt(attempt) ? (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem variant="destructive" onClick={() => setConfirmId(attempt.id)}>
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
                onClick={() => handleAddAttempt(false)}
                disabled={isPending}
                className="h-11 gap-1.5 px-3 text-muted-foreground hover:text-foreground sm:h-auto"
            >
                <PlusIcon className="size-4" />
                <span className="text-xs">Add attempt</span>
            </Button>
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
