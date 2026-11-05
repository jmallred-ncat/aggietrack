export const ADVISOR_REVIEW_PREREQUISITES = "Prerequisites need advisor review";

type PrerequisiteGroupCheck = {
    isConcurrent: boolean;
    optionIds: string[];
};

type PrerequisiteReviewGroup = {
    isConcurrent: boolean;
    optionCount: number;
    note?: string | null;
};

/**
 * Catalog notes the seed keeps because a person has to judge them:
 * standing, scores, consent, grades, and "or higher".
 */
const RECOGNIZED_PREREQUISITE_NOTE =
    /\b(standing|status|sophomore|junior|senior|freshman|consent|instructor|permission|approval|chairperson|score|placement|grade|better|higher|above|major|majors|equivalent|repeatable|sat|act)\b|high school/i;

export function advisorReviewViolation(courseCode: string) {
    return `${courseCode} prerequisites need advisor review.`;
}

function recognizedPrerequisiteNote(note: string | null | undefined) {
    const text = note?.trim() ?? "";
    return text.length > 0 && RECOGNIZED_PREREQUISITE_NOTE.test(text);
}

/** A note-only group whose text is not a standing, score, consent, or grade rule. */
export function prerequisiteGroupUnresolved(group: PrerequisiteReviewGroup) {
    if (group.isConcurrent || group.optionCount > 0) {
        return false;
    }
    const note = group.note?.trim() ?? "";
    if (!note) {
        return false;
    }
    return !recognizedPrerequisiteNote(note);
}

/**
 * True when every stored prerequisite is text the catalog could not turn into a course.
 * A recognized standing or score note, or any real course option, stays a normal rule.
 */
export function coursePrerequisitesNeedAdvisorReview(groups: readonly PrerequisiteReviewGroup[]) {
    const prerequisites = groups.filter((group) => !group.isConcurrent);
    if (prerequisites.length === 0) {
        return false;
    }
    if (prerequisites.some((group) => group.optionCount > 0 || recognizedPrerequisiteNote(group.note))) {
        return false;
    }
    return prerequisites.some((group) => prerequisiteGroupUnresolved(group));
}

/** Course-option groups are combined with AND. Options inside a group are combined with OR. */
export function coursePrerequisitesSatisfied(
    groups: PrerequisiteGroupCheck[],
    satisfiedCourseIds: ReadonlySet<string>,
) {
    return groups.every((group) => {
        if (group.isConcurrent || group.optionIds.length === 0) {
            return true;
        }
        return group.optionIds.some((id) => satisfiedCourseIds.has(id));
    });
}
