"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Message, MessageAvatar, MessageContent, MessageHeader } from "@/components/ui/message";
import { MeetingTime } from "@/components/advising/meeting-time";
import type { MeetingCard } from "@/lib/advising-types";
import { personInitials } from "@/lib/plan-status";
import type { ReactNode } from "react";

function NoticeWhen({ dateLabel, timeLabel, iso, full }: { dateLabel: string; timeLabel: string; iso: string; full: string }) {
    return <MeetingTime dateLabel={dateLabel} timeLabel={timeLabel} iso={iso} full={full} className="text-xs text-muted-foreground" />;
}

export function SessionCard({ card, children }: { card: MeetingCard; children?: ReactNode }) {
    return (
        <Card id={`session-${card.id}`} className="min-w-0">
            <CardHeader className="min-w-0 gap-2">
                <CardTitle className="text-base font-medium text-pretty">{card.personName}</CardTitle>
                <Badge variant={card.statusTone}>{card.statusLabel}</Badge>
                <MeetingTime dateLabel={card.dateLabel} timeLabel={card.timeLabel} iso={card.iso} full={card.fullTimestamp} />
                <p className="text-sm text-muted-foreground tabular-nums">{card.durationLabel}</p>
            </CardHeader>
            <CardContent className="min-w-0 flex flex-col gap-4">
                {card.zoomUrl ? (
                    <div className="flex min-w-0 flex-col gap-2">
                        <p className="text-sm [overflow-wrap:anywhere]">{card.zoomUrl}</p>
                        <Button
                            nativeButton={false}
                            variant="outline"
                            className="h-11 w-full sm:h-8 sm:w-auto sm:self-start"
                            render={<a href={card.zoomUrl} target="_blank" rel="noopener noreferrer" aria-label="Open Zoom link (opens in a new tab)" />}
                        >
                            Open Zoom
                        </Button>
                    </div>
                ) : null}
                {card.notices.length > 0 ? (
                    <ul className="flex flex-col gap-4">
                        {card.notices.map((notice) => (
                            <li key={notice.id}>
                                <Message align="start" className="min-w-0 items-start gap-3">
                                    <MessageAvatar className="size-8 shrink-0 self-start mt-0.5">
                                        <Avatar aria-hidden="true" className="size-8">
                                            <AvatarFallback className="text-xs font-medium">{personInitials(notice.name)}</AvatarFallback>
                                        </Avatar>
                                    </MessageAvatar>
                                    <MessageContent className="min-w-0 flex-1 gap-1">
                                        <MessageHeader className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-0">
                                            <span className="text-sm font-semibold text-foreground">{notice.name}</span>
                                            {notice.roleLabel ? <span className="text-xs text-muted-foreground">{notice.roleLabel}</span> : null}
                                            <NoticeWhen dateLabel={notice.dateLabel} timeLabel={notice.timeLabel} iso={notice.iso} full={`${notice.dateLabel}, ${notice.timeLabel}`} />
                                        </MessageHeader>
                                        <p className="text-sm leading-6 text-foreground">{notice.phrase}</p>
                                        {notice.from && notice.to ? (
                                            <div className="text-sm leading-6 text-muted-foreground">
                                                <p>From <MeetingTime dateLabel={notice.from.dateLabel} timeLabel={notice.from.timeLabel} iso={notice.from.iso} full={notice.from.full} /></p>
                                                <p>To <MeetingTime dateLabel={notice.to.dateLabel} timeLabel={notice.to.timeLabel} iso={notice.to.iso} full={notice.to.full} /></p>
                                            </div>
                                        ) : null}
                                        {notice.body ? <p className="text-sm leading-6 whitespace-pre-wrap text-foreground [overflow-wrap:anywhere]">{notice.body}</p> : null}
                                    </MessageContent>
                                </Message>
                            </li>
                        ))}
                    </ul>
                ) : null}
                {card.started ? <p className="text-sm text-muted-foreground">This session has already started.</p> : null}
            </CardContent>
            {children ? <CardFooter className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center">{children}</CardFooter> : null}
        </Card>
    );
}
