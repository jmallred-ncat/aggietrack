import { completionGradeLabel, isCompletionGrade } from "./completion-menu";
import { Grade } from "./generated/prisma/browser";

/** Credits the server is allowed to store for one new attempt. */
export type AttemptCreditInput = {
    /** Catalog course id. Empty when the attempt is a custom course. */
    courseId: string | null;
    /** Credits sent by the browser. Ignored for a catalog course. */
    clientCredits: number;
    /** Credits on the catalog course. Null when that course cannot be loaded. */
    catalogCredits: number | null;
};

export function creditFactLabel(credits: number): string {
    return credits === 1 ? "1 credit" : `${credits} credits`;
}

/**
 * A named catalog course keeps its own credits, including a 1-credit lab.
 * A forged client value is ignored. A missing catalog course does not fall back to 3.
 * A custom course keeps the credits the student entered.
 */
export function resolveAttemptCredits(input: AttemptCreditInput):
    | { ok: true; credits: number }
    | { ok: false; code: "course-unavailable" } {
    if (input.courseId) {
        const credits = input.catalogCredits;
        if (typeof credits !== "number" || !Number.isInteger(credits) || credits < 1) {
            return { ok: false, code: "course-unavailable" };
        }
        return { ok: true, credits };
    }

    if (!Number.isInteger(input.clientCredits) || input.clientCredits < 1 || input.clientCredits > 6) {
        return { ok: false, code: "course-unavailable" };
    }
    return { ok: true, credits: input.clientCredits };
}

export type AddAttemptDraft = {
    open: boolean;
    /** Null until the student picks a grade. Never starts as C. */
    grade: Grade | null;
    pending: boolean;
    validation: boolean;
};

/** Opening the dialog does not write an attempt and does not choose a grade. */
export function openAddAttempt(): AddAttemptDraft {
    return { open: true, grade: null, pending: false, validation: false };
}

export function chooseAddAttemptGrade(draft: AddAttemptDraft, grade: Grade): AddAttemptDraft {
    return { ...draft, grade, validation: false };
}

export type AddAttemptDecision =
    | { write: false; reason: "grade" | "course-unavailable"; draft: AddAttemptDraft }
    | { write: true; grade: Grade; credits: number; status: "COMPLETED"; draft: AddAttemptDraft };

/**
 * A completed retake is written only after a real grade is chosen.
 * The dialog is already closed when the write is allowed to start.
 */
export function confirmAddAttempt(draft: AddAttemptDraft, credits: AttemptCreditInput): AddAttemptDecision {
    if (!draft.grade || !isCompletionGrade(draft.grade)) {
        return {
            write: false,
            reason: "grade",
            draft: { ...draft, open: true, pending: false, grade: null, validation: true },
        };
    }

    const resolved = resolveAttemptCredits(credits);
    if (!resolved.ok) {
        return {
            write: false,
            reason: "course-unavailable",
            draft: { ...draft, open: false, pending: false, validation: false },
        };
    }

    return {
        write: true,
        grade: draft.grade,
        credits: resolved.credits,
        status: "COMPLETED",
        draft: { ...draft, open: false, pending: true, validation: false },
    };
}

export function addAttemptGradeText(grade: Grade): string {
    return completionGradeLabel(grade);
}
