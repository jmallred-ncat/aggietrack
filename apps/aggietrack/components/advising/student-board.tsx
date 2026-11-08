"use client";

import { MeetingAlert, MeetingPending } from "@/components/advising/meeting-status";
import { MeetingAlertContent, MeetingFooter, MeetingHeader, meetingButtonClass } from "@/components/advising/meeting-dialog";
import { MeetingStamp } from "@/components/advising/meeting-time";
import { SessionCard } from "@/components/advising/session-card";
import { useMeetingAction } from "@/components/advising/use-meeting-action";
import { DismissibleAlert } from "@/components/dismissible-alert";
import {
    AlertDialog,
    AlertDialogDescription,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { MeetingCard, MeetingResult, OpenSlotChoice, StudentAdvisingView } from "@/lib/advising-types";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type StudentActions = {
    book: (slotId: string, topic: string) => Promise<MeetingResult>;
    cancel: (sessionId: string, note: string) => Promise<MeetingResult>;
    reschedule: (sessionId: string, slotId: string, note: string) => Promise<MeetingResult>;
    choices: (sessionId: string) => Promise<OpenSlotChoice[]>;
};

export function StudentBoard({
    view,
    actions,
    loadFailed = false,
}: {
    view: StudentAdvisingView;
    actions: StudentActions;
    loadFailed?: boolean;
}) {
    const router = useRouter();
    const flow = useMeetingAction();
    const [selected, setSelected] = useState<OpenSlotChoice | null>(null);
    const [topic, setTopic] = useState("");
    const [dialogAlert, setDialogAlert] = useState<string | null>(null);
    const [canceling, setCanceling] = useState<MeetingCard | null>(null);
    const [cancelNote, setCancelNote] = useState("");
    const [moving, setMoving] = useState<MeetingCard | null>(null);
    const [moveNote, setMoveNote] = useState("");
    const [choices, setChoices] = useState<OpenSlotChoice[]>([]);
    const [nextSlot, setNextSlot] = useState<string>("");

    const groups = new Map<string, OpenSlotChoice[]>();
    for (const slot of view.slots) {
        const list = groups.get(slot.dateHeading) ?? [];
        list.push(slot);
        groups.set(slot.dateHeading, list);
    }

    function openReschedule(card: MeetingCard) {
        setMoving(card);
        setMoveNote("");
        setNextSlot("");
        setDialogAlert(null);
        void actions.choices(card.id).then(setChoices);
    }

    return (
        <div className="not-typeset flex flex-col gap-6 py-6" aria-busy={flow.pending ? true : undefined}>
            <header className="space-y-2">
                <h1 className="text-3xl font-bold text-balance sm:text-4xl">Advising</h1>
                {view.advisorName ? <p className="text-base">Your advisor is {view.advisorName}.</p> : null}
                <p className="text-sm text-muted-foreground">Times are shown in Eastern Time (EST or EDT).</p>
            </header>
            {loadFailed ? (
                <DismissibleAlert
                    stacked
                    title="Advising could not be loaded"
                    description="Try again to see the latest times."
                    action={<Button type="button" size="sm" onClick={() => router.refresh()}>Try again</Button>}
                />
            ) : null}
            {flow.alert ? <MeetingAlert alert={flow.alert} onRefresh={() => router.refresh()} /> : null}
            {flow.pending ? <MeetingPending pending={flow.pending} slow={flow.slow} titleRef={flow.titleRef} /> : null}

            {view.upcoming.length > 0 ? (
                <section className="flex flex-col gap-4">
                    <h2 className="text-2xl font-bold">Upcoming sessions</h2>
                    {view.upcoming.map((card) => (
                        <SessionCard key={card.id} card={card}>
                            {card.canChange ? (
                                <>
                                    <Button type="button" variant="outline" className="order-2 h-11 sm:order-1 sm:h-8" aria-label={`Cancel session with ${card.personName} on ${card.dateLabel} at ${card.timeLabel}`} onClick={() => { setCanceling(card); setCancelNote(""); }}>
                                        Cancel session
                                    </Button>
                                    <Button type="button" className="order-1 h-11 sm:order-2 sm:h-8" aria-label={`Reschedule session with ${card.personName} on ${card.dateLabel} at ${card.timeLabel}`} onClick={() => openReschedule(card)}>
                                        Reschedule session
                                    </Button>
                                </>
                            ) : null}
                        </SessionCard>
                    ))}
                </section>
            ) : null}

            {view.advisorName ? (
                <section className="flex flex-col gap-4">
                    <header className="space-y-2">
                        <h2 className="text-2xl font-bold">Book a session</h2>
                        <p className="text-sm text-muted-foreground">Each session is {view.sessionMinutes ?? 30} minutes. Times are in Eastern Time.</p>
                    </header>
                    {view.slots.length === 0 ? (
                        <Empty className="border border-dashed">
                            <EmptyHeader>
                                <EmptyTitle>No times are open</EmptyTitle>
                                <EmptyDescription>{view.advisorName} has not posted any open times yet. Check back soon.</EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    ) : (
                        [...groups.entries()].map(([heading, slots]) => (
                            <div key={heading} className="flex flex-col gap-2">
                                <h3 className="text-base font-medium">{heading}</h3>
                                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                                    {slots.map((slot) => (
                                        <Button
                                            key={slot.id}
                                            type="button"
                                            variant={selected?.id === slot.id ? "default" : "outline"}
                                            className="h-11 min-w-0 flex-col whitespace-normal sm:h-auto sm:min-h-11"
                                            aria-label={`${slot.accessibleName}, ${slot.durationLabel}`}
                                            onClick={() => { setSelected(slot); setTopic(""); setDialogAlert(null); }}
                                        >
                                            <span className="whitespace-nowrap">{slot.slotLabel}</span>
                                            <span className="tabular-nums">{slot.durationLabel}</span>
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </section>
            ) : (
                <Empty className="border border-dashed">
                    <EmptyHeader>
                        <EmptyTitle>No advisor is assigned yet</EmptyTitle>
                        <EmptyDescription>When an advisor is assigned to you, you can book a time here.</EmptyDescription>
                    </EmptyHeader>
                </Empty>
            )}

            {view.canceled.length > 0 ? (
                <section className="flex flex-col gap-4">
                    <h2 className="text-2xl font-bold">Canceled sessions</h2>
                    {view.canceled.map((card) => <SessionCard key={card.id} card={card} />)}
                </section>
            ) : null}
            {view.earlier.length > 0 ? (
                <section className="flex flex-col gap-4">
                    <h2 className="text-2xl font-bold">Past sessions</h2>
                    {view.earlier.map((card) => <SessionCard key={card.id} card={card} />)}
                </section>
            ) : null}

            <AlertDialog open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
                <MeetingAlertContent>
                    <MeetingHeader>
                        <AlertDialogTitle className="text-lg font-semibold leading-tight">Book this session?</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-muted-foreground">
                            Meet with {view.advisorName} on <MeetingStamp value={selected?.fullTimestamp ?? ""} />. The session is {selected?.durationMinutes} minutes.
                        </AlertDialogDescription>
                    </MeetingHeader>
                    <div className="flex flex-col gap-2 px-6 pb-4">
                        {dialogAlert ? <DismissibleAlert stacked title="Note is too long" description="Keep your note to 2,000 characters or fewer." /> : null}
                        <Label htmlFor="booking-topic">What do you want to talk about? (optional)</Label>
                        <Textarea id="booking-topic" value={topic} maxLength={2000} placeholder="Share anything that will help your advisor prepare." aria-invalid={dialogAlert ? true : undefined} onChange={(event) => setTopic(event.target.value)} />
                        <p className="text-sm text-muted-foreground">Your advisor can read this note.</p>
                        <p className="text-sm text-muted-foreground tabular-nums">{topic.length}/2,000 characters</p>
                    </div>
                    <MeetingFooter>
                        <Button type="button" variant="outline" className={meetingButtonClass} autoFocus onClick={() => setSelected(null)}>Cancel</Button>
                        <Button
                            type="button"
                            className={meetingButtonClass}
                            disabled={flow.pending !== null}
                            onClick={() => {
                                if (!selected) return;
                                if (topic.trim().length > 2000) {
                                    setDialogAlert("long");
                                    return;
                                }
                                const slot = selected;
                                setDialogAlert(null);
                                flow.begin(
                                    () => setSelected(null),
                                    { title: "Booking your session", description: "Saving your request…" },
                                    "Session booked",
                                    () => actions.book(slot.id, topic),
                                );
                            }}
                        >
                            Book session
                        </Button>
                    </MeetingFooter>
                </MeetingAlertContent>
            </AlertDialog>

            <AlertDialog open={canceling !== null} onOpenChange={(open) => { if (!open) setCanceling(null); }}>
                <MeetingAlertContent>
                    <MeetingHeader>
                        <AlertDialogTitle className="text-lg font-semibold leading-tight">Cancel this session?</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-muted-foreground">
                            Your session with {canceling?.personName} on <MeetingStamp value={canceling?.fullTimestamp ?? ""} /> will be canceled.
                        </AlertDialogDescription>
                    </MeetingHeader>
                    <div className="flex flex-col gap-2 px-6 pb-4">
                        <Label htmlFor="student-cancel-note">Add a note (optional)</Label>
                        <Textarea id="student-cancel-note" value={cancelNote} maxLength={2000} placeholder="Let your advisor know why you need to cancel." onChange={(event) => setCancelNote(event.target.value)} />
                        <p className="text-sm text-muted-foreground tabular-nums">{cancelNote.length}/2,000 characters</p>
                    </div>
                    <MeetingFooter>
                        <Button type="button" variant="outline" className={meetingButtonClass} autoFocus onClick={() => setCanceling(null)}>Keep session</Button>
                        <Button
                            type="button"
                            variant="destructive"
                            className={meetingButtonClass}
                            onClick={() => {
                                if (!canceling) return;
                                const card = canceling;
                                flow.begin(
                                    () => setCanceling(null),
                                    { title: "Canceling session…", description: "Saving your request…" },
                                    "Session canceled",
                                    () => actions.cancel(card.id, cancelNote),
                                );
                            }}
                        >
                            Cancel session
                        </Button>
                    </MeetingFooter>
                </MeetingAlertContent>
            </AlertDialog>

            <AlertDialog open={moving !== null} onOpenChange={(open) => { if (!open) setMoving(null); }}>
                <MeetingAlertContent>
                    <MeetingHeader>
                        <AlertDialogTitle className="text-lg font-semibold leading-tight">Pick a new time</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-muted-foreground">
                            Your current session is <MeetingStamp value={moving?.fullTimestamp ?? ""} />. Choose another open time with {moving?.personName}.
                        </AlertDialogDescription>
                    </MeetingHeader>
                    <div className="flex max-h-80 flex-col gap-2 overflow-y-auto px-6 pb-4">
                        {choices.length === 0 ? (
                            <Empty className="border-0">
                                <EmptyHeader>
                                    <EmptyTitle>No other times are open</EmptyTitle>
                                    <EmptyDescription>Cancel this session, or wait for your advisor to add more times.</EmptyDescription>
                                </EmptyHeader>
                            </Empty>
                        ) : choices.map((slot) => (
                            <Button key={slot.id} type="button" variant={nextSlot === slot.id ? "default" : "outline"} className="h-11 whitespace-normal" aria-label={slot.accessibleName} onClick={() => setNextSlot(slot.id)}>
                                <span className="whitespace-nowrap">{slot.dateHeading}</span>
                                <span className="whitespace-nowrap">{slot.slotLabel}</span>
                                <span className="tabular-nums">{slot.durationLabel}</span>
                            </Button>
                        ))}
                        <Label htmlFor="student-move-note">Add a note (optional)</Label>
                        <Textarea id="student-move-note" value={moveNote} maxLength={2000} onChange={(event) => setMoveNote(event.target.value)} />
                        <p className="text-sm text-muted-foreground tabular-nums">{moveNote.length}/2,000 characters</p>
                    </div>
                    <MeetingFooter>
                        <Button type="button" variant="outline" className={meetingButtonClass} autoFocus onClick={() => setMoving(null)}>Keep current time</Button>
                        <Button
                            type="button"
                            className={meetingButtonClass}
                            disabled={!nextSlot}
                            onClick={() => {
                                if (!moving || !nextSlot) return;
                                const card = moving;
                                const slotId = nextSlot;
                                flow.begin(
                                    () => setMoving(null),
                                    { title: "Rescheduling session…", description: "Saving your request…" },
                                    "Session rescheduled",
                                    () => actions.reschedule(card.id, slotId, moveNote),
                                );
                            }}
                        >
                            Reschedule session
                        </Button>
                    </MeetingFooter>
                </MeetingAlertContent>
            </AlertDialog>
        </div>
    );
}
