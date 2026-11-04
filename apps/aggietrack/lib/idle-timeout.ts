/** Sliding session: 30 minutes, refreshed after 5 minutes of real use. */
export const SESSION_EXPIRES_IN_SECONDS = 60 * 30;
export const SESSION_UPDATE_AGE_SECONDS = 60 * 5;

export const IDLE_WARN_MS = 28 * 60 * 1000;
export const IDLE_LIMIT_MS = 30 * 60 * 1000;

/** Deliberate input. Pointer movement and network activity are not included. */
export const IDLE_INPUT_EVENTS = ["keydown", "pointerdown", "touchstart", "wheel", "scroll"] as const;

export const IDLE_ACTIVITY_STORAGE_KEY = "aggietrack.idle-last-input";
export const IDLE_WARNING_ID = "idle-timeout-warning";

export const IDLE_WARNING_TITLE = "You're about to be signed out";
export const IDLE_WARNING_MESSAGE = "You'll be signed out in 2 minutes. Click, type, or scroll to stay signed in.";
export const IDLE_SIGNED_OUT_MESSAGE = "You were signed out after 30 minutes with no activity. Sign in to continue.";
export const IDLE_SIGN_IN_HREF = "/sign-in?reason=idle";

export type IdlePhase = "active" | "warn" | "sign-out";

export type IdleClock = {
    lastInputAt: number;
    lastTouchAt: number;
    warningDismissed: boolean;
};

export function initialIdleClock(now: number): IdleClock {
    return { lastInputAt: now, lastTouchAt: now, warningDismissed: false };
}

export function idlePhase(idleMs: number): IdlePhase {
    if (!Number.isFinite(idleMs) || idleMs < IDLE_WARN_MS) return "active";
    if (idleMs < IDLE_LIMIT_MS) return "warn";
    return "sign-out";
}

export function readIdle(clock: IdleClock, now: number) {
    const phase = idlePhase(now - clock.lastInputAt);
    return {
        phase,
        showWarning: phase === "warn" && !clock.warningDismissed,
        signOut: phase === "sign-out",
    };
}

/** Local input resets the idle clock. The session is touched only once updateAge has passed. */
export function noteInput(clock: IdleClock, at: number) {
    if (!Number.isFinite(at) || at <= clock.lastInputAt) {
        return { clock, refreshSession: false };
    }
    const refreshSession = at - clock.lastTouchAt >= SESSION_UPDATE_AGE_SECONDS * 1000;
    return {
        clock: {
            lastInputAt: at,
            lastTouchAt: refreshSession ? at : clock.lastTouchAt,
            warningDismissed: false,
        },
        refreshSession,
    };
}

/** Another tab already counted this input, so this tab does not touch the session again. */
export function noteRemoteActivity(clock: IdleClock, at: number): IdleClock {
    if (!Number.isFinite(at) || at <= clock.lastInputAt) return clock;
    return {
        lastInputAt: at,
        lastTouchAt: Math.max(clock.lastTouchAt, at),
        warningDismissed: false,
    };
}

export function adoptSharedActivity(clock: IdleClock, stored: number | null, now: number): IdleClock {
    if (stored == null || !Number.isFinite(stored)) return clock;
    return noteRemoteActivity(clock, Math.min(stored, now));
}

export function dismissWarning(clock: IdleClock): IdleClock {
    if (clock.warningDismissed) return clock;
    return { ...clock, warningDismissed: true };
}

export function signedOutReasonMessage(reason: string | null | undefined) {
    if (reason === "idle") return IDLE_SIGNED_OUT_MESSAGE;
    return null;
}
