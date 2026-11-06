"use server";

import { Prisma } from "@/lib/generated/prisma/client";
import {
    appendPlanNote,
    earlierNoteWhere,
    NOTE_PAGE_SIZE,
    pagePlanNotes,
    parseNoteCursor,
    planNoteDenial,
    presentPlanNote,
    type NotePlanAccess,
} from "@/lib/plan-notes";
import { personName } from "@/lib/plan-status";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/student";
import { revalidatePath } from "next/cache";

function accessOf(plan: { id: string; student: { userId: string; advisorId: string | null } } | null): NotePlanAccess | null {
    if (!plan) return null;
    return { id: plan.id, studentUserId: plan.student.userId, advisorId: plan.student.advisorId };
}

function refreshNoteViews(plannedTermId: string) {
    revalidatePath("/advisor");
    revalidatePath("/advisor/students");
    revalidatePath("/advisor/plans");
    revalidatePath(`/advisor/plans/${plannedTermId}`);
    revalidatePath("/student/planner");
}

async function readPlan(plannedTermId: string) {
    return prisma.plannedTerm.findUnique({
        where: { id: plannedTermId },
        select: { id: true, student: { select: { userId: true, advisorId: true } } },
    });
}

export async function postPlanNote(plannedTermId: string, body: string, requestId: string) {
    const user = await getSessionUser();
    try {
        const result = await prisma.$transaction(async (tx) => appendPlanNote(tx, {
            plan: accessOf(await tx.plannedTerm.findUnique({
                where: { id: plannedTermId },
                select: { id: true, student: { select: { userId: true, advisorId: true } } },
            })),
            viewer: user,
            authorName: personName(user),
            body,
            requestId,
        }));
        if (result.success) refreshNoteViews(plannedTermId);
        return result;
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            const existing = await prisma.planNote.findUnique({
                where: { authorId_requestId: { authorId: user.id, requestId } },
                select: { id: true, plannedTermId: true },
            });
            if (existing?.plannedTermId === plannedTermId) {
                return { success: true as const, noteId: existing.id, idempotent: true as const };
            }
        }
        return { success: false as const, error: "Note could not be posted. Your text has been kept.", code: "failed" as const };
    }
}

export async function loadEarlierPlanNotes(plannedTermId: string, cursor: string) {
    const user = await getSessionUser();
    const plan = accessOf(await readPlan(plannedTermId));
    const denial = planNoteDenial(user, plan);
    if (denial || !plan) {
        return { success: false as const, error: denial ?? "This plan does not exist or you do not have access to it.", notes: [], earlierCursor: null };
    }
    const parsed = parseNoteCursor(cursor);
    if (!parsed) {
        return { success: false as const, error: "Notes could not be loaded.", notes: [], earlierCursor: null };
    }
    const rows = await prisma.planNote.findMany({
        where: { plannedTermId: plan.id, ...earlierNoteWhere(parsed) },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: NOTE_PAGE_SIZE + 1,
    });
    const page = pagePlanNotes(rows);
    return {
        success: true as const,
        notes: page.notes.map(presentPlanNote),
        earlierCursor: page.earlierCursor,
    };
}
