import { cache } from "react";
import { academicTermLabel, semesterInSession } from "./academic-term";
import { planCoursesLocked } from "./plan-status";
import type { AcademicTerm, Prisma, TermSeason, TranscriptSource } from "./generated/prisma/client";
import { selectPlannableCourses } from "./plannable-courses";
import { coursePrerequisitesNeedAdvisorReview } from "./prerequisites";
import { prisma } from "./prisma";
import { requireStudentProfile } from "./student";

export { academicTermLabel, courseOfferedInSeason, notOfferedInTermMessage, offeredSeasonsLabel } from "./academic-term";

type PlanningReader = Pick<Prisma.TransactionClient, "transcriptEntry" | "plannedCourse">;

/**
 * Transcript courses that already count, plus courses planned for an earlier term.
 * Completed courses are the ones that can stand in for a lab's corequisite.
 */
export async function courseStandingBefore(
    studentId: string,
    termStartsOn: Date,
    db: PlanningReader = prisma,
) {
    const [entries, planned] = await Promise.all([
        db.transcriptEntry.findMany({
            where: {
                studentId,
                courseId: { not: null },
                status: { in: ["IN_PROGRESS", "COMPLETED"] },
            },
            select: { courseId: true, status: true, source: true },
        }),
        db.plannedCourse.findMany({
            where: {
                plannedTerm: {
                    studentId,
                    term: { startsOn: { lt: termStartsOn } },
                },
            },
            select: { courseId: true },
        }),
    ]);

    const satisfied = new Set<string>();
    const completed = new Set<string>();
    const completedSources = new Map<string, TranscriptSource>();
    for (const entry of entries) {
        if (!entry.courseId) continue;
        satisfied.add(entry.courseId);
        if (entry.status !== "COMPLETED") continue;
        completed.add(entry.courseId);
        const current = completedSources.get(entry.courseId);
        if (!current || current === "TRANSFER") completedSources.set(entry.courseId, entry.source);
    }
    for (const row of planned) satisfied.add(row.courseId);
    return { satisfied, completed, completedSources };
}

/** Completed and in-progress transcript courses, plus courses planned for an earlier term. */
export async function courseIdsSatisfiedBefore(
    studentId: string,
    termStartsOn: Date,
    db: PlanningReader = prisma,
) {
    const { satisfied } = await courseStandingBefore(studentId, termStartsOn, db);
    return satisfied;
}

const courseSelect = {
    id: true,
    subject: true,
    number: true,
    title: true,
    credits: true,
} as const;

type DatedTerm = {
    season: TermSeason;
    year: number;
    startsOn: Date;
    endsOn: Date;
};

const summerSeasons: TermSeason[] = ["SUMMER", "SUMMER_I", "SUMMER_II"];

function contains(term: DatedTerm, now: Date) {
    return term.startsOn <= now && term.endsOn >= now;
}

/**
 * Registration follows the semester in session.
 * Spring opens that year's summer sessions and fall.
 * Fall opens the following spring.
 * After a semester ends, its window stays open for terms that have not started.
 */
export function planningTargets(terms: DatedTerm[], now = new Date()) {
    const semesters = terms.filter((term) => term.season === "FALL" || term.season === "SPRING");
    const current = semesters.find((term) => contains(term, now));
    const anchor = current ?? semesters
        .filter((term) => term.endsOn < now)
        .sort((a, b) => b.endsOn.getTime() - a.endsOn.getTime())[0];

    if (!anchor) {
        return [];
    }

    if (anchor.season === "SPRING") {
        return [
            ...summerSeasons.map((season) => ({ season, year: anchor.year })),
            { season: "FALL" as const, year: anchor.year },
        ];
    }

    return [{ season: "SPRING" as const, year: anchor.year + 1 }];
}

export async function getPlannerAddContext() {
    const profile = await requireStudentProfile();
    const terms = await getPlanningTerms();
    const [plans, transcript] = await Promise.all([
        prisma.plannedTerm.findMany({
            where: { studentId: profile.id },
            select: {
                status: true,
                termId: true,
                term: { select: { season: true, year: true, startsOn: true } },
                courses: { select: { courseId: true } },
            },
        }),
        prisma.transcriptEntry.findMany({
            where: {
                studentId: profile.id,
                courseId: { not: null },
                status: { in: ["IN_PROGRESS", "COMPLETED"] },
            },
            select: { courseId: true, status: true },
        }),
    ]);
    const lockedTermIds = new Set(
        plans.filter((plan) => planCoursesLocked(plan.status)).map((plan) => plan.termId),
    );
    const placements = plans.flatMap((plan) => plan.courses.map((course) => ({
        courseId: course.courseId,
        termLabel: academicTermLabel(plan.term),
        locked: planCoursesLocked(plan.status),
    })));
    const plannedCourseIds = new Set(placements.map((placement) => placement.courseId));
    for (const entry of transcript) {
        if (entry.courseId && !plannedCourseIds.has(entry.courseId)) {
            placements.push({
                courseId: entry.courseId,
                termLabel: "your transcript",
                locked: true,
            });
        }
    }

    return {
        terms: terms.map((term) => ({
            id: term.id,
            label: academicTermLabel(term),
            season: term.season,
            locked: lockedTermIds.has(term.id),
            startsOn: term.startsOn.toISOString(),
        })),
        placements,
        satisfiedCourseIds: transcript.flatMap((entry) => entry.courseId ? [entry.courseId] : []),
        completedCourseIds: transcript.flatMap((entry) =>
            entry.status === "COMPLETED" && entry.courseId ? [entry.courseId] : [],
        ),
        plannedCourses: plans.flatMap((plan) => plan.courses.map((course) => ({
            courseId: course.courseId,
            startsOn: plan.term.startsOn.toISOString(),
        }))),
    };
}

