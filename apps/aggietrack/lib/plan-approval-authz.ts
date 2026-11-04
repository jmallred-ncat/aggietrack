const notAssignedError = "You can only approve a plan for a student assigned to you.";
const notWaitingError = "That term plan is not waiting for your review.";

export type PlanAssignment = {
    status: string;
    student: { advisorId: string | null };
};

/** The advisor id is the signed-in user. A missing or different assignment does not match. */
export function advisorOwnsPlan(advisorId: string, plan: PlanAssignment | null) {
    return advisorId.length > 0 && plan?.student.advisorId === advisorId;
}

/**
 * Approve only when the session advisor is assigned to the plan's student.
 * `persist` runs after that check, and a false result means the plan changed
 * before the write and nothing was saved.
 */
export async function approveIfAssigned<T extends PlanAssignment>(input: {
    advisorId: string;
    plan: T | null;
    persist: (plan: T) => Promise<boolean>;
}): Promise<{ success: true } | { success: false; error: string }> {
    const { advisorId, plan, persist } = input;
    if (!plan) {
        return { success: false, error: notWaitingError };
    }
    if (!advisorOwnsPlan(advisorId, plan)) {
        return { success: false, error: notAssignedError };
    }
    if (plan.status !== "SUBMITTED") {
        return { success: false, error: notWaitingError };
    }

    const persisted = await persist(plan);
    if (!persisted) {
        return { success: false, error: notWaitingError };
    }
    return { success: true };
}
