import type { TermSeason } from "./generated/prisma/client";
import { planRuleViolations, type RuleCourse } from "./plan-rules";

/** Companion ids accepted on one planner save. A longer list is rejected before any row is written. */
export const MAX_COMPANION_IDS = 8;

const couldNotAdd = "That course could not be added.";
const unrelatedCompanion = "That course could not be added with its corequisite.";

export type AddCourseRecord = {
    id: string;
    credits: number;
    isLab: boolean;
    rule: RuleCourse;
};

export type PlanCourseSaveInput = {
    courseId: string;
    /** Raw companion ids from the request, including duplicates. */
    companionIds: readonly string[];
    /** Concurrent courses stored on the primary course. */
    allowedCompanionIds: ReadonlySet<string>;
    courses: readonly AddCourseRecord[];
    season: TermSeason;
    termLabel: string;
    satisfiedCourseIds: ReadonlySet<string>;
    completedCourseIds: ReadonlySet<string>;
    /** Courses already on the term being saved. */
    sameTermCourseIds: ReadonlySet<string>;
    /** Courses on another term. They do not satisfy a pair. */
    otherTermCourseIds: ReadonlySet<string>;
    onTranscriptIds: ReadonlySet<string>;
};

export type PlanCourseSaveDecision =
    | { success: true; creatingIds: string[]; credits: number }
    | { success: false; error: string; violations?: string[] };

/**
 * Decide which courses a planner save may insert.
 * A rejection returns no ids, so the action writes nothing and cannot leave half a pair.
 * Repeated companion ids are saved once. An unrelated companion or a list longer than 8 is refused.
 */
export function planCourseSave(input: PlanCourseSaveInput): PlanCourseSaveDecision {
    if (
        input.companionIds.length > MAX_COMPANION_IDS
        || input.companionIds.some((id) => id.length === 0)
    ) {
        return { success: false, error: couldNotAdd };
    }

    const companionIds = [...new Set(input.companionIds)].filter((id) => id !== input.courseId);
    const byId = new Map(input.courses.map((course) => [course.id, course]));
    const primary = byId.get(input.courseId);
    if (!primary || primary.rule.id !== input.courseId) {
        return { success: false, error: couldNotAdd };
    }
    if (companionIds.some((id) => !input.allowedCompanionIds.has(id))) {
        return { success: false, error: unrelatedCompanion };
    }

    const requested: AddCourseRecord[] = [primary];
    for (const id of companionIds) {
        const course = byId.get(id);
        if (!course || course.rule.id !== id) {
            return { success: false, error: couldNotAdd };
        }
        requested.push(course);
    }

    const counted = requested.filter((course) => !input.otherTermCourseIds.has(course.id));
    const violations = planRuleViolations({
        courses: counted.map((course) => course.rule),
        season: input.season,
        termLabel: input.termLabel,
        satisfiedCourseIds: input.satisfiedCourseIds,
        completedCourseIds: input.completedCourseIds,
        sameTermCourseIds: input.sameTermCourseIds,
    });
    if (violations.length > 0) {
        return {
            success: false,
            error: violations[0] ?? couldNotAdd,
            violations: [...violations],
        };
    }

    if (input.onTranscriptIds.has(input.courseId)) {
        return { success: false, error: "That course is already on your transcript." };
    }
    if (
        input.otherTermCourseIds.has(input.courseId)
        || companionIds.some((id) => input.otherTermCourseIds.has(id))
    ) {
        return { success: false, error: "That course is already on another term plan." };
    }
    if (input.sameTermCourseIds.has(input.courseId)) {
        return { success: false, error: "That course is already on this term plan." };
    }

    const creatingIds = [input.courseId, ...companionIds].filter((id) =>
        !input.onTranscriptIds.has(id) && !input.sameTermCourseIds.has(id),
    );
    const credits = creatingIds.reduce((total, id) => total + (byId.get(id)?.credits ?? 0), 0);
    return { success: true, creatingIds, credits };
}
