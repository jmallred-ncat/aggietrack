import type { Prisma } from "./generated/prisma/client";

/** Progress cannot create an in-progress row. Approval is the only writer. */
export function progressInProgressRejection(status: string) {
    if (status === "IN_PROGRESS") {
        return "A course is marked in progress only after your advisor approves the plan.";
    }
    return null;
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
