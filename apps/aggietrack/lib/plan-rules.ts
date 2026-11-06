import { courseOfferedInSeason, notOfferedInTermMessage } from "./academic-term";
import type { TermSeason } from "./generated/prisma/client";
import { advisorReviewViolation, coursePrerequisitesNeedAdvisorReview, coursePrerequisitesSatisfied } from "./prerequisites";

export type RuleOption = {
    id: string;
    code: string;
    isLab: boolean;
};

export type RuleGroup = {
    isConcurrent: boolean;
    /** True when the catalog corequisite text lists this direction. */
    fromCatalog: boolean;
    options: RuleOption[];
    /** Catalog sentence kept beside the course options, such as a placement score. */
    note?: string | null;
};

export type RuleCourse = {
    id: string;
    code: string;
    isLab: boolean;
    offeredIn: readonly TermSeason[];
    groups: RuleGroup[];
    /** The catalog text could not be turned into a course, score, or standing rule. */
    prerequisitesNeedAdvisorReview?: boolean;
};

export type PlanCheck = {
    courses: readonly RuleCourse[];
    season: TermSeason;
    termLabel: string;
    /** Completed and in-progress transcript courses, plus earlier planned courses. */
    satisfiedCourseIds: ReadonlySet<string>;
    /** Completed transcript courses. A finished lecture can stand in for its lab. */
    completedCourseIds: ReadonlySet<string>;
    /**
     * Courses already saved on this same term. They satisfy a pair
     * without being checked again. Submit sends the whole term in `courses`.
     */
    sameTermCourseIds?: ReadonlySet<string>;
    /**
     * Save, submit, and approval leave this on.
     * Only a direction written in the catalog is required. A completed companion
     * can stand in for the same term, including a transfer credit.
     */
    corequisites?: boolean;
};

/** Shown on a planned course whose catalog companion was completed as transfer credit. */
export const courseOverrideNote = "Requires course override";

type StoredCourse = {
    id: string;
    subject: string;
    number: string;
    isLab: boolean;
    offeredIn: readonly TermSeason[];
    prerequisiteGroups: {
        isConcurrent: boolean;
        fromCatalog: boolean;
        note: string | null;
        options: {
            requires: { id: string; subject: string; number: string; isLab: boolean };
        }[];
    }[];
};

export type PlannedTermSnapshot = {
    startsOn: number;
    season: TermSeason;
    termLabel: string;
    courses: RuleCourse[];
};

export const draftLockedMessage = "This term plan has already been submitted.";
export const planChangedMessage = "This plan changed. Refresh the plan before making changes.";

export type DraftClaimData = {
    status?: "SUBMITTED";
    submittedAt?: Date;
    reviewedAt?: Date | null;
    updatedAt?: Date;
    revision?: { increment: number };
};

export class PlanRejected extends Error {
    readonly result: { success: false; error: string; violations?: string[] };

    constructor(result: { success: false; error: string; violations?: string[] }) {
        super(result.error);
        this.name = "PlanRejected";
        this.result = result;
    }
}

const orList = new Intl.ListFormat("en", { style: "long", type: "disjunction" });

export function toRuleCourse(course: StoredCourse): RuleCourse {
    return {
        id: course.id,
        code: `${course.subject} ${course.number}`,
        isLab: course.isLab,
        offeredIn: course.offeredIn,
        groups: course.prerequisiteGroups.map((group) => ({
            isConcurrent: group.isConcurrent,
            fromCatalog: group.fromCatalog,
            note: group.note,
            options: group.options.map((option) => ({
                id: option.requires.id,
                code: `${option.requires.subject} ${option.requires.number}`,
                isLab: option.requires.isLab,
            })),
        })),
        prerequisitesNeedAdvisorReview: coursePrerequisitesNeedAdvisorReview(
            course.prerequisiteGroups.map((group) => ({
                isConcurrent: group.isConcurrent,
                optionCount: group.options.length,
                note: group.note,
            })),
        ),
    };
}

/** Same offering sentence the course browser shows before a course is added. */
export function offeringViolation(
    course: { code: string; offeredIn: readonly TermSeason[] },
    season: TermSeason,
    termLabel: string,
) {
    if (courseOfferedInSeason(course.offeredIn, season)) return null;
    return notOfferedInTermMessage(course.code, termLabel, course.offeredIn);
}

function optionList(options: readonly RuleOption[]) {
    return orList.format(options.map((option) => option.code));
}

function catalogCorequisite(group: RuleGroup) {
    return group.isConcurrent && group.fromCatalog && group.options.length > 0;
}

function pushUnique(messages: string[], message: string | null) {
    if (message && !messages.includes(message)) messages.push(message);
}

/** The sentence shown when a lab is saved without its lecture. */
export function isPairViolation(message: string) {
    return message.includes(" must be taken with ");
}

/**
 * Prerequisite, corequisite, and term-offering sentences for one term.
 * A corequisite is required only when the catalog lists that direction.
 * The companion is on this term or already completed.
 */
export function requiresCourseOverride(
    course: RuleCourse,
    sameTermCourseIds: ReadonlySet<string>,
    completedSources: ReadonlyMap<string, string>,
) {
    for (const group of course.groups) {
        if (!catalogCorequisite(group)) continue;
        if (group.options.some((option) => sameTermCourseIds.has(option.id))) continue;
        const completed = group.options.filter((option) => completedSources.has(option.id));
        if (completed.length === 0) continue;
        const completedAtSchool = completed.some((option) => completedSources.get(option.id) !== "TRANSFER");
        if (!completedAtSchool) return true;
    }
    return false;
}

