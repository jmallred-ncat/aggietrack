"use server";

import { resolveAttemptCredits } from "@/lib/attempt-credits";
import { Grade, type TranscriptStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStudentProfile } from "@/lib/student";
import { refreshStudentViews } from "@/lib/refresh-student-views";
import { progressInProgressRejection } from "@/lib/transcript-write";
import { z } from "zod";

const gradeSchema = z.nativeEnum(Grade);

const updateGradeSchema = z.object({
    entryId: z.string().min(1),
    grade: gradeSchema,
});

const addAttemptSchema = z.object({
    courseId: z.string().min(1).nullable(),
    subject: z.string().max(8).nullable(),
    number: z.string().max(8).nullable(),
    title: z.string().max(120).nullable(),
    credits: z.number().int().min(1).max(6),
    grade: gradeSchema.nullable(),
    status: z.literal("COMPLETED"),
    recommendedTermCourseId: z.string().min(1).nullable(),
}).refine(
    (data) => (data.courseId != null) !== (data.subject != null && data.number != null && data.title != null),
    { message: "Must provide either courseId or subject/number/title" }
).refine(
    (data) => data.grade != null,
    { message: "Grade required for completed courses" }
);

const removeAttemptSchema = z.object({
    entryId: z.string().min(1),
});

/**
 * Update the grade for an existing transcript entry.
 * Only allows updating entries owned by the current student.
 */
export async function updateTranscriptGrade(input: unknown) {
    const profile = await requireStudentProfile();
    const parsed = updateGradeSchema.safeParse(input);

    if (!parsed.success) {
        return { success: false as const, error: "Invalid grade update request." };
    }

    const { entryId, grade } = parsed.data;

    const existing = await prisma.transcriptEntry.findUnique({
        where: { id: entryId },
        select: { studentId: true, status: true },
    });

    if (!existing) {
        return { success: false as const, error: "Transcript entry not found." };
    }

    if (existing.studentId !== profile.id) {
        return { success: false as const, error: "You can only update your own transcript entries." };
    }

    // Allow converting IN_PROGRESS to COMPLETED by setting a grade
    // Update the grade and mark as completed
    await prisma.transcriptEntry.update({
        where: { id: entryId },
        data: {
            grade,
            status: "COMPLETED",
            source: grade === Grade.TR ? "TRANSFER" : "NCAT",
        },
    });

    refreshStudentViews();

    return { success: true as const };
}

/**
 * Add a new attempt (retake) for a course.
 * Only allows adding attempts for the current student.
 */
export async function addTranscriptAttempt(input: unknown) {
    const requested = typeof input === "object" && input !== null && "status" in input
        ? (input as { status?: unknown }).status
        : undefined;
    if (typeof requested === "string") {
        const rejected = progressInProgressRejection(requested);
        if (rejected) return { success: false as const, error: rejected };
    }
    const profile = await requireStudentProfile();
    const parsed = addAttemptSchema.safeParse(input);

    if (!parsed.success) {
        return { success: false as const, error: "Invalid attempt request." };
    }

    const { courseId, subject, number, title, credits, grade, recommendedTermCourseId } = parsed.data;

    // Verify the student has access to this course (either catalog course or it's their own entry)
    if (recommendedTermCourseId) {
        const allowed = await prisma.recommendedTermCourse.findFirst({
            where: {
                id: recommendedTermCourseId,
                term: { catalogYearId: profile.catalogYearId },
            },
        });

        if (!allowed) {
            return { success: false as const, error: "This course is not on your plan." };
        }
    } else if (courseId) {
        const allowed = await prisma.recommendedTermCourse.findFirst({
            where: {
                courseId,
                term: { catalogYearId: profile.catalogYearId },
            },
        });

        if (!allowed) {
            return { success: false as const, error: "This course is not on your plan." };
        }
    }

    const catalogCredits = courseId
        ? (await prisma.course.findUnique({
            where: { id: courseId },
            select: { credits: true },
        }))?.credits ?? null
        : null;
    const resolvedCredits = resolveAttemptCredits({
        courseId,
        catalogCredits,
        clientCredits: credits,
    });
    if (!resolvedCredits.ok) {
        return { success: false as const, error: resolvedCredits.error };
    }

    // Create the new transcript entry
    const newEntry = await prisma.transcriptEntry.create({
        data: {
            studentId: profile.id,
            courseId,
            subject: courseId ? null : subject,
            number: courseId ? null : number,
            title: courseId ? null : title,
            credits: resolvedCredits.credits,
            grade,
            status: "COMPLETED" satisfies TranscriptStatus,
            source: grade === Grade.TR ? "TRANSFER" : "NCAT",
            recommendedTermCourseId,
        },
        select: {
            id: true,
            grade: true,
            status: true,
            source: true,
            createdAt: true,
        },
    });

    refreshStudentViews();

    return { 
        success: true as const, 
        entry: {
            id: newEntry.id,
            grade: newEntry.grade,
            status: newEntry.status,
            source: newEntry.source,
            createdAt: newEntry.createdAt,
        },
    };
}

/**
 * Remove a transcript attempt.
 * Only allows removing attempts owned by the current student.
 */
export async function removeTranscriptAttempt(input: unknown) {
    const profile = await requireStudentProfile();
    const parsed = removeAttemptSchema.safeParse(input);

    if (!parsed.success) {
        return { success: false as const, error: "Invalid remove request." };
    }

    const { entryId } = parsed.data;

    const existing = await prisma.transcriptEntry.findUnique({
        where: { id: entryId },
        select: { studentId: true, status: true },
    });

    if (!existing) {
        return { success: false as const, error: "Transcript entry not found." };
    }

    if (existing.studentId !== profile.id) {
        return { success: false as const, error: "You can only remove your own transcript entries." };
    }

    if (existing.status === "IN_PROGRESS") {
        return { success: false as const, error: "Cannot remove in-progress courses." };
    }

    await prisma.transcriptEntry.delete({
        where: { id: entryId },
    });

    refreshStudentViews();

    return { success: true as const };
}
