"use server";

import { semesterInSession } from "@/lib/academic-term";
import { violationsForRemoval, violationsForTerm } from "@/lib/plan-rule-check";
import { refreshStudentViews } from "@/lib/refresh-student-views";
import { academicTermLabel, courseIdsSatisfiedBefore, getPlanningTerms } from "@/lib/planned-term";
import {
    claimDraftPlan,
    draftLockedMessage,
    PlanRejected,
    planRuleViolations,
    submitDecision,
    toRuleCourse,
} from "@/lib/plan-rules";
import {
    planTransactionOptions,
    PlannerWriteFailed,
    plannerFailure,
    takePlannerWriteFault,
    waitForPlannerFault,
    writePlannedCourses,
} from "@/lib/planner-write";
import { prisma } from "@/lib/prisma";
import { requireStudentProfile } from "@/lib/student";
import { recordCoursesInProgress } from "@/lib/transcript";
import { z } from "zod";

const idSchema = z.string().min(1);

function refreshPlans() {
    // The dashboard lives on the /student layout. Refresh it with the nested pages.
    refreshStudentViews();
}

async function semesterInSessionNow() {
    const terms = await prisma.academicTerm.findMany();
    return semesterInSession(terms);
}

export async function planCurrentSemester(termId: string) {
    const profile = await requireStudentProfile();
    const semester = await semesterInSessionNow();
    if (!idSchema.safeParse(termId).success || !semester || semester.id !== termId) {
        return { success: false as const, error: "That semester is not in session." };
    }

    await prisma.$transaction([
        prisma.plannedTerm.upsert({
            where: { studentId_termId: { studentId: profile.id, termId } },
            create: { studentId: profile.id, termId, status: "DRAFT" },
            update: {},
        }),
        prisma.studentProfile.update({
            where: { id: profile.id },
            data: { notTakingTermId: null },
        }),
    ]);
    refreshPlans();
    return { success: true as const };
}

export async function declineCurrentSemester(termId: string) {
    const profile = await requireStudentProfile();
    const semester = await semesterInSessionNow();
    if (!idSchema.safeParse(termId).success || !semester || semester.id !== termId) {
        return { success: false as const, error: "That semester is not in session." };
    }

    await prisma.studentProfile.update({
        where: { id: profile.id },
        data: { notTakingTermId: termId },
    });
    refreshPlans();
    return { success: true as const };
}

async function planningTerm(termId: string) {
    const terms = await getPlanningTerms();
    return terms.find((term) => term.id === termId) ?? null;
}

async function nextPlannerWriteFault(studentId: string) {
    return takePlannerWriteFault(process.env.VERCEL_ENV, studentId, {
        read: async (id) => {
            const row = await prisma.studentProfile.findUnique({
                where: { id },
                select: { plannerWriteFault: true },
            });
            return row?.plannerWriteFault ?? null;
        },
        clear: async (id, raw) => {
            const cleared = await prisma.studentProfile.updateMany({
                where: { id, plannerWriteFault: raw },
                data: { plannerWriteFault: null },
            });
            return cleared.count === 1;
        },
    });
}

function caughtPlannerFailure(error: unknown) {
    if (error instanceof PlanRejected) return error.result;
    return plannerFailure(error);
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
            isLab: true,
            offeredIn: true,
            prerequisiteGroups: {
                orderBy: { sortOrder: "asc" },
                select: {
                    isConcurrent: true,
                    note: true,
                    options: {
                        select: {
                            requires: { select: { id: true, subject: true, number: true, isLab: true } },
                        },
                    },
                },
            },
        },
    });
    const byId = new Map(courses.map((item) => [item.id, item]));
    const termLabel = academicTermLabel(term);
    const adding: ReturnType<typeof toRuleCourse>[] = [];
    for (const id of [courseId, ...extras]) {
        const item = byId.get(id);
        if (!item) {
            return { success: false as const, error: "That course could not be added." };
        }
        adding.push(toRuleCourse(item));
    }
    const satisfied = await courseIdsSatisfiedBefore(profile.id, term.startsOn);
    const violations = planRuleViolations({
        courses: adding,
        season: term.season,
        termLabel,
        satisfiedCourseIds: satisfied,
        completedCourseIds: new Set(),
        corequisites: false,
    });
    if (violations.length > 0) {
        return { success: false as const, error: violations.join(" "), violations };
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
            select: { id: true },
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

    const creating = [courseId, ...extras].filter((id) => !onTranscript.has(id) && !alreadyOnPlan.has(id));
    const fault = await nextPlannerWriteFault(profile.id);
    await waitForPlannerFault(fault);
    try {
        const saved = await prisma.$transaction(async (tx) => {
            const plannedTerm = plan ?? await tx.plannedTerm.create({
                data: { studentId: profile.id, termId },
                select: { id: true },
            });
            const claimed = await claimDraftPlan(
                (args) => tx.plannedTerm.updateMany(args),
                { id: plannedTerm.id, studentId: profile.id },
                { updatedAt: new Date() },
            );
            if (!claimed) return null;
            const added = await writePlannedCourses(
                creating,
                (id) => byId.get(id)?.isLab === true,
                fault,
                async (id) => {
                    const row = await tx.plannedCourse.create({
                        data: { plannedTermId: plannedTerm.id, courseId: id },
                        select: {
                            id: true,
                            courseId: true,
                            course: {
                                select: { subject: true, number: true, title: true, credits: true },
                            },
                        },
                    });
                    return {
                        plannedCourseId: row.id,
                        id: row.courseId,
                        subject: row.course.subject,
                        number: row.course.number,
                        title: row.course.title,
                        credits: row.course.credits,
                    };
                },
            );
            return { planId: plannedTerm.id, courses: added };
        }, planTransactionOptions());
        if (!saved) {
            return { success: false as const, error: draftLockedMessage };
        }

        refreshPlans();
        return {
            success: true as const,
            planId: saved.planId,
            addedCourseIds: creating,
            courses: saved.courses,
        };
    } catch (error) {
        const failure = caughtPlannerFailure(error);
        if (failure) return failure;
        throw error;
    }
}

