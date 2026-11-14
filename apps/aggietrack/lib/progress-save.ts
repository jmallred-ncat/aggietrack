import { courseCodeLabel } from "@/lib/course-code";
import { Prisma, type TranscriptStatus, type StudentProfile } from "@/lib/generated/prisma/client";
import { progressStatuses, transcriptFieldsForProgressStatus } from "@/lib/transcript";

type ProgressStatus = (typeof progressStatuses)[number];

export type SaveProgressInput = {
    standing: "FRESHMAN" | "SOPHOMORE" | "JUNIOR" | "SENIOR" | null;
    courses: Array<{
        courseId: string;
        status: ProgressStatus | null;
    }>;
    slots: Array<{
        recommendedTermCourseId: string;
        courseId: string | null;
        subject: string | null;
        number: string | null;
        title: string | null;
        credits: number | null;
        status: ProgressStatus | null;
    }>;
    confirmStart?: boolean;
};

type TranscriptEntryWriteInput = {
    existing: { id: string; status: TranscriptStatus } | null;
    studentId: string;
    courseId: string | null;
    subject: string | null;
    number: string | null;
    title: string | null;
    recommendedTermCourseId: string | null;
    status: ProgressStatus | null;
    credits: number;
};

async function writeTranscriptEntry(
    tx: Prisma.TransactionClient,
    input: TranscriptEntryWriteInput,
) {
    const { existing, studentId, courseId, subject, number, title, recommendedTermCourseId, status, credits } = input;
    
    if (!status) {
        if (existing && existing.status === "COMPLETED") {
            await tx.transcriptEntry.delete({ where: { id: existing.id } });
        }
        return;
    }

    const fields = transcriptFieldsForProgressStatus(status);
    if (!fields) return;

    const data = {
        studentId,
        courseId,
        subject,
        number,
        title,
        recommendedTermCourseId,
        credits,
        ...fields,
    };

    if (existing) {
        await tx.transcriptEntry.update({
            where: { id: existing.id },
            data,
        });
    } else {
        await tx.transcriptEntry.create({ data });
    }
}

type SlotInput = SaveProgressInput["slots"][number];

type ResolvedSlot = {
    recommendedTermCourseId: string;
    status: ProgressStatus | null;
    courseId: string | null;
    subject: string | null;
    number: string | null;
    title: string | null;
    credits: number;
};

async function resolveSlotCourse(
    slot: SlotInput,
    group: { slot: string; minNumber: number | null },
    eligible: Array<{ id: string; subject: string; number: string; title: string; credits: number; lab: boolean }>,
): Promise<
    | { ok: true; courseId: string | null; subject: string | null; number: string | null; title: string | null; credits: number }
    | { ok: false; error: string }
> {
    // If no status, we don't need a valid course
    if (!slot.status) {
        return { ok: true, courseId: null, subject: null, number: null, title: null, credits: 0 };
    }

    if (slot.courseId) {
        const course = eligible.find((c) => c.id === slot.courseId);
        if (!course) {
            return { ok: false, error: "That course is not allowed in this requirement." };
        }
        return { ok: true, courseId: course.id, subject: null, number: null, title: null, credits: course.credits };
    }

    if (slot.subject && slot.number) {
        const found = eligible.find((c) => c.subject === slot.subject && c.number === slot.number);
        if (found) {
            return { ok: true, courseId: found.id, subject: null, number: null, title: null, credits: found.credits };
        }

        if (group.slot !== "FREE_ELECTIVE") {
            return { ok: false, error: "That course is not in the catalog or not allowed in this requirement." };
        }

        if (!slot.credits || slot.credits < 1 || slot.credits > 6) {
            return { ok: false, error: "Credit hours must be between 1 and 6." };
        }

        if (group.minNumber && parseInt(slot.number) < group.minNumber) {
            return {
                ok: false,
                error: `This elective must be numbered ${group.minNumber} or higher (such as ${slot.subject} ${group.minNumber}).`,
            };
        }

        return {
            ok: true,
            courseId: null,
            subject: slot.subject,
            number: slot.number,
            title: slot.title,
            credits: slot.credits,
        };
    }

    return { ok: false, error: "Choose a course from the dropdown or type its code." };
}

/**
 * Core progress save logic extracted for testing.
 * Validates input, resolves slot courses, and writes transcript entries.
 * Preserves FAILED/WITHDRAWN/IN_PROGRESS entries.
 * 
 * @param slotCourses - Map of requirement group ID to eligible courses for that group
 */
