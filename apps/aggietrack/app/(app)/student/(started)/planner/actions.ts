"use server";

import { semesterInSession } from "@/lib/academic-term";
import type { Prisma } from "@/lib/generated/prisma/client";
import { submissionRequestId } from "@/lib/plan-notes";
import { violationsForRemoval, violationsForTerm } from "@/lib/plan-rule-check";
import { refreshStudentViews } from "@/lib/refresh-student-views";
import { planCourseSave } from "@/lib/plan-add";
import { academicTermLabel, courseStandingBefore, getPlanningTerms } from "@/lib/planned-term";
import {
    claimDraftPlan,
    draftLockedMessage,
    planChangedMessage,
    PlanRejected,
    submitDecision,
    requiresCourseOverride,
    toRuleCourse,
} from "@/lib/plan-rules";
import { personName } from "@/lib/plan-status";
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
import { z } from "zod";

async function unclaimedPlanMessage(tx: Prisma.TransactionClient, id: string, studentId: string, missing: string) {
    const existing = await tx.plannedTerm.findFirst({
        where: { id, studentId },
        select: { status: true },
    });
    if (!existing) return missing;
    if (existing.status !== "DRAFT" && existing.status !== "RETURNED") return draftLockedMessage;
    return planChangedMessage;
}

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

export async function addPlannedCourse(termId: string, courseId: string, companionIds: string[] = [], expectedRevision?: number) {
    const profile = await requireStudentProfile();
    const companions = companionSchema.safeParse(companionIds);
    if (!idSchema.safeParse(termId).success || !idSchema.safeParse(courseId).success || !companions.success) {
        return { success: false as const, error: "That course could not be added." };
    }

    const term = await planningTerm(termId);
    if (!term) {
        return { success: false as const, error: "That course could not be added." };
    }

    const lookupIds = [courseId, ...new Set(companions.data)];
    const [courseRows, standing, plannedRows, transcriptRows, plan] = await Promise.all([
        prisma.course.findMany({
            where: { id: { in: lookupIds } },
            select: {
                id: true,
                subject: true,
                number: true,
                credits: true,
                isLab: true,
                offeredIn: true,
                prerequisiteGroups: {
                    orderBy: { sortOrder: "asc" },
                    select: {
                        isConcurrent: true,
                        fromCatalog: true,
                        note: true,
                        options: {
                            select: {
                                requires: { select: { id: true, subject: true, number: true, isLab: true } },
                            },
                        },
                    },
                },
            },
        }),
        courseStandingBefore(profile.id, term.startsOn),
        prisma.plannedCourse.findMany({
            where: { plannedTerm: { studentId: profile.id } },
            select: { courseId: true, plannedTerm: { select: { termId: true } } },
        }),
        prisma.transcriptEntry.findMany({
            where: {
                studentId: profile.id,
                courseId: { in: lookupIds },
                status: { in: ["IN_PROGRESS", "COMPLETED"] },
            },
            select: { courseId: true },
        }),
        prisma.plannedTerm.findUnique({
            where: { studentId_termId: { studentId: profile.id, termId } },
            select: { id: true, revision: true },
        }),
    ]);

    const byId = new Map(courseRows.map((item) => [item.id, item]));
    const primary = byId.get(courseId);
    const allowedCompanionIds = new Set(
        (primary?.prerequisiteGroups ?? [])
            .filter((group) => group.isConcurrent)
            .flatMap((group) => group.options.map((option) => option.requires.id)),
    );
    const sameTermCourseIds = new Set<string>();
    const otherTermCourseIds = new Set<string>();
    for (const row of plannedRows) {
        if (row.plannedTerm.termId === termId) sameTermCourseIds.add(row.courseId);
        else otherTermCourseIds.add(row.courseId);
    }

    const rules = new Map(courseRows.map((item) => [item.id, toRuleCourse(item)]));
    const decision = planCourseSave({
        courseId,
        companionIds: companions.data,
        allowedCompanionIds,
        courses: courseRows.map((item) => ({
            id: item.id,
            credits: item.credits,
            isLab: item.isLab,
            rule: rules.get(item.id)!,
        })),
        season: term.season,
        termLabel: academicTermLabel(term),
        satisfiedCourseIds: standing.satisfied,
        completedCourseIds: standing.completed,
        sameTermCourseIds,
        otherTermCourseIds,
        onTranscriptIds: new Set(transcriptRows.flatMap((row) => row.courseId ? [row.courseId] : [])),
    });
    if (!decision.success) {
        return {
            success: false as const,
            error: decision.error,
            ...(decision.violations ? { violations: decision.violations } : {}),
        };
    }

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
                {
                    id: plannedTerm.id,
                    studentId: profile.id,
                    ...(typeof expectedRevision === "number"
                        ? { revision: expectedRevision }
                        : plan ? { revision: plan.revision } : {}),
                },
                { updatedAt: new Date() },
            );
            if (!claimed) {
                return { failed: await unclaimedPlanMessage(tx, plannedTerm.id, profile.id, "That course could not be added.") };
            }
            const added = await writePlannedCourses(
                decision.creatingIds,
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
            const placedIds = new Set<string>([...sameTermCourseIds, ...decision.creatingIds]);
            return {
                failed: null,
                revision: (typeof expectedRevision === "number" ? expectedRevision : plan?.revision ?? 0) + 1,
                planId: plannedTerm.id,
                courses: added.map((row) => {
                    const rule = rules.get(row.id);
                    return {
                        ...row,
                        requiresCourseOverride: rule
                            ? requiresCourseOverride(rule, placedIds, standing.completedSources)
                            : false,
                    };
                }),
            };
        }, planTransactionOptions());
        if (!saved || saved.failed) {
            return { success: false as const, error: saved?.failed ?? draftLockedMessage };
        }

        refreshPlans();
        return {
            success: true as const,
            planId: saved.planId,
            revision: saved.revision,
            addedCourseIds: decision.creatingIds,
            courses: saved.courses,
        };
    } catch (error) {
        const failure = caughtPlannerFailure(error);
        if (failure) return failure;
        throw error;
    }
}

