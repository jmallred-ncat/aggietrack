import type { Grade, TranscriptSource, TranscriptStatus } from "./generated/prisma/client";
import { prisma } from "./prisma";
import { requireStudentProfile } from "./student";

export const progressStatuses = ["complete", "transfer", "active"] as const;

export type ProgressStatus = (typeof progressStatuses)[number];

export function progressStatusFromEntry(entry: {
    status: TranscriptStatus;
    source: TranscriptSource;
    grade: Grade | null;
}): ProgressStatus | "" {
    if (entry.status === "IN_PROGRESS") {
        return "active";
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
    if (status === "active") {
        return { status: "IN_PROGRESS", source: "NCAT", grade: null };
    }
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