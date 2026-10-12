import { courseOfferedInSeason } from "./academic-term";
import type { TermSeason } from "./generated/prisma/client";
import { coursePrerequisitesSatisfied } from "./prerequisites";

export type PlannableCourse = {
    id: string;
    subject: string;
    number: string;
    title: string;
    credits: number;
    offeredIn: TermSeason[];
    prerequisiteGroups: {
        isConcurrent: boolean;
        optionIds: string[];
    }[];
};

/**
 * Courses this student can add to one term.
 * An empty offeredIn list stays eligible. A corequisite counts when it is already
 * satisfied, already on this plan, or can be added to this same term.
 */
export function selectPlannableCourses(
    courses: PlannableCourse[],
    season: TermSeason,
    satisfiedCourseIds: ReadonlySet<string>,
    onThisPlan: ReadonlySet<string>,
    onAnotherPlan: ReadonlySet<string>,
) {
    const byId = new Map(courses.map((course) => [course.id, course]));

    function canPlan(course: PlannableCourse, stack: ReadonlySet<string>): boolean {
        if (stack.has(course.id)) {
            return true;
        }
        if (satisfiedCourseIds.has(course.id) || onAnotherPlan.has(course.id)) {
            return false;
        }
        if (!courseOfferedInSeason(course.offeredIn, season)) {
            return false;
        }
        if (!coursePrerequisitesSatisfied(course.prerequisiteGroups, satisfiedCourseIds)) {
            return false;
        }

        const next = new Set(stack);
        next.add(course.id);
        return course.prerequisiteGroups.every((group) => {
            if (!group.isConcurrent || group.optionIds.length === 0) {
                return true;
            }
            return group.optionIds.some((id) => {
                if (satisfiedCourseIds.has(id) || onThisPlan.has(id)) {
                    return true;
                }
                const companion = byId.get(id);
                return companion ? canPlan(companion, next) : false;
            });
        });
    }

    return courses.filter((course) => !onThisPlan.has(course.id) && canPlan(course, new Set()));
}
