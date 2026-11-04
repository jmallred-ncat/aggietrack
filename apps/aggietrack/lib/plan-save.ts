/** Client deadline for a planner add or remove. The server transaction is shorter than this. */
export const PLAN_SAVE_DEADLINE_MS = 15_000;

export const PLAN_SAVE_FAILED = "Couldn't save, try again";

export class PlanSaveTimeout extends Error {
    constructor() {
        super(PLAN_SAVE_FAILED);
        this.name = "PlanSaveTimeout";
    }
}

export function withPlanSaveDeadline<T>(work: Promise<T>, ms = PLAN_SAVE_DEADLINE_MS): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new PlanSaveTimeout()), ms);
        work.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (error) => {
                clearTimeout(timer);
                reject(error);
            },
        );
    });
}

export type PlanSaveResult = {
    success: boolean;
    error?: string;
    violations?: string[];
};

export type FinishedPlanSave<T extends PlanSaveResult> =
    | { status: "saved"; result: T }
    | { status: "violations"; violations: string[] }
    | { status: "failed"; message: string; sonner: boolean; refresh: true };

/**
 * Wait for an add or remove. A timeout or a thrown error becomes the save-failed
 * toast and a refresh, without applying the change on screen.
 * A late response still calls onLate so a commit that lands after the deadline can refresh the screen.
 */
export async function finishPlanSave<T extends PlanSaveResult>(
    action: () => Promise<T>,
    options?: { deadlineMs?: number; onLate?: () => void },
): Promise<FinishedPlanSave<T>> {
    const pending = action();
    try {
        const result = await withPlanSaveDeadline(pending, options?.deadlineMs);
        if (!result.success) {
            if (result.violations && result.violations.length > 0) {
                return { status: "violations", violations: result.violations };
            }
            const message = result.error?.trim() ? result.error : PLAN_SAVE_FAILED;
            return {
                status: "failed",
                message,
                sonner: message === PLAN_SAVE_FAILED,
                refresh: true,
            };
        }
        return { status: "saved", result };
    } catch (error) {
        if (error instanceof PlanSaveTimeout) {
            void pending.then(
                () => options?.onLate?.(),
                () => options?.onLate?.(),
            );
        }
        return { status: "failed", message: PLAN_SAVE_FAILED, sonner: true, refresh: true };
    }
}
