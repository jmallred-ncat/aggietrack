"use client";

import { DismissibleAlert } from "@/components/dismissible-alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Message, MessageAvatar, MessageContent, MessageHeader } from "@/components/ui/message";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
    planNoteEventPhrase,
    planNotesAudienceDescription,
    planNoteTimestamp,
    planNoteTimestampTitle,
    type PlanNoteEventAction,
    type PresentedNote,
} from "@/lib/plan-notes";
import { personInitials } from "@/lib/plan-status";
import { CheckCircleIcon, PaperPlaneTiltIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { cn } from "cn";

export function PlanNotesView({
    plannedTermId,
    audience,
    advisorAssigned,
    notes,
    earlierCursor,
    highlightId,
    draft,
    pending,
    mode,
    alert,
    canCompose = true,
    onDraftChange = () => undefined,
    onPost = () => undefined,
    onLoadEarlier = () => undefined,
}: {
    plannedTermId: string;
    audience: "student" | "advisor";
    advisorAssigned: boolean;
    notes: PresentedNote[];
    earlierCursor: string | null;
    highlightId?: string | null;
    draft: string;
    pending: boolean;
    mode: "note" | "earlier" | null;
    alert: { title: string; description: string } | null;
    canCompose?: boolean;
    onDraftChange?: (value: string) => void;
    onPost?: () => void;
    onLoadEarlier?: () => void;
}) {
    const fieldId = `plan-note-${plannedTermId}`;
    const length = [...draft].length;
    const advisorNotice = audience === "student" && !advisorAssigned
        ? "No advisor is assigned yet. Your notes will be available to your advisor when one is assigned."
        : null;

    return (
        <Card id="plan-notes" className="not-typeset pb-0">
            <CardHeader className="sm:px-6">
                <CardTitle>Plan notes</CardTitle>
                <CardDescription>{planNotesAudienceDescription(audience)}</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
                <div className="flex min-w-0 flex-col gap-4">
                    {earlierCursor ? (
                        <Button type="button" variant="outline" className="self-start" disabled={pending} onClick={onLoadEarlier}>
                            {mode === "earlier" && pending ? "Loading earlier notes…" : "Load earlier notes"}
                        </Button>
                    ) : null}
                    {notes.length === 0 ? (
                        <p className="py-2 text-sm text-muted-foreground">No notes yet.</p>
                    ) : (
                        <ol className="m-0 flex min-w-0 list-none flex-col divide-y divide-border p-0">
                            {notes.map((note) => (
                                <PlanNoteRow key={note.id} note={note} highlightId={highlightId} />
                            ))}
                        </ol>
                    )}
                </div>
                {canCompose ? (
                    <>
                        <Separator className="my-6" />
                        <FieldGroup className="gap-3">
                            <Field className="gap-3" data-invalid={alert ? true : undefined}>
                                <FieldLabel htmlFor={fieldId}>Add a note</FieldLabel>
                                <Textarea
                                    id={fieldId}
                                    className="min-h-20 text-sm leading-6"
                                    value={draft}
                                    placeholder="Ask a question or share an update about this plan."
                                    aria-invalid={alert ? true : undefined}
                                    onChange={(event) => onDraftChange(event.target.value)}
                                />
                                {advisorNotice ? <FieldDescription>{advisorNotice}</FieldDescription> : null}
                                <FieldDescription className="tabular-nums">{length}/2,000 characters</FieldDescription>
                            </Field>
                            {alert ? <DismissibleAlert title={alert.title} description={alert.description} /> : null}
                            <div className="flex justify-end">
                                <Button
                                    type="button"
                                    size="sm"
                                    disabled={pending || draft.trim().length === 0}
                                    onClick={onPost}
                                >
                                    {mode === "note" && pending ? "Posting…" : "Post note"}
                                </Button>
                            </div>
                        </FieldGroup>
                    </>
                ) : null}
            </CardContent>
        </Card>
    );
}

function PlanNoteRow({ note, highlightId }: { note: PresentedNote; highlightId?: string | null }) {
    const marked = note.id === highlightId ? "latest-return-note" : undefined;
    if (note.eventAction) {
        return (
            <li id={marked} className="py-3 first:pt-0 last:pb-0">
                <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                    <span className="flex size-8 shrink-0 items-center justify-center text-muted-foreground" aria-hidden="true">
                        <EventGlyph action={note.eventAction} />
                    </span>
                    <p className="min-w-0 text-sm leading-5 text-muted-foreground [overflow-wrap:anywhere]">
                        <span className="font-medium text-foreground">{note.authorName}</span>
                        {" "}
                        {planNoteEventPhrase(note.eventAction)}
                        <NoteTime value={note.createdAt} withSeparator />
                    </p>
                </div>
            </li>
        );
    }

    return (
        <li id={marked} className="py-4 first:pt-0 last:pb-0">
            <Message align="start" className="min-w-0 items-start gap-3 sm:gap-4">
                <MessageAvatar className="size-8 shrink-0 self-start mt-0.5">
                    <Avatar aria-hidden="true" className="size-8">
                        <AvatarFallback className="text-xs font-medium">{personInitials(note.authorName)}</AvatarFallback>
                    </Avatar>
                </MessageAvatar>
                <MessageContent className="min-w-0 flex-1 gap-1.5">
                    <MessageHeader className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-0">
                        <span className="text-sm font-semibold leading-5 text-foreground">{note.authorName}</span>
                        <span className="text-xs leading-5 text-muted-foreground">{note.roleLabel}</span>
                        <NoteTime value={note.createdAt} className="text-xs leading-5 text-muted-foreground" />
                        {note.badge ? (
                            <Badge variant="outline" className="h-5 px-1.5 text-[11px] font-medium">{note.badge}</Badge>
                        ) : null}
                    </MessageHeader>
                    <p className="text-sm leading-6 whitespace-pre-wrap text-foreground [overflow-wrap:anywhere] md:max-w-prose">
                        {note.body}
                    </p>
                </MessageContent>
            </Message>
        </li>
    );
}

function EventGlyph({ action }: { action: PlanNoteEventAction }) {
    const Icon = action === "submitted"
        ? PaperPlaneTiltIcon
        : action === "approved"
            ? CheckCircleIcon
            : WarningCircleIcon;
    return <Icon className="size-4" />;
}

function NoteTime({
    value,
    className,
    withSeparator = false,
}: {
    value: string;
    className?: string;
    withSeparator?: boolean;
}) {
    const label = planNoteTimestamp(value);
    const title = planNoteTimestampTitle(value);
    if (!label || !title) return null;
    const parsed = new Date(value);
    const dateTime = Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
    return (
        <>
            {withSeparator ? <span aria-hidden="true"> · </span> : null}
            <time dateTime={dateTime} title={title} className={cn("whitespace-nowrap", className)}>{label}</time>
        </>
    );
}
