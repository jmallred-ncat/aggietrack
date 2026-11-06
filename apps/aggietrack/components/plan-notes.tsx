"use client";

import { DismissibleAlert } from "@/components/dismissible-alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { loadEarlierPlanNotes, postPlanNote } from "@/app/(app)/plan-notes/actions";
import { NOTE_MAX_LENGTH, type PresentedNote } from "@/lib/plan-notes";
import { personInitials, planTimestamp } from "@/lib/plan-status";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

export function PlanNotes({
    plannedTermId,
    audience,
    advisorAssigned,
    notes,
    earlierCursor,
    highlightId,
}: {
    plannedTermId: string;
    audience: "student" | "advisor";
    advisorAssigned: boolean;
    notes: PresentedNote[];
    earlierCursor: string | null;
    highlightId?: string | null;
}) {
    const router = useRouter();
    const [items, setItems] = useState(notes);
    const [serverNotes, setServerNotes] = useState(notes);
    const [cursor, setCursor] = useState(earlierCursor);
    const [draft, setDraft] = useState("");
    const [alert, setAlert] = useState<{ title: string; description: string } | null>(null);
    const [pending, startTransition] = useTransition();
    const [mode, setMode] = useState<"note" | "earlier" | null>(null);
    const requestId = useRef<string | null>(null);
    if (serverNotes !== notes) {
        setServerNotes(notes);
        setItems(notes);
        setCursor(earlierCursor);
    }

    const length = [...draft].length;
    const sharedWith = audience === "advisor" ? "Shared with the student." : "Shared with your advisor.";
    const helper = audience === "student" && !advisorAssigned
        ? "No advisor is assigned yet. Your notes will be available to your advisor when one is assigned."
        : sharedWith;

    function post() {
        const body = draft;
        if (!body.trim() || pending) return;
        if ([...body.trim()].length > NOTE_MAX_LENGTH) {
            setAlert({ title: "Note not posted", description: "Keep your note to 2,000 characters or fewer." });
            toast.error("Note not posted", { description: "Keep your note to 2,000 characters or fewer." });
            return;
        }
        requestId.current ??= crypto.randomUUID();
        const id = requestId.current;
        setMode("note");
        startTransition(async () => {
            const result = await postPlanNote(plannedTermId, body, id);
            setMode(null);
            if (!result.success) {
                setAlert({ title: "Note not posted", description: result.error });
                toast.error("Note not posted", { description: result.error });
                return;
            }
            requestId.current = null;
            setDraft("");
            setAlert(null);
            toast.success("Note posted");
            router.refresh();
        });
    }

    function loadEarlier() {
        if (!cursor || pending) return;
        setMode("earlier");
        startTransition(async () => {
            const result = await loadEarlierPlanNotes(plannedTermId, cursor);
            setMode(null);
            if (!result.success) {
                toast.error("Notes could not be loaded", { description: result.error });
                return;
            }
            setItems((current) => {
                const seen = new Set(current.map((note) => note.id));
                return [...result.notes.filter((note) => !seen.has(note.id)), ...current];
            });
            setCursor(result.earlierCursor);
        });
    }

    return (
        <Card id="plan-notes">
            <CardHeader>
                <CardTitle>Plan notes</CardTitle>
                <CardDescription>
                    {audience === "advisor"
                        ? "A shared conversation about this term plan. You and the student can read these notes."
                        : "A shared conversation about this term plan. You and your advisor can read these notes."}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {cursor ? (
                    <Button type="button" variant="outline" disabled={pending} onClick={loadEarlier}>
                        {mode === "earlier" && pending ? "Loading earlier notes…" : "Load earlier notes"}
                    </Button>
                ) : null}
                {items.length === 0 ? (
                    <Empty className="border">
                        <EmptyHeader>
                            <EmptyTitle>No notes yet</EmptyTitle>
                            <EmptyDescription>Ask a question or share an update about this plan.</EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                ) : (
                    <ol className="m-0 list-none space-y-4 p-0">
                        {items.map((note) => (
                            <li key={note.id} id={note.id === highlightId ? "latest-return-note" : undefined} className="flex gap-3">
                                <Avatar aria-hidden="true">
                                    <AvatarFallback>{personInitials(note.authorName)}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm">
                                        <span className="font-medium">{note.authorName}</span>
                                        <span className="text-muted-foreground"> · {note.roleLabel}</span>
                                        <span className="text-muted-foreground"> · {planTimestamp(note.createdAt)}</span>
                                    </p>
                                    {note.badge ? <Badge variant="outline" className="mt-2">{note.badge}</Badge> : null}
                                    <p className="mt-1 text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">
                                        {note.eventLabel ?? note.body}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ol>
                )}
                {alert ? <DismissibleAlert title={alert.title} description={alert.description} /> : null}
                <div>
                    <Label htmlFor={`plan-note-${plannedTermId}`}>Add a note</Label>
                    <Textarea
                        id={`plan-note-${plannedTermId}`}
                        className="mt-2 min-h-[120px]"
                        value={draft}
                        placeholder="Ask a question or share an update about this plan."
                        onChange={(event) => setDraft(event.target.value)}
                    />
                    <p className="mt-2 text-sm text-muted-foreground">{helper}</p>
                    <p className="mt-1 text-sm text-muted-foreground tabular-nums">{length}/2,000 characters</p>
                    <Button
                        type="button"
                        className="mt-3"
                        disabled={pending || draft.trim().length === 0}
                        onClick={post}
                    >
                        {mode === "note" && pending ? "Posting…" : "Post note"}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
