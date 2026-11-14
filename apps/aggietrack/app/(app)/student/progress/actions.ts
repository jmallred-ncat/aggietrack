"use server";

import { getProgressSlotCourses } from "@/lib/catalog";
import { Prisma, type Grade, type TranscriptStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStudentProfile } from "@/lib/student";
import { progressStatuses } from "@/lib/transcript";
import { refreshStudentViews } from "@/lib/refresh-student-views";
import { saveProgressCore, type SaveProgressInput } from "@/lib/progress-save";
import { z } from "zod";

const statusSchema = z.enum(progressStatuses).nullable();

const standingSchema = z.enum(["FRESHMAN", "SOPHOMORE", "JUNIOR", "SENIOR"]).nullable();

const payloadSchema = z.object({
    standing: standingSchema,
    courses: z.array(z.object({
        courseId: z.string().min(1),
        status: statusSchema,
    })),
    slots: z.array(z.object({
        recommendedTermCourseId: z.string().min(1),
        courseId: z.string().min(1).nullable(),
        subject: z.string().max(8).nullable(),
        number: z.string().max(8).nullable(),
        title: z.string().max(120).nullable(),
        credits: z.number().int().min(1).max(6).nullable(),
        status: statusSchema,
    })),
    confirmStart: z.boolean().optional(),
});

export async function saveTranscriptProgress(input: unknown) {
    const profile = await requireStudentProfile();
    const parsed = payloadSchema.safeParse(input);

    if (!parsed.success) {
        return { success: false as const, error: "Those progress choices could not be saved." };
    }

    const { courses, slots, confirmStart, standing } = parsed.data;
    
    // Fetch slot courses (required by saveProgressCore)
    const slotCourses = await getProgressSlotCourses();
    
    // Prepare input for saveProgressCore
    const saveInput: SaveProgressInput = {
        standing,
        courses,
        slots,
        confirmStart,
    };

    let startConfirmed = false;
    const attemptSelect = { id: true, grade: true, status: true, source: true, createdAt: true } as const;
    let savedCourseAttempts: Record<string, Array<{
        id: string;
        grade: Grade | null;
        status: TranscriptStatus;
        source: Prisma.TranscriptEntryGetPayload<{ select: typeof attemptSelect }>["source"];
        createdAt: Date;
    }>> = {};
    let savedSlotAttempts: typeof savedCourseAttempts = {};
    
    await prisma.$transaction(async (tx) => {
        // Call the extracted core save logic
        const result = await saveProgressCore(tx, profile, saveInput, slotCourses);
        
        if (!result.success) {
            throw new Error(result.error);
        }
        
        // Read back saved attempts for return value
        const saved = await tx.transcriptEntry.findMany({
            where: { studentId: profile.id },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: { ...attemptSelect, courseId: true, recommendedTermCourseId: true },
        });
        
        savedCourseAttempts = {};
        for (const course of courses) {
            savedCourseAttempts[course.courseId] = saved
                .filter((row) => row.courseId === course.courseId && row.recommendedTermCourseId == null)
                .map(({ id, grade, status, source, createdAt }) => ({ id, grade, status, source, createdAt }));
        }
        
        savedSlotAttempts = {};
        for (const slot of slots) {
            savedSlotAttempts[slot.recommendedTermCourseId] = saved
                .filter((row) => row.recommendedTermCourseId === slot.recommendedTermCourseId)
                .map(({ id, grade, status, source, createdAt }) => ({ id, grade, status, source, createdAt }));
        }
        
        // Check if start was confirmed
        startConfirmed = (await tx.studentProfile.findUnique({
            where: { id: profile.id },
            select: { startConfirmedAt: true },
        }))?.startConfirmedAt != null;
    });

    refreshStudentViews();
    return {
        success: true as const,
        startConfirmed,
        courseAttempts: savedCourseAttempts,
        slotAttempts: savedSlotAttempts,
    };
}

export async function confirmNoPriorCoursework(input: unknown) {
    const profile = await requireStudentProfile();
    const parsed = z.object({ standing: standingSchema }).safeParse(input);
    if (!parsed.success) {
        return { success: false as const, error: "That student status could not be saved." };
    }
    const recorded = await prisma.transcriptEntry.count({
        where: { studentId: profile.id },
    });
    if (recorded > 0) {
        return { success: false as const, error: "Recorded courses are already saved. Clear them before saying you have no prior coursework." };
    }

    await prisma.studentProfile.update({
        where: { id: profile.id },
        data: {
            standing: parsed.data.standing,
            ...(!profile.startConfirmedAt ? { startConfirmedAt: new Date() } : {}),
        },
    });

    refreshStudentViews();
    return { success: true as const };
}