/** Advisor-facing notes for one planned course. These do not replace the rule check. */
export function reviewNotesForCourse(
    course: RuleCourse,
    sameTermCourseIds: ReadonlySet<string>,
    completedSources: ReadonlyMap<string, string>,
) {
    const notes: string[] = [];
    if (course.prerequisitesNeedAdvisorReview) notes.push("Prerequisites need advisor review");
    if (requiresCourseOverride(course, sameTermCourseIds, completedSources)) notes.push(courseOverrideNote);
    for (const group of course.groups) {
        if (!catalogCorequisite(group)) continue;
        const sentence = `Take with ${optionList(group.options)}`;
        if (!notes.includes(sentence)) notes.push(sentence);
    }
    return notes;
}

/** Prerequisite, corequisite, and term-offering sentences for one term. */
export function planRuleViolations(input: PlanCheck) {
    const messages: string[] = [];
    const onPlan = new Set(input.courses.map((course) => course.id));
    for (const id of input.sameTermCourseIds ?? []) onPlan.add(id);
    const checkCorequisites = input.corequisites !== false;

    for (const course of input.courses) {
        if (course.prerequisitesNeedAdvisorReview) {
            pushUnique(messages, advisorReviewViolation(course.code));
        }
        pushUnique(messages, offeringViolation(course, input.season, input.termLabel));

        for (const group of course.groups) {
            if (group.isConcurrent || group.options.length === 0) continue;
            const met = coursePrerequisitesSatisfied(
                [{ isConcurrent: false, optionIds: group.options.map((option) => option.id), note: group.note }],
                input.satisfiedCourseIds,
            );
            if (!met) {
                pushUnique(
                    messages,
                    `${course.code} needs ${optionList(group.options)} before ${input.termLabel}.`,
                );
            }
        }

        if (!checkCorequisites) continue;
        for (const group of course.groups) {
            if (!catalogCorequisite(group)) continue;
            const met = group.options.some((option) =>
                onPlan.has(option.id) || input.completedCourseIds.has(option.id),
            );
            if (!met) {
                pushUnique(
                    messages,
                    `${course.code} must be taken with ${optionList(group.options)} in ${input.termLabel}.`,
                );
            }
        }
    }

    return messages;
}

export function submitDecision(input: { courseCount: number; violations: readonly string[] }) {
    if (input.courseCount === 0) {
        return { success: false as const, error: "Add at least one course before submitting." };
    }
    if (input.violations.length > 0) {
        return {
            success: false as const,
            error: input.violations[0],
            violations: [...input.violations],
        };
    }
    return { success: true as const };
}

export function approveDecision(violations: readonly string[]) {
    if (violations.length === 0) return { success: true as const };
    return {
        success: false as const,
        error: violations[0],
        violations: [...violations],
    };
}

/** Sentences that appear only after this course is taken off the plan. */
export function violationsAfterRemoval(input: {
    removedCourseId: string;
    terms: readonly PlannedTermSnapshot[];
    transcriptSatisfiedIds: ReadonlySet<string>;
    completedCourseIds: ReadonlySet<string>;
}) {
    const before = violationsAcrossTerms(input.terms, input.transcriptSatisfiedIds, input.completedCourseIds);
    const afterTerms = input.terms.map((term) => ({
        ...term,
        courses: term.courses.filter((course) => course.id !== input.removedCourseId),
    }));
    const after = violationsAcrossTerms(afterTerms, input.transcriptSatisfiedIds, input.completedCourseIds);
    const already = new Set(before);
    return after.filter((message) => !already.has(message));
}

function violationsAcrossTerms(
    terms: readonly PlannedTermSnapshot[],
    transcriptSatisfiedIds: ReadonlySet<string>,
    completedCourseIds: ReadonlySet<string>,
) {
    const ordered = [...terms].sort((a, b) => a.startsOn - b.startsOn);
    const messages: string[] = [];
    const earlier = new Set<string>();
    for (const term of ordered) {
        const satisfied = new Set<string>([...transcriptSatisfiedIds, ...earlier]);
        messages.push(...planRuleViolations({
            courses: term.courses,
            season: term.season,
            termLabel: term.termLabel,
            satisfiedCourseIds: satisfied,
            completedCourseIds,
        }));
        for (const course of term.courses) earlier.add(course.id);
    }
    return messages;
}

/**
 * Lock a draft or returned row inside the write transaction.
 * A second tab's save matches zero rows once the plan is submitted or approved,
 * or once revision no longer matches.
 */
export async function claimDraftPlan(
    updateMany: (args: {
        where: {
            id: string;
            studentId: string;
            status: { in: Array<"DRAFT" | "RETURNED"> };
            revision?: number;
        };
        data: DraftClaimData;
    }) => Promise<{ count: number }>,
    plan: { id: string; studentId: string; revision?: number },
    data: DraftClaimData,
) {
    const updated = await updateMany({
        where: {
            id: plan.id,
            studentId: plan.studentId,
            status: { in: ["DRAFT", "RETURNED"] },
            ...(plan.revision != null ? { revision: plan.revision } : {}),
        },
        data: { ...data, revision: { increment: 1 } },
    });
    return updated.count === 1;
}
