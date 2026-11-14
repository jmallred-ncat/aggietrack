import { earnsDegreeCredit } from "./applicable-credits";

/**
 * Credits the catalog requires, next to credits the student has logged.
 *
 * This is a log, not a degree audit. A completed entry adds its credits to
 * every group that lists the course, and to the group of a handbook slot the
 * entry fills. In-progress, withdrawn, and failed rows are left out. For
 * retakes, only the best passing attempt counts.
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
    grade: string | null;
    createdAt: Date;
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

    // Group entries by course to handle retakes
    const entriesByCourse = new Map<string, LoggedEntry[]>();
    for (const entry of entries) {
        // Skip entries that don't earn degree credit (F, W, I)
        if (!earnsDegreeCredit(entry.grade as any)) {
            continue;
        }
        // Skip non-completed entries
        if (entry.status !== "COMPLETED") {
            continue;
        }
        
        const key = entry.courseId ?? `${entry.groupId}:slot`;
        const attempts = entriesByCourse.get(key) ?? [];
        attempts.push(entry);
        entriesByCourse.set(key, attempts);
    }

    const earned = new Map<string, number>(sorted.map((group) => [group.id, 0]));
    let hasCompletedEntries = false;

    // For each course, count only the most recent passing attempt
    for (const [key, attempts] of entriesByCourse) {
        const best = attempts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
        if (!best) continue;
        
        hasCompletedEntries = true;
        const targets = new Set<string>();
        if (best.groupId && knownGroups.has(best.groupId)) {
            targets.add(best.groupId);
        }
        if (best.courseId) {
            for (const groupId of groupsByCourse.get(best.courseId) ?? []) {
                targets.add(groupId);
            }
        }
        for (const groupId of targets) {
            earned.set(groupId, (earned.get(groupId) ?? 0) + best.credits);
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