export async function removePlannedCourse(plannedCourseId: string, expectedRevision?: number) {
    const profile = await requireStudentProfile();
    if (!idSchema.safeParse(plannedCourseId).success) {
        return { success: false as const, error: "That course could not be removed." };
    }

    const row = await prisma.plannedCourse.findFirst({
        where: {
            id: plannedCourseId,
            plannedTerm: { studentId: profile.id },
        },
        select: { id: true, courseId: true, plannedTermId: true, plannedTerm: { select: { revision: true } } },
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
                {
                    id: row.plannedTermId,
                    studentId: profile.id,
                    revision: typeof expectedRevision === "number" ? expectedRevision : row.plannedTerm.revision,
                },
                { updatedAt: new Date() },
            );
            if (!claimed) {
                return { failed: await unclaimedPlanMessage(tx, row.plannedTermId, profile.id, "That course could not be removed.") };
            }
            if (fault?.mode === "fail") throw new PlannerWriteFailed();
            const violations = await violationsForRemoval(tx, profile.id, row.courseId);
            await tx.plannedCourse.delete({ where: { id: row.id } });
            return {
                failed: null,
                violations,
                revision: (typeof expectedRevision === "number" ? expectedRevision : row.plannedTerm.revision) + 1,
            };
        }, planTransactionOptions());
        if (!removed || removed.failed) {
            return { success: false as const, error: removed?.failed ?? draftLockedMessage };
        }

        refreshPlans();
        return { success: true as const, violations: removed.violations, revision: removed.revision };
    } catch (error) {
        const failure = caughtPlannerFailure(error);
        if (failure) return failure;
        throw error;
    }
}

export async function submitPlannedTerm(plannedTermId: string, expectedRevision?: number) {
    const profile = await requireStudentProfile();
    if (!idSchema.safeParse(plannedTermId).success) {
        return { success: false as const, error: "That term plan could not be submitted." };
    }
    const author = await prisma.user.findUnique({
        where: { id: profile.userId },
        select: { firstName: true, lastName: true },
    });

    try {
        const outcome = await prisma.$transaction(async (tx) => {
            const claimed = await claimDraftPlan(
                (args) => tx.plannedTerm.updateMany(args),
                {
                    id: plannedTermId,
                    studentId: profile.id,
                    ...(typeof expectedRevision === "number" ? { revision: expectedRevision } : {}),
                },
                { status: "SUBMITTED", submittedAt: new Date(), reviewedAt: null },
            );
            if (!claimed) {
                return {
                    success: false as const,
                    error: await unclaimedPlanMessage(tx, plannedTermId, profile.id, "That term plan could not be submitted."),
                };
            }

            const plan = await tx.plannedTerm.findFirst({
                where: { id: plannedTermId, studentId: profile.id },
                select: { revision: true, _count: { select: { courses: true } } },
            });
            const courseCount = plan?._count.courses ?? 0;
            const violations = courseCount === 0
                ? []
                : await violationsForTerm(tx, profile.id, plannedTermId);
            const decision = submitDecision({ courseCount, violations });
            if (!decision.success) throw new PlanRejected(decision);
            const revision = plan?.revision ?? 0;
            await tx.planNote.create({
                data: {
                    plannedTermId,
                    authorId: profile.userId,
                    authorName: personName(author),
                    authorRole: "STUDENT",
                    kind: "SUBMISSION",
                    body: "",
                    requestId: submissionRequestId(plannedTermId, revision),
                },
            });
            return { success: true as const, revision };
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
        select: { id: true },
    });
    if (!plan) {
        return { success: false as const, error: "This term plan is not ready to record." };
    }

    try {
        await prisma.$transaction(async (tx) => {
            await tx.plannedTerm.update({
                where: { id: plan.id },
                data: { registeredAt: new Date(), revision: { increment: 1 } },
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
