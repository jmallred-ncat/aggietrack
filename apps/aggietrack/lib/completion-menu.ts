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

export type CompletionRow = {
    attempts: Array<{ id: string; grade: string | null; status: string }>;
    status: "" | "complete" | "transfer";
};

/** The grade menu is showing only while a completed attempt is on the row. */
export function completionRowMode(row: Pick<CompletionRow, "attempts">): "menu" | "checkmark" {
    return row.attempts.some((attempt) => attempt.status === "COMPLETED") ? "menu" : "checkmark";
}

/** Drop a cleared attempt. The last one returns the row to an empty checkmark. */
export function clearCompletionRow<T extends CompletionAttempt>(
    attempts: readonly T[],
    attemptId: string,
): { attempts: T[]; status: "" | "complete" } {
    const next = startClearCompletion(attempts, attemptId);
    if (next.completed) {
        return { attempts: next.attempts, status: "complete" };
    }
    return { attempts: [], status: "" };
}

/** The checkmark is chosen. The grade menu waits until that save returns an attempt. */
export function markCompletionRow<T>(row: { attempts: readonly T[]; status: string }): { attempts: T[]; status: "complete" } {
    return { attempts: [...row.attempts], status: "complete" };
}

/** Attempts just written for this course. They replace whatever the row was showing. */
export function saveCompletionRow<T>(attempts: readonly T[]): T[] {
    return [...attempts];
}

/** A grade picked from the open menu, without leaving the row. */
export function gradeCompletionRow<T extends { id: string; grade: string | null; status: string }>(
    attempts: readonly T[],
    attemptId: string,
    grade: string,
): T[] {
    return attempts.map((attempt) => (
        attempt.id === attemptId ? { ...attempt, grade, status: "COMPLETED" } : attempt
    ));
}

export function gradeUpdatedToast(label: string): { title: string; description: string } {
    return { title: "Grade updated", description: `Saved as ${label}.` };
}

export function clearCompletionToast(input: {
    subject: string;
    number: string;
    anotherAttemptRemains: boolean;
}): { title: string; description: string } {
    if (input.anotherAttemptRemains) {
        return { title: "Attempt removed", description: "That attempt was removed." };
    }
    return {
        title: "Completion cleared",
        description: `${input.subject} ${input.number} is not completed.`,
    };
}

/** Courses whose checkmark was just saved. Skips a course that was already complete. */
export function labelsNewlyMarkedComplete(
    rows: ReadonlyArray<{ label: string; previous?: string | null; next?: string | null }>,
): string[] {
    const labels: string[] = [];
    for (const row of rows) {
        const label = row.label.trim();
        if (!label || row.next !== "complete" || row.previous === "complete") {
            continue;
        }
        labels.push(label);
    }
    return labels;
}

export function markedCompleteToast(labels: readonly string[]): { title: string; description: string } | null {
    if (labels.length === 0) {
        return null;
    }
    const names = labels.length === 1
        ? labels[0]
        : labels.length === 2
            ? `${labels[0]} and ${labels[1]}`
            : `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
    return {
        title: "Marked complete",
        description: labels.length === 1 ? `${names} is saved.` : `${names} are saved.`,
    };
}

/**
 * Close the confirm on this click. Start the save on a later turn.
 * A save started in the same click keeps the dialog open until the request finishes.
 */
export function runAfterConfirmCloses(close: () => void, save: () => void, schedule: (save: () => void) => void) {
    close();
    schedule(save);
}
