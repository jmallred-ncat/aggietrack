export type PlanCourseRef = {
    plannedCourseId: string;
    id: string;
    credits: number;
};

export type TermCourseList<T extends PlanCourseRef = PlanCourseRef> = {
    id: string | null;
    courses: T[];
};

/** Routes that should show a planner save the next time they are opened. */
export const plannerMutationPaths = [
    "/student/planner",
    "/student/courses",
    "/student/progress",
    "/student",
    "/advisor",
    "/advisor/students",
    "/advisor/plans",
] as const;

export type StudentViewRefreshTarget = {
    path: string;
    type?: "page" | "layout";
};

/**
 * Pages a transcript save must refresh.
 * Same routes as a planner save, plus the student layout that holds the dashboard.
 */
export function studentViewRefreshTargets(): StudentViewRefreshTarget[] {
    return [
        ...plannerMutationPaths.map((path) => ({ path })),
        { path: "/student", type: "layout" },
    ];
}

export function termCreditTotal(courses: readonly { credits: number }[]) {
    return courses.reduce((total, course) => total + course.credits, 0);
}

/** "1 credit" or "12 credits". Zero stays plural so an empty term still has a total. */
export function termCreditLabel(credits: number) {
    return `${credits} ${credits === 1 ? "credit" : "credits"}`;
}

/** Append courses that just saved. A course already on the term is left as it is. */
export function applyAddedCourses<T extends PlanCourseRef>(
    plan: TermCourseList<T> | null,
    addition: { planId: string; courses: readonly T[] },
): TermCourseList<T> {
    const current = plan?.courses ?? [];
    const seen = new Set(current.map((course) => course.id));
    const courses: T[] = [...current];
    for (const course of addition.courses) {
        if (seen.has(course.id)) {
            continue;
        }
        seen.add(course.id);
        courses.push(course);
    }
    return {
        id: plan?.id ?? addition.planId,
        courses,
    };
}

export function applyRemovedCourse<T extends PlanCourseRef>(
    plan: TermCourseList<T>,
    plannedCourseId: string,
): TermCourseList<T> {
    return {
        id: plan.id,
        courses: plan.courses.filter((course) => course.plannedCourseId !== plannedCourseId),
    };
}

/**
 * Move one saved row from one term to another.
 * The source term loses the course and the destination gains it, in the same step.
 */
export function applyMovedCourse<T extends PlanCourseRef>(
    plans: Readonly<Record<string, TermCourseList<T>>>,
    move: {
        fromTermId: string;
        toTermId: string;
        toPlanId: string;
        plannedCourseId: string;
    },
): Record<string, TermCourseList<T>> {
    if (move.fromTermId === move.toTermId) {
        return { ...plans };
    }
    const source = plans[move.fromTermId];
    if (!source) {
        return { ...plans };
    }
    const course = source.courses.find((item) => item.plannedCourseId === move.plannedCourseId);
    if (!course) {
        return { ...plans };
    }
    const destination = plans[move.toTermId] ?? { id: move.toPlanId, courses: [] };
    return {
        ...plans,
        [move.fromTermId]: applyRemovedCourse(source, move.plannedCourseId),
        [move.toTermId]: applyAddedCourses(destination, {
            planId: destination.id ?? move.toPlanId,
            courses: [course],
        }),
    };
}
