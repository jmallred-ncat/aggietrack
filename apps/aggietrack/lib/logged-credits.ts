/**
 * Credits the catalog requires, next to credits the student has logged.
 *
 * This is a log, not a degree audit. A completed entry adds its credits to
 * every group that lists the course, and to the group of a handbook slot the
 * entry fills. In-progress, withdrawn, and failed rows are left out. Grades,
 * pool rules, and double-counting are left out too.
 */

export type LoggedGroup = {
    id: string;
    name: string;
    minCredits: number;
    sortOrder: number;
    courseIds: readonly string[];
};

export type LoggedEntry = {
    courseId: string | null;
    credits: number;
    status: string;
    /** Requirement group of the handbook slot this entry fills, if any. */
    groupId: string | null;
};

export type LoggedGroupCredits = {
    id: string;
    name: string;
    requiredCredits: number;
    earnedCredits: number;
};

export type LoggedCreditSummary = {
    groups: LoggedGroupCredits[];
    hasCompletedEntries: boolean;
};

export function loggedRequirementCredits(
    groups: readonly LoggedGroup[],
    entries: readonly LoggedEntry[],
): LoggedCreditSummary {
    const sorted = [...groups].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    const groupsByCourse = new Map<string, string[]>();
    const knownGroups = new Set(sorted.map((group) => group.id));

    for (const group of sorted) {
        for (const courseId of group.courseIds) {
            const matches = groupsByCourse.get(courseId) ?? [];
            matches.push(group.id);
            groupsByCourse.set(courseId, matches);
        }
    }

    const earned = new Map<string, number>(sorted.map((group) => [group.id, 0]));
    let hasCompletedEntries = false;

    for (const entry of entries) {
        if (entry.status !== "COMPLETED") {
            continue;
        }
        hasCompletedEntries = true;
        const targets = new Set<string>();
        if (entry.groupId && knownGroups.has(entry.groupId)) {
            targets.add(entry.groupId);
        }
        if (entry.courseId) {
            for (const groupId of groupsByCourse.get(entry.courseId) ?? []) {
                targets.add(groupId);
            }
        }
        for (const groupId of targets) {
            earned.set(groupId, (earned.get(groupId) ?? 0) + entry.credits);
        }
    }

    return {
        hasCompletedEntries,
        groups: sorted.map((group) => ({
            id: group.id,
            name: group.name,
            requiredCredits: group.minCredits,
            earnedCredits: earned.get(group.id) ?? 0,
        })),
    };
}
