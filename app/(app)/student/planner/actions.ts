"use server";

import { academicTermLabel, courseIdsSatisfiedBefore, courseOfferedInSeason, getPlanningTerms, notOfferedInTermMessage } from "@/lib/planned-term";
import { coursePrerequisitesSatisfied } from "@/lib/prerequisites";
import { prisma } from "@/lib/prisma";
import { requireStudentProfile } from "@/lib/student";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const idSchema = z.string().min(1);

function refreshPlans() {
    revalidatePath("/student/planner");
    revalidatePath("/student/courses");
    revalidatePath("/student/progress");
    revalidatePath("/advisor/plans");
}

async function planningTerm(termId: string) {
    const terms = await getPlanningTerms();
    return terms.find((term) => term.id === termId) ?? null;
}

const companionSchema = z.array(z.string().min(1)).max(8);

export async function addPlannedCourse(termId: string, courseId: string, companionIds: string[] = []) {
    const profile = await requireStudentProfile();
    const companions = companionSchema.safeParse(companionIds);
    if (!idSchema.safeParse(termId).success || !idSchema.safeParse(courseId).success || !companions.success) {
        return { success: false as const, error: "That course could not be added." };
    }

    const term = await planningTerm(termId);
    const course = await prisma.course.findUnique({
        where: { id: courseId },
        select: {
            id: true,
            prerequisiteGroups: {
                select: {
                    isConcurrent: true,
                    options: { select: { requiresId: true } },
                },
            },
        },
    });
    if (!term || !course) {
        return { success: false as const, error: "That course could not be added." };
    }

    const allowedCompanions = new Set(
        course.prerequisiteGroups
            .filter((group) => group.isConcurrent)
            .flatMap((group) => group.options.map((option) => option.requiresId)),
    );
    const extras = [...new Set(companions.data)].filter((id) => id !== courseId);
    if (extras.some((id) => !allowedCompanions.has(id))) {
        return { success: false as const, error: "That course could not be added with its corequisite." };
    }

    const courses = await prisma.course.findMany({
        where: { id: { in: [courseId, ...extras] } },
        select: {
            id: true,
            subject: true,
            number: true,
            offeredIn: true,
            prerequisiteGroups: {
                select: {
                    isConcurrent: true,
                    options: { select: { requiresId: true } },
                },
            },
        },
    });
    const byId = new Map(courses.map((item) => [item.id, item]));
    const termLabel = academicTermLabel(term);
    const satisfied = await courseIdsSatisfiedBefore(profile.id, term.startsOn);
    for (const id of [courseId, ...extras]) {
        const item = byId.get(id);
        if (!item) {
            return { success: false as const, error: "That course could not be added." };
        }
        if (!courseOfferedInSeason(item.offeredIn, term.season)) {
            return {
                success: false as const,
                error: notOfferedInTermMessage(`${item.subject} ${item.number}`, termLabel, item.offeredIn),
            };
        }
        const prerequisitesMet = coursePrerequisitesSatisfied(
            item.prerequisiteGroups.map((group) => ({
                isConcurrent: group.isConcurrent,
                optionIds: group.options.map((option) => option.requiresId),
            })),
            satisfied,
        );
        if (!prerequisitesMet) {
            const code = `${item.subject} ${item.number}`;
            return {
                success: false as const,
                error: id === courseId
                    ? "Complete this course's prerequisites before adding it to your plan."
                    : `Complete the prerequisites for ${code} before adding it with this course.`,
            };
        }
    }

    const [transcriptRows, otherPlanRows, plan, onThisPlan] = await Promise.all([
        prisma.transcriptEntry.findMany({
            where: {
                studentId: profile.id,
                courseId: { in: [courseId, ...extras] },
                status: { in: ["IN_PROGRESS", "COMPLETED"] },
            },
            select: { courseId: true },
        }),
        prisma.plannedCourse.findMany({
            where: {
                courseId: { in: [courseId, ...extras] },
                plannedTerm: {
                    studentId: profile.id,
                    termId: { not: termId },
                },
            },
            select: { courseId: true },
        }),
        prisma.plannedTerm.findUnique({
            where: { studentId_termId: { studentId: profile.id, termId } },
            select: { id: true, status: true },
        }),
        prisma.plannedCourse.findMany({
            where: {
                courseId: { in: [courseId, ...extras] },
                plannedTerm: { studentId: profile.id, termId },
            },
            select: { courseId: true },
        }),
    ]);

    const onTranscript = new Set(transcriptRows.flatMap((row) => row.courseId ? [row.courseId] : []));
    const onAnotherPlan = new Set(otherPlanRows.map((row) => row.courseId));
    const alreadyOnPlan = new Set(onThisPlan.map((row) => row.courseId));
    if (onTranscript.has(courseId)) {
        return { success: false as const, error: "That course is already on your transcript." };
    }
    if (onAnotherPlan.has(courseId) || extras.some((id) => onAnotherPlan.has(id))) {
        return { success: false as const, error: "That course is already on another term plan." };
    }
    if (alreadyOnPlan.has(courseId)) {
        return { success: false as const, error: "That course is already on this term plan." };
    }
    if (plan && plan.status !== "DRAFT") {
        return { success: false as const, error: "This term plan has already been submitted." };
    }

    const creating = [courseId, ...extras].filter((id) => !onTranscript.has(id) && !alreadyOnPlan.has(id));
    await prisma.$transaction(async (tx) => {
        const plannedTerm = plan ?? await tx.plannedTerm.create({
            data: { studentId: profile.id, termId },
            select: { id: true },
        });
        for (const id of creating) {
            await tx.plannedCourse.create({
                data: { plannedTermId: plannedTerm.id, courseId: id },
            });
        }
    });

    refreshPlans();
    return { success: true as const, addedCourseIds: creating };
}

