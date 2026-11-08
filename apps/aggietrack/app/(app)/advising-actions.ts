"use server";

import {
    addAvailability,
    availabilityFields,
    bookSlot,
    cancelSession,
    loadAdvisorAppointments,
    loadStudentAdvising,
    moveOpenSlot,
    removeOpenSlot,
    removeZoom,
    rescheduleChoices,
    rescheduleSession,
    saveDuration,
    saveZoom,
} from "@/lib/advising-meetings";
import { discardTermDraft, publishTerm, reviewTerm, saveTermDraft } from "@/lib/advising-publish";
import type { ScheduleConfig } from "@/lib/advising-schedule";
import type { MeetingResult, OpenSlotChoice } from "@/lib/advising-types";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

async function actorId() {
    const session = await auth.api.getSession({ headers: await headers() });
    return session?.user?.id ?? null;
}

function refresh() {
    revalidatePath("/student/advising");
    revalidatePath("/advisor/appointments");
    revalidatePath("/student");
    revalidatePath("/advisor");
}

async function run(work: (userId: string) => Promise<MeetingResult>): Promise<MeetingResult> {
    const userId = await actorId();
    if (!userId) {
        return { ok: false, code: "signed-out", title: "Sign in to continue", description: "Your session ended. Sign in again before making changes." };
    }
    const result = await work(userId);
    if (result.ok || (!result.ok && result.code === "review")) refresh();
    return result;
}

export async function bookSessionAction(slotId: string, topic: string): Promise<MeetingResult> {
    return run((userId) => bookSlot(prisma, userId, slotId, topic));
}

export async function cancelSessionAction(sessionId: string, note: string): Promise<MeetingResult> {
    return run((userId) => cancelSession(prisma, userId, sessionId, note));
}

export async function rescheduleSessionAction(sessionId: string, slotId: string, note: string): Promise<MeetingResult> {
    return run((userId) => rescheduleSession(prisma, userId, sessionId, slotId, note));
}

export async function rescheduleChoicesAction(sessionId: string): Promise<OpenSlotChoice[]> {
    const userId = await actorId();
    if (!userId) return [];
    return rescheduleChoices(prisma, userId, sessionId);
}

export async function saveDurationAction(minutes: number): Promise<MeetingResult> {
    const result = await run((userId) => saveDuration(prisma, userId, minutes));
    if (!result.ok && result.code === "failed") {
        return { ...result, title: "Session length could not be saved. Try again.", description: "Try again." };
    }
    return result;
}

export async function addAvailabilityAction(input: { date: string; start: string; end?: string; durationMinutes?: number; termId?: string }): Promise<MeetingResult> {
    const fields = availabilityFields(input);
    return run((userId) => addAvailability(prisma, userId, { ...fields, durationMinutes: input.durationMinutes, termId: input.termId }));
}

export async function saveTermDraftAction(termId: string, config: ScheduleConfig): Promise<MeetingResult> {
    return run((userId) => saveTermDraft(prisma, userId, termId, config));
}

export async function discardTermDraftAction(termId: string): Promise<MeetingResult> {
    return run((userId) => discardTermDraft(prisma, userId, termId));
}

export async function reviewTermAction(termId: string, config: ScheduleConfig): Promise<MeetingResult> {
    return run((userId) => reviewTerm(prisma, userId, termId, config));
}

export async function publishTermAction(termId: string, token: string): Promise<MeetingResult> {
    return run((userId) => publishTerm(prisma, userId, termId, token));
}

export async function moveOpenSlotAction(slotId: string, input: { date: string; start: string }): Promise<MeetingResult> {
    const fields = availabilityFields(input);
    return run((userId) => moveOpenSlot(prisma, userId, slotId, { date: fields.date, start: fields.start }));
}

export async function removeOpenSlotAction(slotId: string): Promise<MeetingResult> {
    return run((userId) => removeOpenSlot(prisma, userId, slotId));
}

export async function saveZoomAction(sessionId: string, url: string): Promise<MeetingResult> {
    return run((userId) => saveZoom(prisma, userId, sessionId, url));
}

export async function removeZoomAction(sessionId: string): Promise<MeetingResult> {
    return run((userId) => removeZoom(prisma, userId, sessionId));
}

export async function reloadStudentAction() {
    const userId = await actorId();
    if (!userId) return null;
    return loadStudentAdvising(prisma, userId);
}

export async function reloadAdvisorAction() {
    const userId = await actorId();
    if (!userId) return null;
    return loadAdvisorAppointments(prisma, userId);
}
