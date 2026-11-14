import { Grade } from "./generated/prisma/browser";

// F, W, I don't earn degree credit
const NON_CREDIT_GRADES = new Set([Grade.F, Grade.W, Grade.I, "F", "W", "I"]);

function earnsDegreeCredit(grade: string | null): boolean {
    return grade != null && !NON_CREDIT_GRADES.has(grade as any);
}

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
        // Skip non-completed entries first
        if (entry.status !== "COMPLETED") {
            continue;
        }
        // Skip entries that don't earn degree credit (F, W, I)
        if (!earnsDegreeCredit(entry.grade)) {
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
        if (!attempts || attempts.length === 0) continue;
        
        const best = attempts.sort((a, b) => {
            const aTime = a.createdAt?.getTime() ?? 0;
            const bTime = b.createdAt?.getTime() ?? 0;
            return bTime - aTime;
        })[0];
        
        if (!best) continue;
        
        // Validate credits is a valid number
        const credits = typeof best.credits === 'number' && !isNaN(best.credits) && isFinite(best.credits) 
            ? best.credits 
            : 0;
        
        if (credits <= 0) continue;
        
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
            const current = earned.get(groupId) ?? 0;
            earned.set(groupId, current + credits);
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
