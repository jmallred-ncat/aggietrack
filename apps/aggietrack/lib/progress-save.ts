import { courseCodeLabel, parseCourseCode } from "@/lib/course-code";
import { Prisma, RequirementSlot, type Grade, type TranscriptStatus, type StudentProfile } from "@/lib/generated/prisma/client";
import { transcriptFieldsForProgressStatus, type ProgressStatus } from "@/lib/transcript";

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

type SlotInput = SaveProgressInput["slots"][number];

function courseIdentity(entry: { courseId: string | null; subject: string | null; number: string | null }) {
    if (entry.courseId) {
        return `course:${entry.courseId}`;
    }
    if (entry.subject && entry.number) {
        return `code:${courseCodeLabel(entry.subject, entry.number)}`;
    }
    return null;
}

async function writeTranscriptEntry(
    tx: Prisma.TransactionClient,
    input: {
        existing: { id: string; courseId: string | null; subject: string | null; number: string | null; grade: Grade | null; status: TranscriptStatus } | null;
        studentId: string;
        courseId: string | null;
        subject: string | null;
        number: string | null;
        title: string | null;
        recommendedTermCourseId: string | null;
        status: ProgressStatus | null;
        credits: number;
    },
) {
    if (!input.status) {
        // Don't delete FAILED or WITHDRAWN entries when saving the form
        // They stay on the row (not marked complete) and should persist
        if (input.existing && input.existing.status !== "IN_PROGRESS" && 
            input.existing.status !== "FAILED" && input.existing.status !== "WITHDRAWN") {
            await tx.transcriptEntry.delete({ where: { id: input.existing.id } });
        }
        return;
    }

    const fields = transcriptFieldsForProgressStatus(input.status);
    const sameCourse = input.existing != null && courseIdentity(input.existing) === courseIdentity(input);
    const grade = sameCourse && input.status === "complete" && input.existing?.grade && input.existing.grade !== "TR"
        ? input.existing.grade
        : fields.grade;
    
    // Preserve FAILED/WITHDRAWN status when saving the form (don't overwrite to COMPLETED)
    const status = sameCourse && input.status === "complete" && input.existing?.status && 
        (input.existing.status === "FAILED" || input.existing.status === "WITHDRAWN")
        ? input.existing.status
        : fields.status;
    
    const data = {
        courseId: input.courseId,
        subject: input.courseId ? null : input.subject,
        number: input.courseId ? null : input.number,
        title: input.courseId ? null : input.title,
        status,
        source: fields.source,
        grade,
        credits: input.credits,
        recommendedTermCourseId: input.recommendedTermCourseId,
    };

    if (input.existing) {
        await tx.transcriptEntry.update({
            where: { id: input.existing.id },
            data,
        });
        return;
    }

    await tx.transcriptEntry.create({
        data: {
            studentId: input.studentId,
            ...data,
        },
    });
}

async function resolveSlotCourse(
    tx: Prisma.TransactionClient,
    slot: SlotInput,
    group: { slot: RequirementSlot; minNumber: number | null },
    eligible: Array<{ id: string; credits: number }>,
): Promise<
    | { ok: true; courseId: string | null; subject: string | null; number: string | null; title: string | null; credits: number }
    | { ok: false; error: string }
> {
    const minimum = group.minNumber ?? 100;
    const hasCatalogCourse = Boolean(slot.courseId);
    const hasEnteredCourse = Boolean(slot.subject || slot.number || slot.title);

    if (hasCatalogCourse && hasEnteredCourse) {
        return { ok: false, error: "Those progress choices could not be saved." };
    }

    if (!slot.status || (!hasCatalogCourse && !hasEnteredCourse)) {
        return { ok: true, courseId: null, subject: null, number: null, title: null, credits: 0 };
    }

    if (slot.courseId) {
        const course = eligible.find((option) => option.id === slot.courseId);
        if (!course) {
            return { ok: false, error: "That course does not satisfy this requirement." };
        }
        return { ok: true, courseId: slot.courseId, subject: null, number: null, title: null, credits: course.credits };
    }

    if (group.slot !== RequirementSlot.FREE_ELECTIVE) {
        return { ok: false, error: "That course does not satisfy this requirement." };
    }

    const parsed = parseCourseCode(`${slot.subject ?? ""} ${slot.number ?? ""}`);
    if (!parsed || !slot.title?.trim() || slot.credits == null) {
        return { ok: false, error: "Enter a course code, title, and credit hours." };
    }

    const courseNumber = Number.parseInt(parsed.number, 10);
    if (courseNumber < minimum) {
        return { ok: false, error: `Free electives must be numbered ${minimum} or above.` };
    }

    const catalogCourse = await tx.course.findUnique({
        where: { subject_number: { subject: parsed.subject, number: parsed.number } },
        select: { id: true, credits: true },
    });

    if (catalogCourse) {
        const eligibleCourse = eligible.find((option) => option.id === catalogCourse.id);
        if (!eligibleCourse) {
            return { ok: false, error: "That course is already on your plan." };
        }
        return {
            ok: true,
            courseId: catalogCourse.id,
            subject: null,
            number: null,
            title: null,
            credits: eligibleCourse.credits,
        };
    }

    return {
        ok: true,
        courseId: null,
        subject: parsed.subject,
        number: parsed.number,
        title: slot.title.trim(),
        credits: slot.credits,
    };
}

/**
 * Core progress save logic moved from saveTranscriptProgress.
 * This is the exact validated and verified save logic from commit 73c343f.
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

    const resolvedSlots: Array<{
        recommendedTermCourseId: string;
        status: ProgressStatus | null;
        courseId: string | null;
        subject: string | null;
        number: string | null;
        title: string | null;
        credits: number;
    }> = [];

    for (const slot of slots) {
        const row = groupBySlot.get(slot.recommendedTermCourseId);
        if (!row?.requirementGroup) {
            return { success: false, error: "A course on this plan could not be updated." };
        }

        const eligible = (slotCourses[row.requirementGroupId!] ?? [])
            .filter((course) => !row.requiresLab || course.lab);
        const resolved = await resolveSlotCourse(tx, slot, row.requirementGroup, eligible);
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

    // Write transcript entries
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
                !(existing.status === "IN_PROGRESS" && !slot.status) &&
                !(existing.status === "FAILED") &&
                !(existing.status === "WITHDRAWN")) {
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

    // Final check: if confirmStart was requested but nothing was recorded, return error
    // Returning from inside the transaction commits. However, no writes have occurred in this case.
    if (confirmStart && !startConfirmed) {
        return { success: false, error: "Mark the courses you have completed, or say you have no prior coursework." };
    }

    return { success: true };
}
