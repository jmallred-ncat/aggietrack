type PrerequisiteGroupCheck = {
    isConcurrent: boolean;
    optionIds: string[];
};

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