function upcomingPlanningTerms(terms: AcademicTerm[], now: Date) {
    const open = new Set(planningTargets(terms, now).map((target) => `${target.season}:${target.year}`));
    return terms.filter((term) => open.has(`${term.season}:${term.year}`) && term.startsOn > now);
}

export function planningTermsLabel(terms: { season: TermSeason; year: number }[]) {
    return new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(
        terms.map((term) => academicTermLabel(term)),
    );
}

export type PlannerWindow = {
    ask: { termId: string; termLabel: string; nextLabel: string } | null;
    terms: AcademicTerm[];
    declined: { termId: string; termLabel: string } | null;
};

/** Current semester when the student is taking courses. Otherwise the next term, or the next group when that includes summer. */
export const getPlannerWindow = cache(async (): Promise<PlannerWindow> => {
    const now = new Date();
    const profile = await requireStudentProfile();
    const terms = await prisma.academicTerm.findMany({
        orderBy: { startsOn: "asc" },
    });
    const upcoming = upcomingPlanningTerms(terms, now);
    const semester = semesterInSession(terms, now);
    if (!semester) {
        return { ask: null, terms: upcoming, declined: null };
    }

    const currentPlan = await prisma.plannedTerm.findUnique({
        where: {
            studentId_termId: {
                studentId: profile.id,
                termId: semester.id,
            },
        },
        select: { id: true },
    });
    const declined = profile.notTakingTermId === semester.id;
    if (currentPlan) {
        return {
            ask: null,
            terms: [semester, ...upcoming.filter((term) => term.id !== semester.id)],
            declined: null,
        };
    }
    if (declined) {
        return {
            ask: null,
            terms: upcoming,
            declined: { termId: semester.id, termLabel: academicTermLabel(semester) },
        };
    }

    return {
        ask: {
            termId: semester.id,
            termLabel: academicTermLabel(semester),
            nextLabel: planningTermsLabel(upcoming),
        },
        terms: [],
        declined: null,
    };
});

export async function getPlanningTerms() {
    return (await getPlannerWindow()).terms;
}

export async function getStudentPlannedTerm(termId: string) {
    const profile = await requireStudentProfile();
    return prisma.plannedTerm.findUnique({
        where: {
            studentId_termId: {
                studentId: profile.id,
                termId,
            },
        },
        include: {
            courses: {
                include: {
                    course: {
                        select: {
                            ...courseSelect,
                            isLab: true,
                            offeredIn: true,
                            prerequisiteGroups: {
                                orderBy: { sortOrder: "asc" as const },
                                select: {
                                    isConcurrent: true,
                                    fromCatalog: true,
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
                        },
                    },
                },
                orderBy: { createdAt: "asc" },
            },
        },
    });
}

export async function getCatalogCourses() {
    return prisma.course.findMany({
        select: courseSelect,
        orderBy: [{ subject: "asc" }, { number: "asc" }],
    });
}

export async function getPlannableCourses(term: { id: string; season: TermSeason; startsOn: Date }) {
    const profile = await requireStudentProfile();
    const [courses, satisfied, planned] = await Promise.all([
        prisma.course.findMany({
            select: {
                ...courseSelect,
                offeredIn: true,
                prerequisiteGroups: {
                    select: {
                        isConcurrent: true,
                        fromCatalog: true,
                        note: true,
                        options: { select: { requiresId: true } },
                    },
                },
            },
            orderBy: [{ subject: "asc" }, { number: "asc" }],
        }),
        courseIdsSatisfiedBefore(profile.id, term.startsOn),
        prisma.plannedCourse.findMany({
            where: { plannedTerm: { studentId: profile.id } },
            select: { courseId: true, plannedTerm: { select: { termId: true } } },
        }),
    ]);
    const onThisPlan = new Set(
        planned.filter((row) => row.plannedTerm.termId === term.id).map((row) => row.courseId),
    );
    const onAnotherPlan = new Set(
        planned.filter((row) => row.plannedTerm.termId !== term.id).map((row) => row.courseId),
    );

    return selectPlannableCourses(
        courses.map((course) => ({
            ...course,
            prerequisitesNeedAdvisorReview: coursePrerequisitesNeedAdvisorReview(
                course.prerequisiteGroups.map((group) => ({
                    isConcurrent: group.isConcurrent,
                    optionCount: group.options.length,
                    note: group.note,
                })),
            ),
            prerequisiteGroups: course.prerequisiteGroups.map((group) => ({
                isConcurrent: group.isConcurrent,
                fromCatalog: group.fromCatalog,
                optionIds: group.options.map((option) => option.requiresId),
                note: group.note,
            })),
        })),
        term.season,
        satisfied,
        onThisPlan,
        onAnotherPlan,
    ).map(({ id, subject, number, title, credits }) => ({ id, subject, number, title, credits }));
}
