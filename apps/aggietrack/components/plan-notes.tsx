"use client";

import { PlanNotesView } from "@/components/plan-notes-view";
import { loadEarlierPlanNotes, postPlanNote } from "@/app/(app)/plan-notes/actions";
import { NOTE_MAX_LENGTH, type PresentedNote } from "@/lib/plan-notes";
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
        <PlanNotesView
            plannedTermId={plannedTermId}
            audience={audience}
            advisorAssigned={advisorAssigned}
            notes={items}
            earlierCursor={cursor}
            highlightId={highlightId}
            draft={draft}
            pending={pending}
            mode={mode}
            alert={alert}
            onDraftChange={setDraft}
            onPost={post}
            onLoadEarlier={loadEarlier}
        />
    );
}
