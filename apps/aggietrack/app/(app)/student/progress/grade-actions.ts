"use server";

import { Grade, type TranscriptStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStudentProfile } from "@/lib/student";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const gradeValues = Object.values(Grade);
const gradeSchema = z.enum(gradeValues as [string, ...string[]]);

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
    status: z.enum(["IN_PROGRESS", "COMPLETED"]),
    recommendedTermCourseId: z.string().min(1).nullable(),
}).refine(
    (data) => (data.courseId != null) !== (data.subject != null && data.number != null && data.title != null),
    { message: "Must provide either courseId or subject/number/title" }
).refine(
    (data) => data.status === "IN_PROGRESS" || data.grade != null,
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

    revalidatePath("/student/progress");
    revalidatePath("/student", "layout");
    revalidatePath("/student");

    return { success: true as const };
}

/**
 * Add a new attempt (retake) for a course.
 * Only allows adding attempts for the current student.
 */
export async function addTranscriptAttempt(input: unknown) {
    const profile = await requireStudentProfile();
    const parsed = addAttemptSchema.safeParse(input);

    if (!parsed.success) {
        return { success: false as const, error: "Invalid attempt request." };
    }

    const { courseId, subject, number, title, credits, grade, status, recommendedTermCourseId } = parsed.data;

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

    // Create the new transcript entry
    await prisma.transcriptEntry.create({
        data: {
            studentId: profile.id,
            courseId,
            subject: courseId ? null : subject,
            number: courseId ? null : number,
            title: courseId ? null : title,
            credits,
            grade: status === "IN_PROGRESS" ? null : grade,
            status: status as TranscriptStatus,
            source: grade === Grade.TR ? "TRANSFER" : "NCAT",
            recommendedTermCourseId,
        },
    });

    revalidatePath("/student/progress");
    revalidatePath("/student", "layout");
    revalidatePath("/student");

    return { success: true as const };
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

    revalidatePath("/student/progress");
    revalidatePath("/student", "layout");
    revalidatePath("/student");

    return { success: true as const };
}
