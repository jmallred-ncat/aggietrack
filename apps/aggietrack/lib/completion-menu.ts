import { Grade } from "./generated/prisma/browser";
import { gradeLabel } from "./enum-labels";

const completionGrades = [
    Grade.A,
    Grade.A_MINUS,
    Grade.B_PLUS,
    Grade.B,
    Grade.B_MINUS,
    Grade.C_PLUS,
    Grade.C,
    Grade.C_MINUS,
    Grade.D_PLUS,
    Grade.D,
    Grade.F,
    Grade.P,
    Grade.TR,
    Grade.W,
    Grade.I,
] as const;

const completionGradeValues = new Set<string>(completionGrades);

export type CompletionAttempt = {
    id: string;
    status: string;
};

/** Letter grades a student can record on a completed attempt, with display labels. */
export function completionGradeChoices(): Array<{ value: Grade; label: string }> {
    return completionGrades.map((grade) => ({
        value: grade,
        label: gradeLabel(grade),
    }));
}

export function isCompletionGrade(value: string): value is Grade {
    return completionGradeValues.has(value);
}

/** Label shown on the course row. Never the stored enum, such as A_MINUS. */
export function completionGradeLabel(grade: string | null): string {
    if (grade && isCompletionGrade(grade)) {
        return gradeLabel(grade);
    }
    return "Grade";
}

/** A recorded completion can be cleared even when it is the only attempt. */
export function canClearAttempt(attempt: { status: string }): boolean {
    return attempt.status === "COMPLETED";
}

/**
 * Clearing starts by closing the confirmation. The attempt leaves the row immediately.
 * The course is completed only when another completed attempt remains.
 */
export function startClearCompletion<T extends CompletionAttempt>(
    attempts: readonly T[],
    attemptId: string,
): { dialogOpen: false; attempts: T[]; completed: boolean } {
    const next = attempts.filter((attempt) => attempt.id !== attemptId);
    return {
        dialogOpen: false,
        attempts: next,
        completed: next.some((attempt) => attempt.status === "COMPLETED"),
    };
}
