"use server";

import { Prisma } from "@/lib/generated/prisma/client";
import { violationsForTerm } from "@/lib/plan-rule-check";
import { applyAdvisorDecision, reviewCopy, type ReviewPlan } from "@/lib/plan-review";
import { personName } from "@/lib/plan-status";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/student";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const decisionSchema = z.object({
    plannedTermId: z.string().min(1),
    expectedRevision: z.number().int().nonnegative(),
    requestId: z.string().min(1).max(80),
});

const approvalSchema = decisionSchema.extend({
    registrationPin: z.string(),
});

const returnSchema = decisionSchema.extend({
    comment: z.string(),
});

function refreshDecision(plannedTermId: string) {
    revalidatePath("/advisor");
    revalidatePath("/advisor/students");
    revalidatePath("/advisor/plans");
    revalidatePath(`/advisor/plans/${plannedTermId}`);
    revalidatePath("/student");
    revalidatePath("/student/planner");
    revalidatePath("/student/progress");
}

async function loadReviewPlan(db: Prisma.TransactionClient, plannedTermId: string): Promise<ReviewPlan | null> {
    const plan = await db.plannedTerm.findUnique({
        where: { id: plannedTermId },
        select: {
            id: true,
            status: true,
            revision: true,
            studentId: true,
            termId: true,
            student: { select: { advisorId: true } },
            courses: { select: { courseId: true, course: { select: { credits: true } } } },
        },
    });
    if (!plan) return null;
    return {
        id: plan.id,
        status: plan.status,
        revision: plan.revision,
        studentId: plan.studentId,
        termId: plan.termId,
        student: plan.student,
        courses: plan.courses.map((row) => ({ courseId: row.courseId, credits: row.course.credits })),
    };
}

async function decide(input: {
    plannedTermId: string;
    expectedRevision: number;
    requestId: string;
    decision: "approve" | "return";
    registrationPin?: string;
    comment?: string;
}) {
    const user = await getSessionUser();
    if (user.role !== "ADVISOR") {
        return { success: false as const, error: reviewCopy.forbidden, code: "forbidden" as const };
    }
    try {
        const outcome = await prisma.$transaction(async (tx) => {
            const plan = await loadReviewPlan(tx, input.plannedTermId);
            const violations = input.decision === "approve" && plan
                ? await violationsForTerm(tx, plan.studentId, plan.id)
                : [];
            return applyAdvisorDecision(tx as never, {
                advisorId: user.id,
                advisorName: personName(user),
                requestId: input.requestId,
                expectedRevision: input.expectedRevision,
                plan,
                decision: input.decision,
                registrationPin: input.registrationPin,
                comment: input.comment,
                violations,
            });
        });
        if (outcome.success) refreshDecision(input.plannedTermId);
        return outcome;
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            const existing = await prisma.planNote.findUnique({
                where: { authorId_requestId: { authorId: user.id, requestId: input.requestId } },
            });
            if (existing?.plannedTermId === input.plannedTermId) {
                return {
                    success: true as const,
                    status: input.decision === "approve" ? "APPROVED" as const : "RETURNED" as const,
                    revision: input.expectedRevision,
                    noteId: existing.id,
                    idempotent: true as const,
                };
            }
        }
        return {
            success: false as const,
            error: "Decision could not be confirmed",
            code: "failed" as const,
        };
    }
}

export async function approvePlannedTerm(plannedTermId: string, registrationPin: string, expectedRevision: number, requestId: string) {
    const parsed = approvalSchema.safeParse({ plannedTermId, registrationPin, expectedRevision, requestId });
    if (!parsed.success) {
        return { success: false as const, error: reviewCopy.pin, code: "invalid" as const };
    }
    return decide({ ...parsed.data, decision: "approve" });
}

export async function returnPlannedTerm(plannedTermId: string, comment: string, expectedRevision: number, requestId: string) {
    const parsed = returnSchema.safeParse({ plannedTermId, comment, expectedRevision, requestId });
    if (!parsed.success) {
        return { success: false as const, error: reviewCopy.returnFailed, code: "invalid" as const };
    }
    return decide({ ...parsed.data, decision: "return" });
}
