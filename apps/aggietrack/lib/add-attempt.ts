import { completionGradeLabel, isCompletionGrade } from "./completion-menu";
import type { Grade } from "./generated/prisma/browser";

export type AddAttemptDraft = {
    open: boolean;
    grade: Grade | null;
    pending: boolean;
};

/** Opening the dialog collects a grade. Nothing is written, and C is not preselected. */
export function openAddAttempt(keptGrade: Grade | null = null): AddAttemptDraft {
    return {
        open: true,
        grade: keptGrade && isCompletionGrade(keptGrade) ? keptGrade : null,
        pending: false,
    };
}

/** The grade that would be saved. Opening, or confirming with no grade, saves nothing. */
export function addAttemptWrite(draft: AddAttemptDraft): Grade | null {
    if (!draft.pending || !draft.grade || !isCompletionGrade(draft.grade)) {
        return null;
    }
    return draft.grade;
}

export function chooseAddAttemptGrade(draft: AddAttemptDraft, grade: string): AddAttemptDraft {
    if (!isCompletionGrade(grade)) {
        return draft;
    }
    return { ...draft, grade };
}

export function confirmAddAttempt(draft: AddAttemptDraft):
    | { ok: false; draft: AddAttemptDraft }
    | { ok: true; grade: Grade; label: string; draft: AddAttemptDraft } {
    if (!draft.grade || !isCompletionGrade(draft.grade)) {
        return { ok: false, draft: { ...draft, open: true, pending: false } };
    }

    const grade = draft.grade;
    return {
        ok: true,
        grade,
        label: completionGradeLabel(grade),
        draft: { open: false, grade, pending: true },
    };
}

/** A failed save keeps the grade the student chose so they can try again. */
export function keepAddAttemptChoice(draft: AddAttemptDraft): AddAttemptDraft {
    return { open: false, grade: draft.grade, pending: false };
}