export async function removePlannedCourse(plannedCourseId: string) {
    const profile = await requireStudentProfile();
    if (!idSchema.safeParse(plannedCourseId).success) {
        return { success: false as const, error: "That course could not be removed." };
    }

    const row = await prisma.plannedCourse.findFirst({
        where: {
            id: plannedCourseId,
            plannedTerm: { studentId: profile.id },
        },
        select: { id: true, courseId: true, plannedTermId: true },
    });
    if (!row) {
        return { success: false as const, error: "That course could not be removed." };
    }

    const fault = await nextPlannerWriteFault(profile.id);
    await waitForPlannerFault(fault);
    try {
        const removed = await prisma.$transaction(async (tx) => {
            const claimed = await claimDraftPlan(
                (args) => tx.plannedTerm.updateMany(args),
                { id: row.plannedTermId, studentId: profile.id },
                { updatedAt: new Date() },
            );
            if (!claimed) return null;
            if (fault?.mode === "fail") throw new PlannerWriteFailed();
            const violations = await violationsForRemoval(tx, profile.id, row.courseId);
            await tx.plannedCourse.delete({ where: { id: row.id } });
            return { violations };
        }, planTransactionOptions());
        if (!removed) {
            return { success: false as const, error: draftLockedMessage };
        }

        refreshPlans();
        return { success: true as const, violations: removed.violations };
    } catch (error) {
        const failure = caughtPlannerFailure(error);
        if (failure) return failure;
        throw error;
    }
}

export async function submitPlannedTerm(plannedTermId: string) {
    const profile = await requireStudentProfile();
    if (!idSchema.safeParse(plannedTermId).success) {
        return { success: false as const, error: "That term plan could not be submitted." };
    }

    try {
        const outcome = await prisma.$transaction(async (tx) => {
            const claimed = await claimDraftPlan(
                (args) => tx.plannedTerm.updateMany(args),
                { id: plannedTermId, studentId: profile.id },
                { status: "SUBMITTED", submittedAt: new Date() },
            );
            if (!claimed) {
                const existing = await tx.plannedTerm.findFirst({
                    where: { id: plannedTermId, studentId: profile.id },
                    select: { id: true },
                });
                return {
                    success: false as const,
                    error: existing ? draftLockedMessage : "That term plan could not be submitted.",
                };
            }

            const plan = await tx.plannedTerm.findFirst({
                where: { id: plannedTermId, studentId: profile.id },
                select: { _count: { select: { courses: true } } },
            });
            const courseCount = plan?._count.courses ?? 0;
            const violations = courseCount === 0
                ? []
                : await violationsForTerm(tx, profile.id, plannedTermId);
            const decision = submitDecision({ courseCount, violations });
            if (!decision.success) throw new PlanRejected(decision);
            return { success: true as const };
        }, planTransactionOptions());
        if (outcome.success) refreshPlans();
        return outcome;
    } catch (error) {
        const failure = caughtPlannerFailure(error);
        if (failure) return failure;
        throw error;
    }
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

    try {
        await prisma.$transaction(async (tx) => {
            await recordCoursesInProgress(tx, {
                studentId: profile.id,
                termId: plan.termId,
                courses: plan.courses.map((row) => ({
                    courseId: row.courseId,
                    credits: row.course.credits,
                })),
            });

            await tx.plannedTerm.update({
                where: { id: plan.id },
                data: { registeredAt: new Date() },
            });
        }, planTransactionOptions());
    } catch (error) {
        const failure = caughtPlannerFailure(error);
        if (failure) return failure;
        throw error;
    }

    refreshPlans();
    return { success: true as const };
}
