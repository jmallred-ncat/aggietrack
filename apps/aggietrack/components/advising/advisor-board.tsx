"use client";

import { AdvisorAvailability, appointmentsHref, type AvailabilityActions } from "@/components/advising/advisor-availability";
import { MeetingAlert, MeetingPending } from "@/components/advising/meeting-status";
import {
    MeetingAlertContent,
    MeetingFooter,
    MeetingFormContent,
    MeetingFormFooter,
    MeetingFormHeader,
    MeetingHeader,
    meetingButtonClass,
} from "@/components/advising/meeting-dialog";
import { MeetingStamp } from "@/components/advising/meeting-time";
import { SessionCard } from "@/components/advising/session-card";
import { useMeetingAction } from "@/components/advising/use-meeting-action";
import { DismissibleAlert } from "@/components/dismissible-alert";
import { AlertDialog, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { advisorCancelLabel, advisorCancelSavedSuccess, advisorChangeNoteHelper, advisorRescheduleLabel, advisorRescheduleSuccess, groupOpenSlots } from "@/lib/advising-copy";
import {
    MEETING_DURATIONS,
    buildSingleSlot,
    buildWindowSlots,
    civilDateLabel,
    durationLabel,
    formatClockValue,
    issueCopy,
    parseClock,
    timeChoices,
} from "@/lib/advising-time";
import type { AdvisorAppointmentsView, AvailabilityRow, MeetingCard, MeetingResult, OpenSlotChoice } from "@/lib/advising-types";
import { zoomFailure } from "@/lib/advising-zoom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

const choices = timeChoices();

export type AdvisorActions = {
    saveDuration: (minutes: number) => Promise<MeetingResult>;
    addWindow: (input: { date: string; start: string; end: string }) => Promise<MeetingResult>;
    addOne: (input: { date: string; start: string }) => Promise<MeetingResult>;
    move: (slotId: string, input: { date: string; start: string }) => Promise<MeetingResult>;
    remove: (slotId: string) => Promise<MeetingResult>;
    cancel: (sessionId: string, note: string) => Promise<MeetingResult>;
    reschedule: (sessionId: string, slotId: string, note: string) => Promise<MeetingResult>;
    choices: (sessionId: string) => Promise<OpenSlotChoice[]>;
    saveZoom: (sessionId: string, url: string) => Promise<MeetingResult>;
    removeZoom: (sessionId: string) => Promise<MeetingResult>;
};

function dateValue(day: Date) {
    return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
}

function dateFromValue(value: string) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function AdvisorBoard({
    view,
    actions,
    scheduleActions,
    nowIso,
    loadFailed = false,
    mode = "sessions",
    search = "",
    sessionId = "",
}: {
    view: AdvisorAppointmentsView;
    actions: AdvisorActions;
    scheduleActions?: AvailabilityActions;
    nowIso: string;
    loadFailed?: boolean;
    mode?: "sessions" | "availability";
    search?: string;
    sessionId?: string;
}) {
    const router = useRouter();
    const flow = useMeetingAction();
    useEffect(() => {
        if (mode !== "sessions" || !sessionId) return;
        const node = document.getElementById(`session-${sessionId}`);
        node?.scrollIntoView({ block: "center" });
        if (node instanceof HTMLElement) node.focus();
    }, [mode, sessionId]);
    const [windowOpen, setWindowOpen] = useState(false);
    const [oneOpen, setOneOpen] = useState(false);
    const [editing, setEditing] = useState<AvailabilityRow | null>(null);
    const [removing, setRemoving] = useState<AvailabilityRow | null>(null);
    const [canceling, setCanceling] = useState<MeetingCard | null>(null);
    const [moving, setMoving] = useState<MeetingCard | null>(null);
    const [zoomCard, setZoomCard] = useState<MeetingCard | null>(null);
    const [removeZoomCard, setRemoveZoomCard] = useState<MeetingCard | null>(null);
    const noteRef = useRef<HTMLTextAreaElement>(null);

    return (
        <div className="not-typeset flex flex-col gap-6 py-6" aria-busy={flow.pending ? true : undefined}>
            <header className="space-y-2">
                <h1 className="text-3xl font-bold text-balance sm:text-4xl">Appointments</h1>
                {mode === "sessions" ? <p className="max-w-prose text-sm text-balance text-muted-foreground">Review upcoming, canceled, and past sessions.</p> : null}
                <p className="text-sm text-muted-foreground">Times are shown in Eastern Time (EST or EDT).</p>
            </header>
            <nav aria-label="Appointments" className="flex flex-wrap gap-2">
                <Button nativeButton={false} variant={mode === "sessions" ? "default" : "outline"} className="h-11" render={<Link href={appointmentsHref(search, { view: null })} aria-current={mode === "sessions" ? "page" : undefined} />}>Sessions</Button>
                <Button nativeButton={false} variant={mode === "availability" ? "default" : "outline"} className="h-11" render={<Link href={appointmentsHref(search, { view: "availability" })} aria-current={mode === "availability" ? "page" : undefined} />}>Availability</Button>
            </nav>
            {loadFailed ? (
                <DismissibleAlert
                    stacked
                    title="Appointments could not be loaded"
                    description="Try again to see your latest times and sessions."
                    action={<Button type="button" size="sm" onClick={() => router.refresh()}>Try again</Button>}
                />
            ) : null}
            {flow.alert ? <MeetingAlert alert={flow.alert} onRefresh={() => router.refresh()} /> : null}
            {flow.pending ? <MeetingPending pending={flow.pending} slow={flow.slow} titleRef={flow.titleRef} /> : null}

            {mode === "availability" && scheduleActions ? (
                <AdvisorAvailability model={view.availability} nowIso={nowIso} search={search} actions={scheduleActions} />
            ) : null}

            {mode === "sessions" ? <SessionSection title="Upcoming sessions" cards={view.upcoming} empty="upcoming" onCancel={setCanceling} onMove={setMoving} onZoom={setZoomCard} onRemoveZoom={setRemoveZoomCard} /> : null}
            {mode === "sessions" && view.canceled.length > 0 ? <SessionSection title="Canceled sessions" cards={view.canceled} /> : null}
            {mode === "sessions" && view.earlier.length > 0 ? <SessionSection title="Past sessions" cards={view.earlier} /> : null}

            {windowOpen ? <TimeDialog
                open={windowOpen}
                title="Add a window of times"
                description="Students will see every session that fits inside this window."
                confirm="Add times"
                pending="Adding times…"
                success="Times added"
                duration={view.durationMinutes}
                nowIso={nowIso}
                withEnd
                onClose={() => setWindowOpen(false)}
                onSave={(value) => actions.addWindow({ date: value.date, start: value.start, end: value.end ?? value.start })}
                begin={flow.begin}
                blocked={flow.pending !== null}
            /> : null}
            {oneOpen ? <TimeDialog
                open={oneOpen}
                title="Add one time"
                description="This adds one session at the length you saved."
                confirm="Add time"
                pending="Adding time…"
                success="Time added"
                duration={view.durationMinutes}
                nowIso={nowIso}
                onClose={() => setOneOpen(false)}
                onSave={(value) => actions.addOne({ date: value.date, start: value.start })}
                begin={flow.begin}
                blocked={flow.pending !== null}
            /> : null}
            {editing ? <TimeDialog
                open={editing !== null}
                title="Edit this time"
                description={`This keeps the session at ${editing?.durationMinutes ?? view.durationMinutes} minutes.`}
                confirm="Save time"
                pending="Saving time…"
                success="Time updated"
                duration={editing?.durationMinutes ?? view.durationMinutes}
                nowIso={nowIso}
                initialDate={editing?.dateValue}
                initialStart={editing?.startValue}
                onClose={() => setEditing(null)}
                onSave={(value) => actions.move(editing.id, { date: value.date, start: value.start })}
                begin={flow.begin}
                blocked={flow.pending !== null}
            /> : null}

            <AlertDialog open={removing !== null} onOpenChange={(open) => { if (!open) setRemoving(null); }}>
                <MeetingAlertContent>
                    <MeetingHeader>
                        <AlertDialogTitle className="text-lg font-semibold leading-tight">Remove these open times?</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-muted-foreground">
                            Open times on {removing?.dateLabel} from {removing ? rangeStart(removing.timeLabel) : ""} to {removing ? rangeEnd(removing.timeLabel) : ""} will be removed. Booked sessions stay as they are.
                        </AlertDialogDescription>
                    </MeetingHeader>
                    <MeetingFooter>
                        <Button type="button" variant="outline" className={meetingButtonClass} autoFocus onClick={() => setRemoving(null)}>Keep times</Button>
                        <Button
                            type="button"
                            variant="destructive"
                            className={meetingButtonClass}
                            onClick={() => {
                                if (!removing) return;
                                const row = removing;
                                flow.begin(() => setRemoving(null), { title: "Removing open times…", description: "Saving your request…" }, "Open times removed", () => actions.remove(row.id));
                            }}
                        >
                            Remove times
                        </Button>
                    </MeetingFooter>
                </MeetingAlertContent>
            </AlertDialog>

            <NoteDialog
                open={canceling !== null}
                title="Cancel this session?"
                description={<>This cancels {canceling?.personName}’s session on <MeetingStamp value={canceling?.fullTimestamp ?? ""} />.</>}
                label={advisorCancelLabel}
                placeholder="Explain the change so the student knows what to do next."
                helper={advisorChangeNoteHelper}
                empty="Explain why you are canceling this session."
                confirm="Cancel session"
                pending="Canceling session…"
                success={advisorCancelSavedSuccess}
                destructive
                noteRef={noteRef}
                onClose={() => setCanceling(null)}
                onSave={(note) => canceling ? actions.cancel(canceling.id, note) : Promise.resolve({ ok: true })}
                begin={flow.begin}
            />
            <RescheduleDialog
                key={moving?.id ?? "closed"}
                card={moving}
                onClose={() => setMoving(null)}
                choices={actions.choices}
                onSave={(slotId, note) => moving ? actions.reschedule(moving.id, slotId, note) : Promise.resolve({ ok: true })}
                begin={flow.begin}
            />
            <ZoomDialog key={zoomCard?.id ?? "zoom-closed"} card={zoomCard} onClose={() => setZoomCard(null)} onSave={(url) => zoomCard ? actions.saveZoom(zoomCard.id, url) : Promise.resolve({ ok: true })} begin={flow.begin} />
            <AlertDialog open={removeZoomCard !== null} onOpenChange={(open) => { if (!open) setRemoveZoomCard(null); }}>
                <MeetingAlertContent>
                    <MeetingHeader>
                        <AlertDialogTitle className="text-lg font-semibold leading-tight">Remove this Zoom link?</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-muted-foreground">You and the student will no longer see a join link for this session.</AlertDialogDescription>
                    </MeetingHeader>
                    <MeetingFooter>
                        <Button type="button" variant="outline" className={meetingButtonClass} autoFocus onClick={() => setRemoveZoomCard(null)}>Keep link</Button>
                        <Button
                            type="button"
                            variant="destructive"
                            className={meetingButtonClass}
                            onClick={() => {
                                if (!removeZoomCard) return;
                                const card = removeZoomCard;
                                flow.begin(() => setRemoveZoomCard(null), { title: "Removing Zoom link…", description: "Saving your request…" }, "Zoom link removed", () => actions.removeZoom(card.id));
                            }}
                        >
                            Remove Zoom link
                        </Button>
                    </MeetingFooter>
                </MeetingAlertContent>
            </AlertDialog>
        </div>
    );
}

function rangeStart(timeLabel: string) {
    return timeLabel.split("–")[0]?.trim() ?? timeLabel;
}

function rangeEnd(timeLabel: string) {
    return timeLabel.split("–")[1]?.replace(/\s+[A-Z]{2,5}$/, "").trim() ?? "";
}

function RowActions({
    row,
    onEdit,
    onRemove,
    wide = false,
}: {
    row: AvailabilityRow;
    onEdit: (row: AvailabilityRow) => void;
    onRemove: (row: AvailabilityRow) => void;
    wide?: boolean;
}) {
    if (!row.canChange) {
        return row.sessionId ? (
            <Button nativeButton={false} variant="outline" className={wide ? "h-11 w-full" : "whitespace-nowrap"} render={<a href={`#session-${row.sessionId}`}>View session</a>} />
        ) : null;
    }
    return (
        <div className={wide ? "flex flex-col gap-2" : "flex flex-wrap gap-2"}>
            <Button type="button" variant="outline" className={wide ? "h-11 w-full" : "whitespace-nowrap"} onClick={() => onEdit(row)}>Edit time</Button>
            <Button type="button" variant="outline" className={wide ? "h-11 w-full" : "whitespace-nowrap"} onClick={() => onRemove(row)}>Remove</Button>
        </div>
    );
}

function SessionSection({
    title,
    cards,
    empty,
    onCancel,
    onMove,
    onZoom,
    onRemoveZoom,
}: {
    title: string;
    cards: MeetingCard[];
    empty?: "upcoming";
    onCancel?: (card: MeetingCard) => void;
    onMove?: (card: MeetingCard) => void;
    onZoom?: (card: MeetingCard) => void;
    onRemoveZoom?: (card: MeetingCard) => void;
}) {
    if (cards.length === 0 && empty === "upcoming") {
        return (
            <section className="flex flex-col gap-4">
                <h2 className="text-2xl font-bold">{title}</h2>
                <Empty className="border border-dashed">
                    <EmptyHeader>
                        <EmptyTitle>No upcoming sessions</EmptyTitle>
                        <EmptyDescription>When a student books one of your open times, it shows up here.</EmptyDescription>
                    </EmptyHeader>
                </Empty>
            </section>
        );
    }
    if (cards.length === 0) return null;
    return (
        <section className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold">{title}</h2>
            {cards.map((card) => (
                <SessionCard key={card.id} card={card} notice={card.zoomUrl || !onZoom ? null : <p className="text-sm text-muted-foreground">No Zoom link yet</p>}>
                    {card.canChange && onCancel && onMove ? (
                        <>
                            <Button type="button" className="h-11 sm:order-2 sm:h-8" aria-label={`Reschedule session with ${card.personName} on ${card.dateLabel} at ${card.timeLabel}`} onClick={() => onMove(card)}>Reschedule session</Button>
                            <Button type="button" variant="outline" className="h-11 sm:order-1 sm:h-8" aria-label={`Cancel session with ${card.personName} on ${card.dateLabel} at ${card.timeLabel}`} onClick={() => onCancel(card)}>Cancel session</Button>
                        </>
                    ) : null}
                    {onZoom ? (
                        card.zoomUrl ? (
                            <>
                                <Button type="button" variant="outline" className="h-11 sm:order-4 sm:h-8" onClick={() => onZoom(card)}>Edit Zoom link</Button>
                                <Button type="button" variant="outline" className="h-11 sm:order-5 sm:h-8" onClick={() => onRemoveZoom?.(card)}>Remove Zoom link</Button>
                            </>
                        ) : (
                            <Button type="button" className="h-11 sm:order-4 sm:h-8" onClick={() => onZoom(card)}>Add Zoom link</Button>
                        )
                    ) : null}
                </SessionCard>
            ))}
        </section>
    );
}

function TimeDialog({
    open,
    title,
    description,
    confirm,
    pending,
    success,
    duration,
    nowIso,
    withEnd = false,
    initialDate = "",
    initialStart = "",
    onClose,
    onSave,
    begin,
    blocked,
}: {
    open: boolean;
    title: string;
    description: string;
    confirm: string;
    pending: string;
    success: string;
    duration: number;
    nowIso: string;
    withEnd?: boolean;
    initialDate?: string;
    initialStart?: string;
    onClose: () => void;
    onSave: (value: { date: string; start: string; end?: string }) => Promise<MeetingResult>;
    begin: (close: () => void, copy: { title: string; description: string }, success: string, action: () => Promise<MeetingResult>) => void;
    blocked: boolean;
}) {
    const [date, setDate] = useState(initialDate);
    const [dateOpen, setDateOpen] = useState(false);
    const [start, setStart] = useState(initialStart || "14:00");
    const [end, setEnd] = useState("15:00");
    useEffect(() => {
        if (!dateOpen) return;
        const closeDate = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            setDateOpen(false);
        };
        document.addEventListener("keydown", closeDate, true);
        return () => document.removeEventListener("keydown", closeDate, true);
    }, [dateOpen]);
    const [problem, setProblem] = useState<{ title: string; description: string } | null>(null);
    const now = new Date(nowIso);
    const built = date
        ? (withEnd
            ? buildWindowSlots({ date, start, end, durationMinutes: duration, now })
            : buildSingleSlot({ date, start, durationMinutes: duration, now }))
        : null;
    const startClock = parseClock(start);
    const endClock = parseClock(end);
    const windowSlots = built?.ok && "slots" in built ? built.slots : null;
    const unused = withEnd && windowSlots && startClock && endClock
        ? endClock.minutes - startClock.minutes - windowSlots.length * duration
        : 0;

    return (
        <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
            <MeetingFormContent>
                <MeetingFormHeader>
                    <DialogTitle className="text-lg font-semibold leading-tight">{title}</DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground">{description}</DialogDescription>
                </MeetingFormHeader>
                <div className="flex flex-col gap-4 px-6 pb-4">
                    {problem ? <DismissibleAlert stacked title={problem.title} description={problem.description} /> : null}
                    <div className="flex flex-col gap-2">
                        <Label htmlFor={`${title}-date`}>Date</Label>
                        <Popover open={dateOpen} onOpenChange={setDateOpen}>
                            <PopoverTrigger render={<Button type="button" variant="outline" id={`${title}-date`} className="h-11 justify-start sm:h-8" />}>
                                {date ? civilDateLabel(date) : "Choose a date"}
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={date ? dateFromValue(date) : undefined} onSelect={(day) => { if (day) setDate(dateValue(day)); }} />
                            </PopoverContent>
                        </Popover>
                    </div>
                    <TimeSelect id={`${title}-start`} label="Start time" value={start} onChange={setStart} />
                    {withEnd ? <TimeSelect id={`${title}-end`} label="End time" value={end} onChange={setEnd} /> : (
                        <p className="text-sm text-muted-foreground">Session length: {duration} minutes.</p>
                    )}
                    {windowSlots && withEnd ? (
                        <p className="text-sm text-muted-foreground">
                            This adds {windowSlots.length} {windowSlots.length === 1 ? "session" : "sessions"} of {duration} minutes on {civilDateLabel(date)}.
                            {unused > 0 ? ` The last ${unused} minutes are unused because they are shorter than a session.` : ""}
                        </p>
                    ) : null}
                </div>
                <MeetingFormFooter>
                    <Button type="button" variant="outline" className={meetingButtonClass} onClick={onClose}>Cancel</Button>
                    <Button
                        type="button"
                        className={meetingButtonClass}
                        disabled={blocked}
                        onClick={() => {
                            const result = withEnd
                                ? buildWindowSlots({ date, start, end, durationMinutes: duration, now: new Date() })
                                : buildSingleSlot({ date, start, durationMinutes: duration, now: new Date() });
                            if (!result.ok) {
                                setProblem(issueCopy(result.issue, duration, formatClockValue(start), formatClockValue(end)));
                                return;
                            }
                            setProblem(null);
                            begin(onClose, { title: pending, description: "Saving your request…" }, success, () => onSave({ date, start, end }));
                        }}
                    >
                        {confirm}
                    </Button>
                </MeetingFormFooter>
            </MeetingFormContent>
        </Dialog>
    );
}