export async function removePlannedCourse(plannedCourseId: string) {
    const profile = await requireStudentProfile();
    if (!idSchema.safeParse(plannedCourseId).success) {
        return { success: false as const, error: "That course could not be removed." };
    }

    const row = await prisma.plannedCourse.findFirst({
        where: {
            id: plannedCourseId,
            plannedTerm: { studentId: profile.id, status: "DRAFT" },
        },
        select: { id: true, plannedTermId: true },
    });
    if (!row) {
        return { success: false as const, error: "That course could not be removed." };
    }

    await prisma.plannedCourse.delete({ where: { id: row.id } });
    refreshPlans();
    return { success: true as const };
}

export async function submitPlannedTerm(plannedTermId: string) {
    const profile = await requireStudentProfile();
    const plan = await prisma.plannedTerm.findFirst({
        where: { id: plannedTermId, studentId: profile.id, status: "DRAFT" },
        select: { id: true, _count: { select: { courses: true } } },
    });
    if (!plan || plan._count.courses === 0) {
        return { success: false as const, error: "Add at least one course before submitting." };
    }

    await prisma.plannedTerm.update({
        where: { id: plan.id },
        data: { status: "SUBMITTED", submittedAt: new Date() },
    });
    refreshPlans();
    return { success: true as const };
}

export async function markPlannedTermRegistered(plannedTermId: string) {
    const profile = await requireStudentProfile();
    const plan = await prisma.plannedTerm.findFirst({
        where: {
            id: plannedTermId,
            studentId: profile.id,
            status: "APPROVED",
            registeredAt: null,
            registrationPin: { not: null },
        },
        include: {
            courses: { include: { course: { select: { credits: true } } } },
        },
    });
    if (!plan) {
        return { success: false as const, error: "This term plan is not ready to record." };
    }

    await prisma.$transaction(async (tx) => {
        const existing = await tx.transcriptEntry.findMany({
            where: {
                studentId: profile.id,
                courseId: { in: plan.courses.map((row) => row.courseId) },
                status: { in: ["IN_PROGRESS", "COMPLETED"] },
            },
            select: { courseId: true },
        });
        const taken = new Set(existing.map((entry) => entry.courseId));
        const additions = plan.courses.filter((row) => !taken.has(row.courseId));

        if (additions.length > 0) {
            await tx.transcriptEntry.createMany({
                data: additions.map((row) => ({
                    studentId: profile.id,
                    courseId: row.courseId,
                    termId: plan.termId,
                    credits: row.course.credits,
                    status: "IN_PROGRESS" as const,
                    source: "NCAT" as const,
                    grade: null,
                })),
            });
        }

        await tx.plannedTerm.update({
            where: { id: plan.id },
            data: { registeredAt: new Date() },
        });
    });

    refreshPlans();
    return { success: true as const };
}
