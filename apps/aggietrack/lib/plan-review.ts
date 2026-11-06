import type { Prisma } from "./generated/prisma/client";
import { advisorOwnsPlan } from "./plan-approval-authz";
import { checkedNoteBody } from "./plan-notes";
import { recordCoursesInProgress } from "./transcript-write";

export const reviewCopy = {
    forbidden: "You no longer have access to this plan.",
    notWaiting: "This plan is no longer waiting for review.",
    stale: "This plan changed",
    approveFailed: "Plan could not be approved. Try again.",
    returnFailed: "Plan could not be returned. Your comment has been kept.",
    pin: "Enter a registration pin of 4 to 12 letters or numbers.",
    empty: "The student needs to add courses before this plan can be approved.",
    unavailable: "This plan does not exist or you do not have access to it.",
} as const;

const pinPattern = /^[A-Za-z0-9]{4,12}$/;

export type ReviewPlan = {
    id: string;
    status: string;
    revision: number;
    studentId: string;
    termId: string;
    student: { advisorId: string | null };
    courses: Array<{ courseId: string; credits: number }>;
};

export type ReviewResult =
    | { success: true; status: "APPROVED" | "RETURNED"; revision: number; noteId: string; idempotent?: boolean }
    | { success: false; error: string; code: "forbidden" | "not-waiting" | "stale" | "rules" | "empty" | "invalid" | "unavailable"; violations?: string[] };

type ReviewTx = {
    planNote: {
        findUnique: (args: {
            where: { authorId_requestId: { authorId: string; requestId: string } };
        }) => Promise<{ id: string; plannedTermId: string } | null>;
        create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
    };
    plannedTerm: {
        updateMany: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<{ count: number }>;
        findUnique: (args: { where: { id: string } }) => Promise<ReviewPlan | null>;
    };
    transcriptEntry: Prisma.TransactionClient["transcriptEntry"];
};

function failure(code: "forbidden" | "not-waiting" | "stale" | "rules" | "empty" | "invalid" | "unavailable", error: string, violations?: string[]): ReviewResult {
    return violations ? { success: false, code, error, violations } : { success: false, code, error };
}

async function classifyMiss(tx: ReviewTx, planId: string, advisorId: string, expectedRevision: number): Promise<ReviewResult> {
    const current = await tx.plannedTerm.findUnique({ where: { id: planId } });
    if (!current || !advisorOwnsPlan(advisorId, current)) return failure("forbidden", reviewCopy.forbidden);
    if (current.status !== "SUBMITTED") return failure("not-waiting", reviewCopy.notWaiting);
    if (current.revision !== expectedRevision) return failure("stale", reviewCopy.stale);
    return failure("not-waiting", reviewCopy.notWaiting);
}

export async function applyAdvisorDecision(tx: ReviewTx, input: {
    advisorId: string;
    advisorName: string;
    requestId: string;
    expectedRevision: number;
    plan: ReviewPlan | null;
    decision: "approve" | "return";
    registrationPin?: string;
    comment?: string;
    violations?: string[];
}): Promise<ReviewResult> {
    if (input.requestId) {
        const existing = await tx.planNote.findUnique({
            where: { authorId_requestId: { authorId: input.advisorId, requestId: input.requestId } },
        });
        if (existing && input.plan && existing.plannedTermId === input.plan.id) {
            return {
                success: true,
                status: input.decision === "approve" ? "APPROVED" : "RETURNED",
                revision: input.plan.revision,
                noteId: existing.id,
                idempotent: true,
            };
        }
    }
    if (!input.plan) return failure("unavailable", reviewCopy.unavailable);
    if (!advisorOwnsPlan(input.advisorId, input.plan)) return failure("forbidden", reviewCopy.forbidden);
    if (input.plan.status !== "SUBMITTED") return failure("not-waiting", reviewCopy.notWaiting);

    if (input.decision === "approve") {
        const pin = input.registrationPin?.trim() ?? "";
        if (!pinPattern.test(pin)) return failure("invalid", reviewCopy.pin);
        if (input.plan.courses.length === 0) return failure("empty", reviewCopy.empty);
        if (input.violations && input.violations.length > 0) {
            return failure("rules", input.violations[0]!, input.violations);
        }
    } else {
        const comment = checkedNoteBody(input.comment ?? "", "comment");
        if (!comment.ok) return failure("invalid", comment.error);
    }

    const updated = await tx.plannedTerm.updateMany({
        where: {
            id: input.plan.id,
            status: "SUBMITTED",
            revision: input.expectedRevision,
            student: { advisorId: input.advisorId },
        },
        data: input.decision === "approve"
            ? {
                status: "APPROVED",
                registrationPin: input.registrationPin?.trim(),
                reviewedAt: new Date(),
                revision: { increment: 1 },
            }
            : {
                status: "RETURNED",
                reviewedAt: new Date(),
                registrationPin: null,
                registeredAt: null,
                revision: { increment: 1 },
            },
    });
    if (updated.count !== 1) return classifyMiss(tx, input.plan.id, input.advisorId, input.expectedRevision);

    if (input.decision === "approve") {
        await recordCoursesInProgress(tx as unknown as Prisma.TransactionClient, {
            studentId: input.plan.studentId,
            termId: input.plan.termId,
            courses: input.plan.courses,
        });
    }

    const comment = input.decision === "return" ? checkedNoteBody(input.comment ?? "", "comment") : null;
    const note = await tx.planNote.create({
        data: {
            plannedTermId: input.plan.id,
            authorId: input.advisorId,
            authorName: input.advisorName.trim() || "Former user",
            authorRole: "ADVISOR",
            kind: input.decision === "approve" ? "APPROVAL" : "RETURN",
            body: comment && comment.ok ? comment.body : "",
            requestId: input.requestId,
        },
    });
    return {
        success: true,
        status: input.decision === "approve" ? "APPROVED" : "RETURNED",
        revision: input.expectedRevision + 1,
        noteId: note.id,
    };
}
