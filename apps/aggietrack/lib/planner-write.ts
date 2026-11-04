import { PLAN_SAVE_FAILED } from "./plan-save";

/** Interactive transaction limit. Shorter than the 15s client deadline so a stuck write returns first. */
export const PLAN_TRANSACTION_TIMEOUT_MS = 10_000;

export function planTransactionOptions() {
    return { timeout: PLAN_TRANSACTION_TIMEOUT_MS };
}

export type WriteFault = { mode: "fail" } | { mode: "delay"; seconds: number };

export class PlannerWriteFailed extends Error {
    constructor() {
        super(PLAN_SAVE_FAILED);
        this.name = "PlannerWriteFailed";
    }
}

/** Preview and local only. Production never applies a stored fault. */
export function plannerWritesCanFail(env: string | undefined) {
    return env !== "production";
}

export function parsePlannerWriteFault(raw: string | null | undefined): WriteFault | null {
    if (raw === "fail") return { mode: "fail" };
    const match = /^delay:(\d{1,3})$/.exec(raw ?? "");
    if (!match) return null;
    const seconds = Number(match[1]);
    if (!Number.isInteger(seconds) || seconds < 1 || seconds > 120) return null;
    return { mode: "delay", seconds };
}

export function plannerWriteFaultValue(
    fault: unknown,
    seconds: unknown,
): { ok: true; value: string | null } | { ok: false; error: string } {
    if (fault === "off") return { ok: true, value: null };
    if (fault === "fail") return { ok: true, value: "fail" };
    if (fault === "delay") {
        const parsed = typeof seconds === "number"
            ? seconds
            : typeof seconds === "string" && seconds.trim()
                ? Number(seconds)
                : 16;
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > 120) {
            return { ok: false, error: "Choose a wait from 1 to 120 seconds." };
        }
        return { ok: true, value: `delay:${parsed}` };
    }
    return { ok: false, error: "Choose a failed save or a delayed save." };
}

/**
 * Read and clear the next fault. Production returns before the read, so a stored value cannot fire.
 */
export async function takePlannerWriteFault(
    env: string | undefined,
    studentId: string,
    db: {
        read: (id: string) => Promise<string | null>;
        clear: (id: string, raw: string) => Promise<boolean>;
    },
): Promise<WriteFault | null> {
    if (!plannerWritesCanFail(env)) return null;
    const raw = await db.read(studentId);
    if (!raw) return null;
    const fault = parsePlannerWriteFault(raw);
    const cleared = await db.clear(studentId, raw);
    if (!cleared || !fault) return null;
    return fault;
}

export function plannerFaultDelayMs(fault: WriteFault | null) {
    return fault?.mode === "delay" ? fault.seconds * 1000 : 0;
}

export async function waitForPlannerFault(
    fault: WriteFault | null,
    sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
) {
    const ms = plannerFaultDelayMs(fault);
    if (ms > 0) await sleep(ms);
}

function prismaErrorCode(error: unknown) {
    if (typeof error !== "object" || error === null || !("code" in error)) return null;
    const code = (error as { code?: unknown }).code;
    if (typeof code !== "string" || !/^P\d{4}$/.test(code)) return null;
    return code;
}

/** Sentences a student can read. Prisma codes and enum names stay out of the text. */
export function friendlyPlannerError(error: unknown) {
    if (error instanceof PlannerWriteFailed) return PLAN_SAVE_FAILED;
    const code = prismaErrorCode(error);
    if (code === "P2002") return "That course is already on this term plan.";
    if (code === "P2025") return "That course is no longer on this plan.";
    return PLAN_SAVE_FAILED;
}

export function plannerFailure(error: unknown): { success: false; error: string; violations?: string[] } | null {
    if (error instanceof PlannerWriteFailed || prismaErrorCode(error)) {
        return { success: false, error: friendlyPlannerError(error) };
    }
    return null;
}

/**
 * Fail on the lab row when the batch has one, so the lecture insert is in the same
 * transaction and rolls back with it. A course with no lab fails on that insert.
 */
export function shouldFailLabInsert(
    fault: WriteFault | null,
    courseId: string,
    creating: readonly string[],
    isLab: (id: string) => boolean,
) {
    if (fault?.mode !== "fail") return false;
    if (isLab(courseId)) return true;
    return !creating.some((id) => isLab(id));
}

export async function writePlannedCourses<T>(
    creating: readonly string[],
    isLab: (id: string) => boolean,
    fault: WriteFault | null,
    create: (id: string) => Promise<T>,
) {
    const rows: T[] = [];
    for (const id of creating) {
        if (shouldFailLabInsert(fault, id, creating, isLab)) throw new PlannerWriteFailed();
        rows.push(await create(id));
    }
    return rows;
}