export async function saveProgressCore(
    tx: Prisma.TransactionClient,
    profile: Pick<StudentProfile, "id" | "catalogYearId" | "startConfirmedAt">,
    input: SaveProgressInput,
    slotCourses: Record<string, Array<{ id: string; subject: string; number: string; title: string; credits: number; lab: boolean }>>,
): Promise<{ success: true } | { success: false; error: string }> {
    const { courses, slots, confirmStart, standing } = input;
    const marked = courses.some((entry) => entry.status) || slots.some((entry) => entry.status);
    if (confirmStart && !marked) {
        return { success: false, error: "Mark the courses you have completed, or say you have no prior coursework." };
    }

    const courseIds = courses.map((entry) => entry.courseId);
    const slotIds = slots.map((entry) => entry.recommendedTermCourseId);
    const [allowed, slotRows] = await Promise.all([
        tx.recommendedTermCourse.findMany({
            where: {
                courseId: { in: courseIds },
                term: { catalogYearId: profile.catalogYearId },
            },
            select: {
                courseId: true,
                course: { select: { credits: true } },
            },
        }),
        tx.recommendedTermCourse.findMany({
            where: {
                id: { in: slotIds },
                term: { catalogYearId: profile.catalogYearId },
                requirementGroupId: { not: null },
            },
            select: {
                id: true,
                requiresLab: true,
                requirementGroupId: true,
                requirementGroup: {
                    select: { slot: true, minNumber: true },
                },
            },
        }),
    ]);

    const creditsByCourse = new Map(
        allowed.flatMap((row) => row.courseId && row.course ? [[row.courseId, row.course.credits] as const] : []),
    );

    if (creditsByCourse.size !== new Set(courseIds).size || slotRows.length !== new Set(slotIds).size) {
        return { success: false, error: "A course on this plan could not be updated." };
    }

    const groupBySlot = new Map(slotRows.map((row) => [row.id, row]));
    const claimed = new Set<string>();
    for (const course of courses) {
        if (!course.status) {
            continue;
        }
        const key = `course:${course.courseId}`;
        if (claimed.has(key)) {
            return { success: false, error: "Each course can only be recorded once." };
        }
        claimed.add(key);
    }

    const resolvedSlots: ResolvedSlot[] = [];

    for (const slot of slots) {
        const row = groupBySlot.get(slot.recommendedTermCourseId);
        if (!row?.requirementGroup) {
            return { success: false, error: "A course on this plan could not be updated." };
        }

        const eligible = (slotCourses[row.requirementGroupId!] ?? [])
            .filter((course) => !row.requiresLab || course.lab);
        const resolved = await resolveSlotCourse(slot, row.requirementGroup, eligible);
        if (!resolved.ok) {
            return { success: false, error: resolved.error };
        }

        if (resolved.courseId) {
            creditsByCourse.set(resolved.courseId, resolved.credits);
        }

        const key = resolved.courseId
            ? `course:${resolved.courseId}`
            : resolved.subject && resolved.number
                ? `code:${courseCodeLabel(resolved.subject, resolved.number)}`
                : null;
        if (slot.status && key) {
            if (claimed.has(key)) {
                return { success: false, error: "Each course can only be recorded once." };
            }
            claimed.add(key);
        }

        resolvedSlots.push({
            recommendedTermCourseId: slot.recommendedTermCourseId,
            status: slot.status,
            courseId: resolved.courseId,
            subject: resolved.subject,
            number: resolved.number,
            title: resolved.title,
            credits: resolved.credits,
        });
    }

    // Write ordinary course entries
    for (const entry of courses) {
        const credits = creditsByCourse.get(entry.courseId);
        if (credits === undefined) {
            continue;
        }

        const existing = await tx.transcriptEntry.findFirst({
            where: {
                studentId: profile.id,
                courseId: entry.courseId,
                recommendedTermCourseId: null,
            },
            orderBy: { updatedAt: "desc" },
        });

        await writeTranscriptEntry(tx, {
            existing,
            studentId: profile.id,
            courseId: entry.courseId,
            subject: null,
            number: null,
            title: null,
            recommendedTermCourseId: null,
            status: entry.status,
            credits,
        });
    }

    // Write slot entries - preserve FAILED/WITHDRAWN/IN_PROGRESS
    for (const slot of resolvedSlots) {
        const existing = await tx.transcriptEntry.findFirst({
            where: {
                studentId: profile.id,
                recommendedTermCourseId: slot.recommendedTermCourseId,
            },
            orderBy: { updatedAt: "desc" },
        });

        if (!slot.status || (!slot.courseId && !slot.subject)) {
            // Don't delete FAILED, WITHDRAWN, or IN_PROGRESS entries when form status is blank
            if (existing && 
                existing.status !== "IN_PROGRESS" &&
                existing.status !== "FAILED" &&
                existing.status !== "WITHDRAWN") {
                await tx.transcriptEntry.delete({ where: { id: existing.id } });
            }
            continue;
        }

        await writeTranscriptEntry(tx, {
            existing,
            studentId: profile.id,
            courseId: slot.courseId,
            subject: slot.subject,
            number: slot.number,
            title: slot.title,
            recommendedTermCourseId: slot.recommendedTermCourseId,
            status: slot.status,
            credits: slot.credits,
        });
    }

    // Update standing and start confirmation
    let startConfirmed = profile.startConfirmedAt != null;
    if (confirmStart && !startConfirmed) {
        const recorded = await tx.transcriptEntry.count({
            where: { studentId: profile.id },
        });
        if (recorded > 0) {
            startConfirmed = true;
        }
    }

    await tx.studentProfile.update({
        where: { id: profile.id },
        data: {
            standing,
            ...(startConfirmed && !profile.startConfirmedAt ? { startConfirmedAt: new Date() } : {}),
        },
    });

    return { success: true };
}
