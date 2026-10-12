import { Prisma, type Grade, type TranscriptSource, type TranscriptStatus } from "./generated/prisma/client";
import { prisma } from "./prisma";
import { requireStudentProfile } from "./student";

export const progressStatuses = ["complete", "transfer"] as const;

export type ProgressStatus = (typeof progressStatuses)[number];

export function progressStatusFromEntry(entry: {
    status: TranscriptStatus;
    source: TranscriptSource;
    grade: Grade | null;
}): ProgressStatus | "" {
    if (entry.status === "IN_PROGRESS") {
        return "";
    }
    if (entry.source === "TRANSFER" || entry.grade === "TR") {
        return "transfer";
    }
    if (entry.status === "COMPLETED") {
        return "complete";
    }
    return "";
}

export function transcriptFieldsForProgressStatus(status: ProgressStatus): {
    status: TranscriptStatus;
    source: TranscriptSource;
    grade: Grade | null;
} {
    if (status === "transfer") {
        return { status: "COMPLETED", source: "TRANSFER", grade: "TR" };
    }
    return { status: "COMPLETED", source: "NCAT", grade: null };
}

/** Courses an approved plan records as in progress. Skips a course the student has already started or finished. */
export async function recordCoursesInProgress(
    tx: Prisma.TransactionClient,
    input: {
        studentId: string;
        termId: string;
        courses: Array<{ courseId: string; credits: number }>;
    },
) {
    if (input.courses.length === 0) {
        return;
    }

    const existing = await tx.transcriptEntry.findMany({
        where: {
            studentId: input.studentId,
            courseId: { in: input.courses.map((row) => row.courseId) },
            status: { in: ["IN_PROGRESS", "COMPLETED"] },
        },
        select: { courseId: true },
    });
    const taken = new Set(existing.map((entry) => entry.courseId));
    const additions = input.courses.filter((row) => row.courseId && !taken.has(row.courseId));
    if (additions.length === 0) {
        return;
    }

    await tx.transcriptEntry.createMany({
        data: additions.map((row) => ({
            studentId: input.studentId,
            courseId: row.courseId,
            termId: input.termId,
            credits: row.credits,
            status: "IN_PROGRESS" as const,
            source: "NCAT" as const,
            grade: null,
        })),
    });
}

export async function getTranscript() {
    const profile = await requireStudentProfile();

    return prisma.transcriptEntry.findMany({
        where: {
            studentId: profile.id,
        },
        include: {
            course: {
                select: {
                    id: true,
                    subject: true,
                    number: true,
                    title: true,
                    credits: true,
                },
            },
        },
        orderBy: {
            updatedAt: "desc",
        },
    });
}