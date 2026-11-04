"use client";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { authReactClient } from "@/lib/auth-client";
import {
    IDLE_ACTIVITY_STORAGE_KEY,
    IDLE_INPUT_EVENTS,
    IDLE_LIMIT_MS,
    IDLE_SIGN_IN_HREF,
    IDLE_WARNING_ID,
    IDLE_WARNING_MESSAGE,
    IDLE_WARNING_TITLE,
    IDLE_WARN_MS,
    adoptSharedActivity,
    dismissWarning,
    initialIdleClock,
    noteInput,
    noteRemoteActivity,
    readIdle,
    type IdleClock,
} from "@/lib/idle-timeout";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

function publishActivity(at: number) {
    try {
        localStorage.setItem(IDLE_ACTIVITY_STORAGE_KEY, String(at));
    } catch {
        // Private browsing can block storage. This tab still tracks its own input.
    }
}

function readSharedActivity() {
    try {
        const value = Number(localStorage.getItem(IDLE_ACTIVITY_STORAGE_KEY));
        return Number.isFinite(value) ? value : null;
    } catch {
        return null;
    }
}

export default function IdleTimer() {
    const [clock, setClock] = useState<IdleClock>(() => initialIdleClock(Date.now()));
    const [now, setNow] = useState(() => Date.now());
    const clockRef = useRef(clock);
    const signingOut = useRef(false);

    useEffect(() => {
        clockRef.current = clock;
    }, [clock]);

    useEffect(() => {
        publishActivity(clockRef.current.lastInputAt);

        function bump(at: number) {
            const shared = adoptSharedActivity(clockRef.current, readSharedActivity(), at);
            if (shared !== clockRef.current) {
                clockRef.current = shared;
                setClock(shared);
            }
            setNow(at);
        }

        function onInput(event: Event) {
            if (!event.isTrusted) return;
            const target = event.target;
            if (target instanceof Element && target.closest(`[data-idle-warning]`)) return;
            const at = Date.now();
            const previousTouch = clockRef.current.lastTouchAt;
            const next = noteInput(clockRef.current, at);
            clockRef.current = next.clock;
            setClock(next.clock);
            setNow(at);
            publishActivity(at);
            if (next.refreshSession) {
                const revertTouch = () => {
                    const current = clockRef.current;
                    if (current.lastTouchAt !== at) return;
                    const reverted = { ...current, lastTouchAt: previousTouch };
                    clockRef.current = reverted;
                    setClock(reverted);
                };
                void authReactClient.getSession().then((result) => {
                    if (result && typeof result === "object" && "error" in result && result.error) revertTouch();
                }).catch(() => {
                    revertTouch();
                });
            }
        }

        function onStorage(event: StorageEvent) {
            if (event.key !== IDLE_ACTIVITY_STORAGE_KEY || !event.newValue) return;
            const at = Number(event.newValue);
            const next = noteRemoteActivity(clockRef.current, at);
            if (next === clockRef.current) return;
            clockRef.current = next;
            setClock(next);
            setNow(Date.now());
        }

        function onVisible() {
            if (document.visibilityState === "visible") bump(Date.now());
        }

        for (const name of IDLE_INPUT_EVENTS) {
            window.addEventListener(name, onInput, { capture: true, passive: true });
        }
        window.addEventListener("storage", onStorage);
        document.addEventListener("visibilitychange", onVisible);

        let warnTimer = 0;
        let outTimer = 0;
        const schedule = () => {
            window.clearTimeout(warnTimer);
            window.clearTimeout(outTimer);
            const lastInputAt = clockRef.current.lastInputAt;
            const warnAt = lastInputAt + IDLE_WARN_MS;
            const outAt = lastInputAt + IDLE_LIMIT_MS;
            warnTimer = window.setTimeout(() => {
                const at = Date.now();
                if (at + 50 < clockRef.current.lastInputAt + IDLE_WARN_MS) {
                    schedule();
                    return;
                }
                bump(at);
            }, Math.max(0, warnAt - Date.now()));
            outTimer = window.setTimeout(() => {
                const at = Date.now();
                if (at + 50 < clockRef.current.lastInputAt + IDLE_LIMIT_MS) {
                    schedule();
                    return;
                }
                bump(at);
            }, Math.max(0, outAt - Date.now()));
        };
        schedule();

        return () => {
            for (const name of IDLE_INPUT_EVENTS) {
                window.removeEventListener(name, onInput, { capture: true });
            }
            window.removeEventListener("storage", onStorage);
            document.removeEventListener("visibilitychange", onVisible);
            window.clearTimeout(warnTimer);
            window.clearTimeout(outTimer);
        };
    }, [clock.lastInputAt]);

    const view = readIdle(clock, now);

    useEffect(() => {
        if (!view.signOut || signingOut.current) return;
        signingOut.current = true;
        void (async () => {
            try {
                await authReactClient.signOut();
            } catch {
                // The session is already past the idle limit. Leave the app either way.
            }
            window.location.assign(IDLE_SIGN_IN_HREF);
        })();
    }, [view.signOut]);

    if (!view.showWarning || typeof document === "undefined") return null;

    return createPortal(
        <div
            id={IDLE_WARNING_ID}
            data-idle-warning=""
            className="fixed top-4 left-1/2 z-50 w-[min(32rem,calc(100%-2rem))] -translate-x-1/2"
        >
            <Alert>
                <AlertTitle>{IDLE_WARNING_TITLE}</AlertTitle>
                <AlertDescription>{IDLE_WARNING_MESSAGE}</AlertDescription>
                <AlertAction>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            const next = dismissWarning(clockRef.current);
                            clockRef.current = next;
                            setClock(next);
                        }}
                    >
                        Dismiss
                    </Button>
                </AlertAction>
            </Alert>
        </div>,
        document.body,
    );
}
