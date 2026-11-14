import type { Grade, TranscriptSource, TranscriptStatus } from "./generated/prisma/client";
import { prisma } from "./prisma";
import { requireStudentProfile } from "./student";

export { progressInProgressRejection, recordCoursesInProgress } from "./transcript-write";

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
    // COMPLETED, FAILED, and WITHDRAWN all show as logged with grade visible
    if (entry.status === "COMPLETED" || entry.status === "FAILED" || entry.status === "WITHDRAWN") {
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