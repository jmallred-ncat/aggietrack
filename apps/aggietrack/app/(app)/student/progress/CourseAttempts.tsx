"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { Grade, type TranscriptSource, type TranscriptStatus } from "@/lib/generated/prisma/client";
import { PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { addTranscriptAttempt, removeTranscriptAttempt, updateTranscriptGrade } from "./grade-actions";
import { GradeSelect } from "./GradeSelect";

type Attempt = {
    id: string;
    grade: string | null;
    status: TranscriptStatus;
    source: TranscriptSource;
};

export function CourseAttempts({
    courseId,
    subject,
    number,
    title,
    credits,
    attempts,
    recommendedTermCourseId,
    onUpdate,
}: {
    courseId: string;
    subject: string;
    number: string;
    title: string;
    credits: number;
    attempts: Attempt[];
    recommendedTermCourseId?: string | null;
    onUpdate?: () => void;
}) {
    const [isPending, startTransition] = useTransition();
    const [localAttempts, setLocalAttempts] = useState(attempts);

    async function handleGradeChange(attemptId: string, grade: Grade) {
        const oldAttempts = [...localAttempts];
        
        // Optimistic update
        setLocalAttempts(prev => 
            prev.map(a => a.id === attemptId ? { ...a, grade } : a)
        );

        startTransition(async () => {
            const result = await updateTranscriptGrade({ entryId: attemptId, grade });
            
            if (!result.success) {
                // Revert on failure
                setLocalAttempts(oldAttempts);
                toast.error({ title: "Failed to update grade", description: result.error });
            } else {
                toast.success({ title: "Grade updated", description: "Your grade has been saved." });
                onUpdate?.();
            }
        });
    }

    async function handleAddAttempt() {
        startTransition(async () => {
            const result = await addTranscriptAttempt({
                courseId,
                subject: null,
                number: null,
                title: null,
                credits,
                grade: Grade.C,
                recommendedTermCourseId: recommendedTermCourseId ?? null,
            });

            if (!result.success) {
                toast.error({ title: "Failed to add attempt", description: result.error });
            } else {
                toast.success({ title: "Attempt added", description: "You can now edit the grade." });
                onUpdate?.();
            }
        });
    }

    async function handleRemoveAttempt(attemptId: string) {
        const oldAttempts = [...localAttempts];

        // Optimistic update
        setLocalAttempts(prev => prev.filter(a => a.id !== attemptId));

        startTransition(async () => {
            const result = await removeTranscriptAttempt({ entryId: attemptId });

            if (!result.success) {
                // Revert on failure
                setLocalAttempts(oldAttempts);
                toast.error({ title: "Failed to remove attempt", description: result.error });
            } else {
                toast.success({ title: "Attempt removed" });
                onUpdate?.();
            }
        });
    }

    const completedAttempts = localAttempts.filter(a => a.status === "COMPLETED");

    if (completedAttempts.length === 0) {
        return null;
    }

    return (
        <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                {completedAttempts.map((attempt, index) => (
                    <div key={attempt.id} className="flex items-center gap-2">
                        {completedAttempts.length > 1 && (
                            <span className="text-xs text-muted-foreground">
                                #{index + 1}
                            </span>
                        )}
                        <GradeSelect
                            value={attempt.grade as Grade | null}
                            onChange={(grade) => handleGradeChange(attempt.id, grade)}
                            disabled={isPending}
                            size="sm"
                        />
                        {completedAttempts.length > 1 && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => handleRemoveAttempt(attempt.id)}
                                disabled={isPending}
                                aria-label={`Remove attempt ${index + 1}`}
                                className="text-muted-foreground hover:text-destructive"
                            >
                                <TrashIcon className="size-4" />
                            </Button>
                        )}
                    </div>
                ))}
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddAttempt}
                    disabled={isPending}
                    className="gap-1.5"
                >
                    <PlusIcon className="size-3.5" />
                    <span className="text-xs">Add attempt</span>
                </Button>
            </div>
        </div>
    );
}
