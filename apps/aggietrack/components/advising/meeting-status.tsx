"use client";

import { DismissibleAlert } from "@/components/dismissible-alert";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { MeetingFailure } from "@/lib/advising-types";
import Link from "next/link";
import type { RefObject } from "react";
import type { PendingCopy } from "./use-meeting-action";

export function MeetingPending({
    pending,
    slow,
    titleRef,
}: {
    pending: PendingCopy;
    slow: boolean;
    titleRef: RefObject<HTMLHeadingElement | null>;
}) {
    return (
        <Card aria-busy="true">
            <CardHeader>
                <CardTitle ref={titleRef} tabIndex={-1} className="text-base font-medium">{pending.title}</CardTitle>
                <CardDescription>{pending.description}</CardDescription>
                {slow ? <p role="status" className="text-sm text-muted-foreground">This is taking longer than usual. Please wait before trying again.</p> : null}
            </CardHeader>
        </Card>
    );
}

export function MeetingAlert({ alert, onRefresh }: { alert: MeetingFailure; onRefresh: () => void }) {
    const refresh = alert.code === "stale" || alert.code === "booked" || alert.code === "failed" || alert.code === "reschedule";
    return (
        <DismissibleAlert
            key={`${alert.code}:${alert.title}:${alert.sessionId ?? ""}`}
            stacked
            title={alert.title}
            description={alert.description}
            action={alert.code === "signed-out" ? (
                <Button nativeButton={false} size="sm" render={<Link href="/">Sign in</Link>} />
            ) : alert.sessionId ? (
                <Button nativeButton={false} size="sm" variant="outline" render={<a href={`#session-${alert.sessionId}`}>View session</a>} />
            ) : refresh ? (
                <Button type="button" size="sm" variant="outline" onClick={onRefresh}>Refresh times</Button>
            ) : null}
        />
    );
}