function TimeSelect({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
    return (
        <div className="flex flex-col gap-2">
            <Label htmlFor={id}>{label}</Label>
            <Select value={value} onValueChange={(next) => { if (next) onChange(next); }}>
                <SelectTrigger id={id} className="w-full">
                    <SelectValue>{formatClockValue(value)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup>
                        {choices.map((choice) => (
                            <SelectItem key={choice.value} value={choice.value}>{choice.label}</SelectItem>
                        ))}
                    </SelectGroup>
                </SelectContent>
            </Select>
        </div>
    );
}

function NoteDialog({
    open,
    title,
    description,
    label,
    placeholder,
    helper,
    empty,
    confirm,
    pending,
    success,
    destructive = false,
    noteRef,
    onClose,
    onSave,
    begin,
}: {
    open: boolean;
    title: string;
    description: ReactNode;
    label: string;
    placeholder: string;
    helper: string;
    empty: string;
    confirm: string;
    pending: string;
    success: string | ((result: Extract<MeetingResult, { ok: true }>) => string | null);
    destructive?: boolean;
    noteRef: RefObject<HTMLTextAreaElement | null>;
    onClose: () => void;
    onSave: (note: string) => Promise<MeetingResult>;
    begin: (close: () => void, copy: { title: string; description: string }, success: string | ((result: Extract<MeetingResult, { ok: true }>) => string | null), action: () => Promise<MeetingResult>) => void;
}) {
    const [note, setNote] = useState("");
    const [invalid, setInvalid] = useState(false);
    return (
        <AlertDialog open={open} onOpenChange={(next) => { if (!next) { setInvalid(false); onClose(); } }}>
            <MeetingAlertContent>
                <MeetingHeader>
                    <AlertDialogTitle className="text-lg font-semibold leading-tight">{title}</AlertDialogTitle>
                    <AlertDialogDescription className="text-sm text-muted-foreground">{description}</AlertDialogDescription>
                </MeetingHeader>
                <div className="flex flex-col gap-2 px-6 pb-4">
                    {invalid ? <DismissibleAlert stacked title="Add a note" description={empty} /> : null}
                    <Label htmlFor="advisor-change-note">{label}</Label>
                    <Textarea ref={noteRef} id="advisor-change-note" value={note} maxLength={2000} placeholder={placeholder} aria-invalid={invalid || undefined} aria-describedby="advisor-change-note-help" autoFocus onChange={(event) => { setNote(event.target.value); setInvalid(false); }} />
                    <p id="advisor-change-note-help" className="text-sm text-muted-foreground">{helper}</p>
                    <p className="text-sm text-muted-foreground tabular-nums">{note.length}/2,000 characters</p>
                </div>
                <MeetingFooter>
                    <Button type="button" variant="outline" className={meetingButtonClass} onClick={onClose}>{destructive ? "Keep session" : "Keep current time"}</Button>
                    <Button
                        type="button"
                        variant={destructive ? "destructive" : "default"}
                        className={meetingButtonClass}
                        onClick={() => {
                            if (!note.trim()) {
                                setInvalid(true);
                                noteRef.current?.focus();
                                return;
                            }
                            if (note.trim().length > 2000) return;
                            begin(onClose, { title: pending, description: "Saving your request…" }, success, () => onSave(note));
                        }}
                    >
                        {confirm}
                    </Button>
                </MeetingFooter>
            </MeetingAlertContent>
        </AlertDialog>
    );
}

function RescheduleDialog({
    card,
    onClose,
    choices,
    onSave,
    begin,
}: {
    card: MeetingCard | null;
    onClose: () => void;
    choices: AdvisorActions["choices"];
    onSave: (slotId: string, note: string) => Promise<MeetingResult>;
    begin: (close: () => void, copy: { title: string; description: string }, success: string, action: () => Promise<MeetingResult>) => void;
}) {
    const [slots, setSlots] = useState<OpenSlotChoice[] | null>(null);
    const [slotId, setSlotId] = useState("");
    const [note, setNote] = useState("");
    const [invalid, setInvalid] = useState(false);
    const noteRef = useRef<HTMLTextAreaElement>(null);
    useEffect(() => {
        if (!card) return;
        let active = true;
        void choices(card.id).then((next) => {
            if (active) setSlots(next);
        });
        return () => {
            active = false;
        };
    }, [card, choices]);
    return (
        <AlertDialog open={card !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
            <MeetingAlertContent>
                <MeetingHeader>
                    <AlertDialogTitle className="text-lg font-semibold leading-tight">Pick a new time</AlertDialogTitle>
                    <AlertDialogDescription className="text-sm text-muted-foreground">
                        {card?.personName} is currently booked on <MeetingStamp value={card?.fullTimestamp ?? ""} />. Choose another of your open times.
                    </AlertDialogDescription>
                </MeetingHeader>
                <div className="flex max-h-80 flex-col gap-2 overflow-y-auto px-6 pb-4">
                    {invalid ? <DismissibleAlert stacked title="Add a note" description="Explain why you are rescheduling this session." /> : null}
                    {slots === null ? null : slots.length === 0 ? (
                        <Empty className="border-0">
                            <EmptyHeader>
                                <EmptyTitle>No other times are open</EmptyTitle>
                                <EmptyDescription>Add more availability before you reschedule, or cancel this session and leave a note.</EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    ) : groupOpenSlots(slots).map((group) => (
                        <div key={group.heading} className="flex flex-col gap-2">
                            <h3 className="text-base font-medium">{group.heading}</h3>
                            {group.slots.map((slot) => (
                                <Button key={slot.id} type="button" variant={slotId === slot.id ? "default" : "outline"} className="h-11 whitespace-normal" aria-label={slot.accessibleName} onClick={() => setSlotId(slot.id)}>
                                    <span className="whitespace-nowrap">{slot.slotLabel}</span>
                                    <span className="tabular-nums">{slot.durationLabel}</span>
                                </Button>
                            ))}
                        </div>
                    ))}
                    <Label htmlFor="advisor-move-note">{advisorRescheduleLabel}</Label>
                    <Textarea ref={noteRef} id="advisor-move-note" value={note} maxLength={2000} aria-invalid={invalid || undefined} aria-describedby="advisor-move-note-help" onChange={(event) => { setNote(event.target.value); setInvalid(false); }} />
                    <p id="advisor-move-note-help" className="text-sm text-muted-foreground">{advisorChangeNoteHelper}</p>
                    <p className="text-sm text-muted-foreground tabular-nums">{note.length}/2,000 characters</p>
                </div>
                <MeetingFooter>
                    <Button type="button" variant="outline" className={meetingButtonClass} autoFocus onClick={onClose}>Keep current time</Button>
                    <Button
                        type="button"
                        className={meetingButtonClass}
                        disabled={!slotId}
                        onClick={() => {
                            if (!note.trim()) {
                                setInvalid(true);
                                noteRef.current?.focus();
                                return;
                            }
                            begin(onClose, { title: "Rescheduling session…", description: "Saving your request…" }, advisorRescheduleSuccess, () => onSave(slotId, note));
                        }}
                    >
                        Reschedule session
                    </Button>
                </MeetingFooter>
            </MeetingAlertContent>
        </AlertDialog>
    );
}

function ZoomDialog({
    card,
    onClose,
    onSave,
    begin,
}: {
    card: MeetingCard | null;
    onClose: () => void;
    onSave: (url: string) => Promise<MeetingResult>;
    begin: (close: () => void, copy: { title: string; description: string }, success: string, action: () => Promise<MeetingResult>) => void;
}) {
    const [url, setUrl] = useState(card?.zoomUrl ?? "");
    const [problem, setProblem] = useState<{ title: string; description: string } | null>(null);
    const editing = Boolean(card?.zoomUrl);
    return (
        <Dialog open={card !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
            <MeetingFormContent>
                <MeetingFormHeader>
                    <DialogTitle className="text-lg font-semibold leading-tight">{editing ? "Edit Zoom link" : "Add a Zoom link"}</DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground">Use an https Zoom link. Links on zoom.us and school Zoom addresses (like ncat.zoom.us) are accepted.</DialogDescription>
                </MeetingFormHeader>
                <div className="flex flex-col gap-2 px-6 pb-4">
                    {problem ? <DismissibleAlert stacked title={problem.title} description={problem.description} /> : null}
                    <Label htmlFor="zoom-link">Zoom link</Label>
                    <Input id="zoom-link" value={url} placeholder="https://zoom.us/j/…" aria-invalid={problem ? true : undefined} onChange={(event) => setUrl(event.target.value)} />
                </div>
                <MeetingFormFooter>
                    <Button type="button" variant="outline" className={meetingButtonClass} onClick={onClose}>Cancel</Button>
                    <Button
                        type="button"
                        className={meetingButtonClass}
                        onClick={() => {
                            const invalid = zoomFailure(url);
                            if (invalid) {
                                setProblem(invalid);
                                return;
                            }
                            setProblem(null);
                            begin(onClose, { title: "Saving Zoom link…", description: "Saving your request…" }, "Zoom link saved", () => onSave(url));
                        }}
                    >
                        Save Zoom link
                    </Button>
                </MeetingFormFooter>
            </MeetingFormContent>
        </Dialog>
    );
}
