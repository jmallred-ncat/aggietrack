import { academicTermLabel } from "./academic-term";
import type { Prisma, TermSeason } from "./generated/prisma/client";
import { courseStandingBefore } from "./planned-term";
import {
    planRuleViolations,
    toRuleCourse,
    violationsAfterRemoval,
    type PlannedTermSnapshot,
    type RuleCourse,
} from "./plan-rules";

const ruleCourseSelect = {
    id: true,
    subject: true,
    number: true,
    isLab: true,
    offeredIn: true,
    prerequisiteGroups: {
        orderBy: { sortOrder: "asc" as const },
        select: {
            isConcurrent: true,
            note: true,
            options: {
                select: {
                    requires: {
                        select: { id: true, subject: true, number: true, isLab: true },
                    },
                },
            },
        },
    },
} as const;

function snapshotTerm(term: { season: TermSeason; year: number; startsOn: Date }, courses: RuleCourse[]): PlannedTermSnapshot {
    return {
        startsOn: term.startsOn.getTime(),
        season: term.season,
        termLabel: academicTermLabel(term),
        courses,
    };
}

/** Prerequisite, corequisite, and offering sentences for one saved term. */
export async function violationsForTerm(
    db: Prisma.TransactionClient,
    studentId: string,
    plannedTermId: string,
) {
    const plan = await db.plannedTerm.findFirst({
        where: { id: plannedTermId, studentId },
        select: {
            term: { select: { season: true, year: true, startsOn: true } },
            courses: {
                orderBy: { createdAt: "asc" },
                select: { course: { select: ruleCourseSelect } },
            },
        },
    });
    if (!plan) return [];

    const standing = await courseStandingBefore(studentId, plan.term.startsOn, db);
    return planRuleViolations({
        courses: plan.courses.map((row) => toRuleCourse(row.course)),
        season: plan.term.season,
        termLabel: academicTermLabel(plan.term),
        satisfiedCourseIds: standing.satisfied,
        completedCourseIds: standing.completed,
    });
}

/** Sentences a removal would create for this term or a later one. */
export async function violationsForRemoval(
    db: Prisma.TransactionClient,
    studentId: string,
    removedCourseId: string,
) {
    const [plans, entries] = await Promise.all([
        db.plannedTerm.findMany({
            where: { studentId },
            select: {
                term: { select: { season: true, year: true, startsOn: true } },
                courses: {
                    orderBy: { createdAt: "asc" },
                    select: { course: { select: ruleCourseSelect } },
                },
            },
        }),
        db.transcriptEntry.findMany({
            where: {
                studentId,
                courseId: { not: null },
                status: { in: ["IN_PROGRESS", "COMPLETED"] },
            },
            select: { courseId: true, status: true },
        }),
    ]);

    const transcriptSatisfiedIds = new Set<string>();
    const completedCourseIds = new Set<string>();
    for (const entry of entries) {
        if (!entry.courseId) continue;
        transcriptSatisfiedIds.add(entry.courseId);
        if (entry.status === "COMPLETED") completedCourseIds.add(entry.courseId);
    }

    return violationsAfterRemoval({
        removedCourseId,
        terms: plans.map((plan) => snapshotTerm(
            plan.term,
            plan.courses.map((row) => toRuleCourse(row.course)),
        )),
        transcriptSatisfiedIds,
        completedCourseIds,
    });
}
