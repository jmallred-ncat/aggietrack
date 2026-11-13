"use client";

import { meetingSuccessText } from "@/lib/advising-copy";
import type { MeetingFailure, MeetingResult } from "@/lib/advising-types";
import { runAfterConfirmCloses } from "@/lib/completion-menu";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export type PendingCopy = { title: string; description: string };

export function useMeetingAction(options?: { refresh?: boolean }) {
    const router = useRouter();
    const [pending, setPending] = useState<PendingCopy | null>(null);
    const [alert, setAlert] = useState<MeetingFailure | null>(null);
    const [slow, setSlow] = useState(false);
    const busy = useRef(false);
    const titleRef = useRef<HTMLHeadingElement>(null);

    useEffect(() => {
        if (!pending) return;
        const timer = window.setTimeout(() => setSlow(true), 10_000);
        const frame = window.requestAnimationFrame(() => titleRef.current?.focus());
        return () => {
            window.clearTimeout(timer);
            window.cancelAnimationFrame(frame);
        };
    }, [pending]);

    function begin(
        close: () => void,
        copy: PendingCopy,
        success: string | ((result: Extract<MeetingResult, { ok: true }>) => string | null),
        action: () => Promise<MeetingResult>,
    ) {
        if (busy.current) return;
        busy.current = true;
        setAlert(null);
        setSlow(false);
        runAfterConfirmCloses(close, () => {
            setPending(copy);
            void (async () => {
                try {
                    const result = await action();
                    const message = meetingSuccessText(result, success);
                    if (!result.ok) setAlert(result);
                    else if (message) toast.success(message);
                    if (options?.refresh !== false) router.refresh();
                } catch {
                    setAlert({ ok: false, code: "failed", title: "Something did not save. Try again.", description: "Try again." });
                } finally {
                    setPending(null);
                    setSlow(false);
                    busy.current = false;
                }
            })();
        }, (save) => {
            window.setTimeout(save, 0);
        });
    }

    return { pending, alert, slow, titleRef, begin, setAlert };
}
