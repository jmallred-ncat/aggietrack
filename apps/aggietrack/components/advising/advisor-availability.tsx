"use client";

import { MeetingAlert, MeetingPending } from "@/components/advising/meeting-status";
import { MeetingAlertContent, MeetingFooter, MeetingFormContent, MeetingFormFooter, MeetingFormHeader, MeetingHeader, meetingButtonClass } from "@/components/advising/meeting-dialog";
import { useMeetingAction } from "@/components/advising/use-meeting-action";
import { DismissibleAlert } from "@/components/dismissible-alert";
import { AlertDialog, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WEEKDAYS, schedulesEqual, type ReviewItem, type ScheduleConfig, type ScheduleReview } from "@/lib/advising-schedule";
import {
    MEETING_DURATIONS,
    buildSingleSlot,
    buildWindowSlots,
    civilDateLabel,
    civilDateValue,
    clockValue,
    durationLabel,
    formatClockValue,
    issueCopy,
    timeChoices,
} from "@/lib/advising-time";
import type { AdvisorAvailabilityModel, AvailabilityRow, MeetingResult } from "@/lib/advising-types";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const choices = timeChoices();
const pageSize = 20;

export type AvailabilityActions = {
    saveDraft: (termId: string, config: ScheduleConfig) => Promise<MeetingResult>;
    discardDraft: (termId: string) => Promise<MeetingResult>;
    review: (termId: string, config: ScheduleConfig) => Promise<MeetingResult>;
    publish: (termId: string, token: string) => Promise<MeetingResult>;
    addWindow: (input: { date: string; start: string; end: string; durationMinutes: number; termId: string }) => Promise<MeetingResult>;
    addOne: (input: { date: string; start: string; durationMinutes: number; termId: string }) => Promise<MeetingResult>;
};

export function AdvisorAvailability({
    model,
    nowIso,
    search,
    actions,
}: {
    model: AdvisorAvailabilityModel;
    nowIso: string;
    search: string;
    actions: AvailabilityActions;
}) {
    const router = useRouter();
    const flow = useMeetingAction();
    const [editor, setEditor] = useState(model.config);
    const [baseline, setBaseline] = useState(model.config);
    const [seen, setSeen] = useState(model.revision);
    const [review, setReview] = useState<ScheduleReview | null>(null);
    const [discardOpen, setDiscardOpen] = useState(false);
    const [leaveHref, setLeaveHref] = useState<string | null>(null);
    const [windowOpen, setWindowOpen] = useState(false);
    const [oneOpen, setOneOpen] = useState(false);
    const [exception, setException] = useState<{ mode: "remove" | "change"; row: AvailabilityRow } | null>(null);
    const [dateFilter, setDateFilter] = useState("");
    const [page, setPage] = useState(0);
    const clean = useRef(false);
    const held = useRef<ScheduleReview | null>(null);
    const staleTitle = useRef<HTMLHeadingElement>(null);
    const dirty = !clean.current && !schedulesEqual(editor, baseline);
    const termId = model.selectedTermId;

    useEffect(() => {
        if (model.revision === seen || !schedulesEqual(editor, baseline)) return;
        setEditor(model.config);
        setBaseline(model.config);
        setSeen(model.revision);
    }, [baseline, editor, model.config, model.revision, seen]);

    useEffect(() => {
        if (!dirty) return;
        const warn = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = "";
        };
        const click = (event: MouseEvent) => {
            const anchor = (event.target as HTMLElement | null)?.closest("a");
            if (!anchor) return;
            const href = anchor.getAttribute("href");
            if (!href || href.startsWith("#") || anchor.target === "_blank") return;
            event.preventDefault();
            event.stopPropagation();
            setLeaveHref(href);
        };
        window.addEventListener("beforeunload", warn);
        document.addEventListener("click", click, true);
        return () => {
            window.removeEventListener("beforeunload", warn);
            document.removeEventListener("click", click, true);
        };
    }, [dirty]);

    useEffect(() => {
        if (flow.pending || !held.current) return;
        setReview(held.current);
        held.current = null;
    }, [flow.pending]);

    useEffect(() => {
        if (review?.stale) staleTitle.current?.focus();
    }, [review]);

    function update(next: ScheduleConfig) {
        clean.current = false;
        setEditor(next);
    }

    function go(href: string) {
        clean.current = true;
        setLeaveHref(null);
        router.push(href);
    }

    const filtered = model.openTimes.filter((row) => !dateFilter || row.dateValue === dateFilter);
    const rangeStart = filtered.length === 0 ? 0 : page * pageSize + 1;
    const visible = filtered.slice(page * pageSize, page * pageSize + pageSize);
    const rangeEnd = page * pageSize + visible.length;

    return (
        <section className="flex flex-col gap-6" aria-busy={flow.pending ? true : undefined}>
            <header className="space-y-2">
                <h2 className="text-2xl font-bold">Advising availability</h2>
                <p className="max-w-prose text-sm text-balance text-muted-foreground">Choose a semester, set your weekly hours, and publish when you{"\u2019"}re ready.</p>
            </header>
            {flow.alert ? <MeetingAlert alert={flow.alert} onRefresh={() => router.refresh()} /> : null}
            {flow.pending ? <MeetingPending pending={flow.pending} slow={flow.slow} titleRef={flow.titleRef} /> : null}
            <FieldGroup>
                <Field>
                    <FieldLabel htmlFor="semester">Semester</FieldLabel>
                    <Select value={termId ?? ""} onValueChange={(value) => {
                        if (!value || value === termId) return;
                        const href = appointmentsHref(search, { view: "availability", term: value, page: null });
                        if (dirty) setLeaveHref(href);
                        else router.push(href);
                    }}>
                        <SelectTrigger id="semester" className="h-11 w-full">
                            <SelectValue placeholder="Choose a semester">{model.terms.find((term) => term.id === termId)?.label}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                {model.terms.map((term) => <SelectItem key={term.id} value={term.id}>{term.label}</SelectItem>)}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                    <FieldDescription>Each semester has its own published hours. Changing one semester does not change another.</FieldDescription>
                </Field>
                {model.statusLabel ? (
                    <div className="flex flex-col gap-2">
                        <Badge variant={model.status === "published" ? "default" : "outline"}>{model.statusLabel}</Badge>
                        {model.statusHelper ? <p className="text-sm text-muted-foreground">{model.statusHelper}</p> : null}
                    </div>
                ) : null}
                {model.datesUnavailable ? (
                    <DismissibleAlert stacked title="Semester dates are unavailable" description="This semester does not have start and end dates yet, so hours cannot be generated. Choose another semester or wait until dates are posted." />
                ) : model.runLabel ? <p className="text-sm text-muted-foreground"><span className="whitespace-nowrap">{model.runLabel}</span></p> : null}
                <div className="grid gap-4 sm:grid-cols-2">
                    <DateField id="first" label="First day" value={editor.firstDay} disabled={model.datesUnavailable} onChange={(value) => update({ ...editor, firstDay: value })} />
                    <DateField id="last" label="Last day" value={editor.lastDay} disabled={model.datesUnavailable} onChange={(value) => update({ ...editor, lastDay: value })} />
                </div>
                <FieldDescription>Both days are included. They default to this semester{"\u2019"}s start and end. You can choose a narrower range inside this semester.</FieldDescription>
                <Field>
                    <FieldLabel htmlFor="session-length">Session length</FieldLabel>
                    <Select value={isListed(editor.durationMinutes) ? String(editor.durationMinutes) : ""} onValueChange={(value) => { if (value) update({ ...editor, durationMinutes: Number(value) }); }}>
                        <SelectTrigger id="session-length" className="h-11 w-full">
                            <SelectValue placeholder="Choose a session length">{isListed(editor.durationMinutes) ? durationLabel(editor.durationMinutes) : "Choose a session length"}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                {MEETING_DURATIONS.map((minutes) => <SelectItem key={minutes} value={String(minutes)}>{durationLabel(minutes)}</SelectItem>)}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                    <FieldDescription>This length applies when you publish new weekly hours. Booked sessions and one-off times keep their original length.</FieldDescription>
                </Field>
                <div className="flex flex-col gap-3">
                    {WEEKDAYS.map((name, index) => {
                        const day = editor.weekdays[index] ?? { unavailable: true, windows: [] };
                        return (
                            <Card key={name} id={`weekday-${index}`} className="gap-3 p-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <h3 className="text-base font-semibold">{name}</h3>
                                    <Button type="button" variant={day.unavailable ? "default" : "outline"} aria-pressed={day.unavailable} aria-label={`${name} is unavailable`} className="h-11" onClick={() => {
                                        const weekdays = editor.weekdays.map((item, itemIndex) => itemIndex === index ? { ...item, unavailable: !item.unavailable } : item);
                                        update({ ...editor, weekdays });
                                    }}>Unavailable</Button>
                                </div>
                                {day.unavailable ? null : day.windows.map((window, windowIndex) => (
                                    <div key={`${name}-${windowIndex}`} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                                        <ClockField id={`${name}-${windowIndex}-start`} label="Start time" value={window.start} onChange={(value) => update(changeWindow(editor, index, windowIndex, { ...window, start: value }))} />
                                        <ClockField id={`${name}-${windowIndex}-end`} label="End time" value={window.end} onChange={(value) => update(changeWindow(editor, index, windowIndex, { ...window, end: value }))} />
                                        <Button type="button" variant="outline" className="h-11 sm:self-end" aria-label={`Remove hours for ${name}, ${formatClockValue(window.start)}\u2013${formatClockValue(window.end)}`} onClick={() => update(changeWindow(editor, index, windowIndex, null))}>Remove hours</Button>
                                    </div>
                                ))}
                                {day.unavailable ? null : (
                                    <Button type="button" variant="outline" className="h-11" aria-label={`Add hours for ${name}`} onClick={() => {
                                        const weekdays = editor.weekdays.map((item, itemIndex) => itemIndex === index ? { ...item, windows: [...item.windows, { start: "09:00", end: "10:00" }] } : item);
                                        update({ ...editor, weekdays });
                                    }}>Add hours</Button>
                                )}
                            </Card>
                        );
                    })}
                </div>
                <div id="dates" className="flex flex-col gap-3">
                    <h3 className="text-base font-semibold">Unavailable dates</h3>
                    <p className="text-sm text-muted-foreground">After you publish, students will not see open times on these dates. Booked sessions stay as they are.</p>
                    {editor.unavailableDates.map((date) => (
                        <div key={date} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="whitespace-nowrap text-sm">{civilDateLabel(date)}</p>
                            <Button type="button" variant="outline" className="h-11" onClick={() => update({ ...editor, unavailableDates: editor.unavailableDates.filter((item) => item !== date) })}>Remove date</Button>
                        </div>
                    ))}
                    <DateField id="add-date" label="Add a date" value={null} onChange={(value) => {
                        if (!value || editor.unavailableDates.includes(value)) return;
                        update({ ...editor, unavailableDates: [...editor.unavailableDates, value].sort() });
                    }} />
                </div>
            </FieldGroup>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                {model.status === "changes" ? <Button type="button" variant="outline" className="h-11" onClick={() => setDiscardOpen(true)}>Discard unpublished changes</Button> : null}
                {model.status === "draft" ? <Button type="button" variant="outline" className="h-11" onClick={() => setDiscardOpen(true)}>Discard draft</Button> : null}
                <Button type="button" variant="outline" className="h-11" disabled={flow.pending !== null || !termId} onClick={() => save(termId, editor, "Draft saved")}>Save draft</Button>
                <Button type="button" className="h-11" disabled={flow.pending !== null || !termId} onClick={() => {
                    if (!termId) return;
                    flow.begin(() => undefined, { title: "Reviewing changes\u2026", description: "Saving your request\u2026" }, () => null, async () => {
                        const result = await actions.review(termId, editor);
                        if (!result.ok && result.code === "review" && result.review) {
                            setBaseline(editor);
                            setReview(result.review);
                            return { ok: true };
                        }
                        if (!result.ok && result.field) document.getElementById(result.field)?.focus();
                        return result;
                    });
                }}>Review changes</Button>
            </div>
            <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">Use these for a one-off time students can book now. Weekly hours are the main way to set a semester.</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <Button type="button" className="h-11" onClick={() => setWindowOpen(true)}>Add a window of times</Button>
                    <Button type="button" variant="outline" className="h-11" onClick={() => setOneOpen(true)}>Add one time</Button>
                </div>
            </div>
            <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <h3 className="text-base font-semibold">Open times</h3>
                    <DateField id="open-date" label="Date" value={dateFilter || null} onChange={(value) => { setDateFilter(value ?? ""); setPage(0); }} />
                </div>
                {filtered.length === 0 ? (
                    <Empty className="border border-dashed">
                        <EmptyHeader>
                            <EmptyTitle>No open times yet</EmptyTitle>
                            <EmptyDescription>Set weekly hours and publish a semester schedule so your assigned students can book.</EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                ) : (
                    <>
                        <p className="text-sm tabular-nums text-muted-foreground">Showing {rangeStart}{"\u2013"}{rangeEnd} of {filtered.length} open times.</p>
                        <div className="flex flex-col gap-3">
                            {visible.map((row) => (
                                <Card key={row.id} id={`time-${row.id}`} tabIndex={-1} className="gap-2 p-4">
                                    <p className="whitespace-nowrap text-sm font-medium">{row.dateLabel}</p>
                                    <p className="whitespace-nowrap text-sm">{row.timeLabel}</p>
                                    <p className="text-sm text-muted-foreground">{row.durationLabel}</p>
                                    {row.sourceLabel ? <p className="text-sm text-muted-foreground">{row.sourceLabel}</p> : null}
                                    {row.pendingLabel ? <Badge variant="outline">{row.pendingLabel}</Badge> : null}
                                    {termId && generated(row) && !row.pendingLabel && !pendingInEditor(row) ? (
                                        <div className="flex flex-col gap-2 sm:flex-row">
                                            <Button type="button" variant="outline" className="h-11" onClick={() => setException({ mode: "change", row })}>Change this time</Button>
                                            <Button type="button" variant="outline" className="h-11" onClick={() => setException({ mode: "remove", row })}>Remove when I publish</Button>
                                        </div>
                                    ) : null}
                                </Card>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <Button type="button" variant="outline" className="h-11" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>Previous</Button>
                            <Button type="button" variant="outline" className="h-11" disabled={rangeEnd >= filtered.length} onClick={() => setPage((current) => current + 1)}>Next</Button>
                        </div>
                    </>
                )}
            </div>
            {review ? (
                <AlertDialog open onOpenChange={(open) => { if (!open) setReview(null); }}>
                    <MeetingAlertContent className="sm:max-w-xl">
                        <MeetingHeader>
                            <AlertDialogTitle className="text-lg font-semibold leading-tight">Review and publish?</AlertDialogTitle>
                            <AlertDialogDescription className="text-sm text-muted-foreground">Publishing updates the times students can book for {review.semester}. Booked sessions stay as they are.</AlertDialogDescription>
                        </MeetingHeader>
                        <div className="flex max-h-80 flex-col gap-3 overflow-y-auto px-6 pb-4">
                            {review.stale ? <h3 ref={staleTitle} tabIndex={-1} className="text-base font-semibold">Review these changes again</h3> : null}
                            {review.stale ? <p className="text-sm text-muted-foreground">Bookings or hours changed since you opened this review. Nothing was published. Check the updated counts and publish again if they look right.</p> : null}
                            <p className="text-sm"><span className="whitespace-nowrap">{review.rangeLabel}</span></p>
                            {review.officialLabel ? <p className="text-sm"><span className="whitespace-nowrap">{review.officialLabel}</span></p> : null}
                            {review.blocking.map((block) => (
                                <div key={block.title} className="flex flex-col gap-2">
                                    <DismissibleAlert stacked title={block.title} description={block.description} />
                                    {block.times.map((item) => (
                                        <div key={item.id} className="flex flex-col gap-1">
                                            <p className="text-sm">{item.fullTimestamp}</p>
                                            <p className="text-sm text-muted-foreground">{item.sourceLabel}</p>
                                            <Button type="button" variant="outline" className="h-11" onClick={() => viewTime(item)}>View time</Button>
                                        </div>
                                    ))}
                                </div>
                            ))}
                            {review.lines.map((line) => <p key={line} className="text-sm tabular-nums">{line}</p>)}
                            {review.skipLines.map((line) => <p key={line} className="text-sm tabular-nums">{line}</p>)}
                            {review.remainders.map((line) => <p key={line} className="text-sm text-muted-foreground">{line}</p>)}
                            {review.sections.map((section) => <DetailList key={section.key} label={section.expandLabel} items={section.items} />)}
                        </div>
                        <MeetingFooter>
                            <Button type="button" variant="outline" className={meetingButtonClass} autoFocus={!review.stale} onClick={() => setReview(null)}>Keep editing</Button>
                            <Button type="button" className={meetingButtonClass} disabled={flow.pending !== null || review.blocking.length > 0 || !termId} onClick={() => {
                                if (!termId || !review) return;
                                const token = review.token;
                                flow.begin(() => setReview(null), { title: "Publishing schedule\u2026", description: "Saving your request\u2026" }, () => held.current ? null : "Schedule published", async () => {
                                    const result = await actions.publish(termId, token);
                                    if (!result.ok && result.review && (result.code === "stale" || result.code === "blocked")) {
                                        held.current = { ...result.review, stale: result.code === "stale" };
                                        return { ok: true };
                                    }
                                    return result;
                                });
                            }}>Publish schedule</Button>
                        </MeetingFooter>
                    </MeetingAlertContent>
                </AlertDialog>
            ) : null}
            <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
                <MeetingAlertContent>
                    <MeetingHeader>
                        <AlertDialogTitle className="text-lg font-semibold leading-tight">{model.status === "draft" ? "Discard this draft?" : "Discard unpublished changes?"}</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-muted-foreground">
                            {model.status === "draft"
                                ? "These hours have not been published. Students will still see no times from this semester schedule."
                                : "The published hours students see will stay as they are. Your unpublished edits will be lost."}
                        </AlertDialogDescription>
                    </MeetingHeader>
                    <MeetingFooter>
                        <Button type="button" variant="outline" className={meetingButtonClass} autoFocus onClick={() => setDiscardOpen(false)}>Keep editing</Button>
                        <Button type="button" variant="destructive" className={meetingButtonClass} onClick={() => {
                            if (!termId) return;
                            const clearingDraft = model.status === "draft";
                            flow.begin(() => setDiscardOpen(false), { title: "Saving draft\u2026", description: "Saving your request\u2026" }, clearingDraft ? "Draft discarded" : "Unpublished changes discarded", () => actions.discardDraft(termId));
                        }}>{model.status === "draft" ? "Discard draft" : "Discard changes"}</Button>
                    </MeetingFooter>
                </MeetingAlertContent>
            </AlertDialog>
            <AlertDialog open={leaveHref !== null} onOpenChange={(open) => { if (!open) setLeaveHref(null); }}>
                <MeetingAlertContent>
                    <MeetingHeader>
                        <AlertDialogTitle className="text-lg font-semibold leading-tight">You have unsaved changes</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-muted-foreground">Save this draft or discard your edits before leaving.</AlertDialogDescription>
                    </MeetingHeader>
                    <MeetingFooter>
                        <Button type="button" variant="outline" className={meetingButtonClass} autoFocus onClick={() => setLeaveHref(null)}>Keep editing</Button>
                        <Button type="button" variant="destructive" className={meetingButtonClass} onClick={() => { setEditor(baseline); if (leaveHref) go(leaveHref); }}>Discard edits</Button>
                        <Button type="button" className={meetingButtonClass} onClick={() => {
                            if (!termId || !leaveHref) return;
                            const href = leaveHref;
                            flow.begin(() => setLeaveHref(null), { title: "Saving draft\u2026", description: "Saving your request\u2026" }, "Draft saved", async () => {
                                const result = await actions.saveDraft(termId, editor);
                                if (result.ok) go(href);
                                return result;
                            });
                        }}>Save draft</Button>
                    </MeetingFooter>
                </MeetingAlertContent>
            </AlertDialog>
            {exception?.mode === "remove" ? (
                <AlertDialog open onOpenChange={(open) => { if (!open) setException(null); }}>
                    <MeetingAlertContent>
                        <MeetingHeader>
                            <AlertDialogTitle className="text-lg font-semibold leading-tight">Remove this time when you publish?</AlertDialogTitle>
                            <AlertDialogDescription className="text-sm text-muted-foreground">Students can still book this time until you publish. After you publish, this time will not be offered.</AlertDialogDescription>
                        </MeetingHeader>
                        <MeetingFooter>
                            <Button type="button" variant="outline" className={meetingButtonClass} autoFocus onClick={() => setException(null)}>Keep time</Button>
                            <Button type="button" className={meetingButtonClass} onClick={() => {
                                const row = exception.row;
                                setException(null);
                                removeWhenPublishing(row);
                            }}>Remove when I publish</Button>
                        </MeetingFooter>
                    </MeetingAlertContent>
                </AlertDialog>
            ) : null}
            {exception?.mode === "change" ? (
                <ChangeWhenPublishing
                    row={exception.row}
                    nowIso={nowIso}
                    onClose={() => setException(null)}
                    onSave={(next) => {
                        if (!termId) return;
                        const original = slotInterval(exception.row, nowIso);
                        if (!original) return;
                        const config = {
                            ...editor,
                            suppressions: [...editor.suppressions, original],
                            replacements: [...editor.replacements, { original, next }],
                        };
                        update(config);
                        save(termId, config, "Change saved in your draft");
                        setException(null);
                    }}
                />
            ) : null}
            {windowOpen ? <OneOffDialog open title="Add a window of times" description="This adds times students can book now. Students will see every session that fits inside this window." withEnd nowIso={nowIso} duration={model.publishedDuration ?? 30} onClose={() => setWindowOpen(false)} onSave={(value) => actions.addWindow({ ...value, end: value.end ?? value.start, termId: termId ?? "" })} begin={flow.begin} /> : null}
            {oneOpen ? <OneOffDialog open title="Add one time" description="This adds a time students can book now." nowIso={nowIso} duration={model.publishedDuration ?? 30} onClose={() => setOneOpen(false)} onSave={(value) => actions.addOne({ date: value.date, start: value.start, durationMinutes: value.durationMinutes, termId: termId ?? "" })} begin={flow.begin} /> : null}
        </section>
    );

    function save(id: string | null, config: ScheduleConfig, toast: string) {
        if (!id) return;
        flow.begin(() => undefined, { title: "Saving draft\u2026", description: "Saving your request\u2026" }, toast, async () => {
            const result = await actions.saveDraft(id, config);
            if (result.ok) setBaseline(config);
            return result;
        });
    }

    function removeWhenPublishing(row: AvailabilityRow) {
        if (!termId) return;
        const interval = slotInterval(row, nowIso);
        if (!interval) return;
        const next = { ...editor, suppressions: [...editor.suppressions, interval] };
        update(next);
        save(termId, next, "Removal saved in your draft");
    }

    function pendingInEditor(row: AvailabilityRow) {
        const interval = slotInterval(row, nowIso);
        if (!interval) return false;
        return editor.suppressions.some((item) => item.startsAt === interval.startsAt && item.endsAt === interval.endsAt)
            || editor.replacements.some((item) => item.original.startsAt === interval.startsAt && item.original.endsAt === interval.endsAt);
    }

    function viewTime(item: ReviewItem) {
        setReview(null);
        if (item.startsAt) {
            setDateFilter(civilDateValue(new Date(item.startsAt)));
            setPage(0);
        }
        window.setTimeout(() => {
            const node = document.getElementById(`time-${item.id}`);
            node?.scrollIntoView({ block: "center" });
            if (node instanceof HTMLElement) node.focus();
        }, 0);
    }
}

function DetailList({ label, items }: { label: string; items: ScheduleReview["sections"][number]["items"] }) {
    const [open, setOpen] = useState(false);
    const [page, setPage] = useState(0);
    const visible = items.slice(page * pageSize, page * pageSize + pageSize);
    const start = items.length === 0 ? 0 : page * pageSize + 1;
    const end = page * pageSize + visible.length;
    return (
        <div className="flex flex-col gap-2">
            <Button type="button" variant="outline" className="h-11 justify-start" aria-expanded={open} onClick={() => setOpen((current) => !current)}>{label}</Button>
            {open ? (
                <>
                    <p className="text-sm tabular-nums text-muted-foreground">Showing {start}{"\u2013"}{end} of {items.length}</p>
                    {visible.map((item) => (
                        <p key={item.id} className="text-sm">{item.fullTimestamp}. {item.sourceLabel}{item.studentName ? `. ${item.studentName}` : ""}{item.note ? ` ${item.note}` : ""}</p>
                    ))}
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" className="h-11" disabled={page === 0} onClick={() => setPage((current) => current - 1)}>Previous</Button>
                        <Button type="button" variant="outline" className="h-11" disabled={end >= items.length} onClick={() => setPage((current) => current + 1)}>Next</Button>
                    </div>
                </>
            ) : null}
        </div>
    );
}

function OneOffDialog({
    open,
    title,
    description,
    withEnd = false,
    nowIso,
    duration,
    onClose,
    onSave,
    begin,
}: {
    open: boolean;
    title: string;
    description: string;
    withEnd?: boolean;
    nowIso: string;
    duration: number;
    onClose: () => void;
    onSave: (value: { date: string; start: string; end?: string; durationMinutes: number }) => Promise<MeetingResult>;
    begin: ReturnType<typeof useMeetingAction>["begin"];
}) {
    const [date, setDate] = useState("");
    const [start, setStart] = useState("14:00");
    const [end, setEnd] = useState("15:00");
    const [length, setLength] = useState(String(duration));
    const [problem, setProblem] = useState<{ title: string; description: string } | null>(null);
    return (
        <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
            <MeetingFormContent>
                <MeetingFormHeader>
                    <DialogTitle className="text-lg font-semibold leading-tight">{title}</DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground">{description}</DialogDescription>
                </MeetingFormHeader>
                <div className="flex flex-col gap-4 px-6 pb-4">
                    {problem ? <DismissibleAlert stacked title={problem.title} description={problem.description} /> : null}
                    <DateField id={`${title}-date`} label="Date" value={date || null} onChange={(value) => setDate(value ?? "")} />
                    <ClockField id={`${title}-start`} label="Start time" value={start} onChange={setStart} />
                    {withEnd ? <ClockField id={`${title}-end`} label="End time" value={end} onChange={setEnd} /> : null}
                    <Field>
                        <FieldLabel htmlFor={`${title}-length`}>Session length</FieldLabel>
                        <Select value={length} onValueChange={(value) => { if (value) setLength(value); }}>
                            <SelectTrigger id={`${title}-length`} className="h-11 w-full"><SelectValue>{durationLabel(Number(length))}</SelectValue></SelectTrigger>
                            <SelectContent><SelectGroup>{MEETING_DURATIONS.map((minutes) => <SelectItem key={minutes} value={String(minutes)}>{durationLabel(minutes)}</SelectItem>)}</SelectGroup></SelectContent>
                        </Select>
                    </Field>
                </div>
                <MeetingFormFooter>
                    <Button type="button" variant="outline" className={meetingButtonClass} onClick={onClose}>Cancel</Button>
                    <Button type="button" className={meetingButtonClass} onClick={() => {
                        const minutes = Number(length);
                        const result = withEnd
                            ? buildWindowSlots({ date, start, end, durationMinutes: minutes, now: new Date() })
                            : buildSingleSlot({ date, start, durationMinutes: minutes, now: new Date() });
                        if (!result.ok) {
                            setProblem(issueCopy(result.issue, minutes, formatClockValue(start), formatClockValue(end)));
                            return;
                        }
                        begin(onClose, { title: withEnd ? "Adding times\u2026" : "Adding time\u2026", description: "Saving your request\u2026" }, withEnd ? "Times added" : "Time added", () => onSave({ date, start, end, durationMinutes: minutes }));
                    }}>{withEnd ? "Add times" : "Add time"}</Button>
                </MeetingFormFooter>
            </MeetingFormContent>
        </Dialog>
    );
}

function ChangeWhenPublishing({
    row,
    nowIso,
    onClose,
    onSave,
}: {
    row: AvailabilityRow;
    nowIso: string;
    onClose: () => void;
    onSave: (next: { startsAt: string; endsAt: string }) => void;
}) {
    const [date, setDate] = useState(row.dateValue);
    const [start, setStart] = useState(row.startValue);
    const [end, setEnd] = useState(plusClock(row.startValue, row.durationMinutes));
    const [endEdited, setEndEdited] = useState(false);
    const [problem, setProblem] = useState<{ title: string; description: string } | null>(null);
    const minutes = endEdited ? clockSpan(start, end) : row.durationMinutes;
    return (
        <AlertDialog open onOpenChange={(open) => { if (!open) onClose(); }}>
            <MeetingAlertContent>
                <MeetingHeader>
                    <AlertDialogTitle className="text-lg font-semibold leading-tight">Change this time when you publish?</AlertDialogTitle>
                    <AlertDialogDescription className="text-sm text-muted-foreground">Students can still book the original time until you publish.</AlertDialogDescription>
                </MeetingHeader>
                <div className="flex flex-col gap-4 px-6 pb-4">
                    {problem ? <DismissibleAlert stacked title={problem.title} description={problem.description} /> : null}
                    <DateField id="change-date" label="Date" value={date || null} onChange={(value) => setDate(value ?? "")} />
                    <ClockField id="change-start" label="Start time" value={start} onChange={(value) => {
                        setStart(value);
                        if (!endEdited) setEnd(plusClock(value, row.durationMinutes));
                    }} />
                    <ClockField id="change-end" label="End time" value={end} onChange={(value) => { setEndEdited(true); setEnd(value); }} />
                </div>
                <MeetingFooter>
                    <Button type="button" variant="outline" className={meetingButtonClass} autoFocus onClick={onClose}>Keep time</Button>
                    <Button type="button" className={meetingButtonClass} onClick={() => {
                        const built = buildSingleSlot({
                            date,
                            start,
                            durationMinutes: minutes,
                            now: new Date(nowIso),
                            horizonMs: 400 * 24 * 60 * 60 * 1000,
                        });
                        if (!built.ok) {
                            setProblem(issueCopy(built.issue, minutes, formatClockValue(start), formatClockValue(end)));
                            return;
                        }
                        onSave({ startsAt: built.slot.startsAt.toISOString(), endsAt: built.slot.endsAt.toISOString() });
                    }}>Save in draft</Button>
                </MeetingFooter>
            </MeetingAlertContent>
        </AlertDialog>
    );
}

function generated(row: AvailabilityRow) {
    return row.sourceLabel === "Weekly hours" || row.sourceLabel === "Changed time";
}

function slotInterval(row: AvailabilityRow, nowIso: string) {
    const built = buildSingleSlot({
        date: row.dateValue,
        start: row.startValue,
        durationMinutes: row.durationMinutes,
        now: new Date(nowIso),
        horizonMs: 400 * 24 * 60 * 60 * 1000,
    });
    if (!built.ok) return null;
    return { startsAt: built.slot.startsAt.toISOString(), endsAt: built.slot.endsAt.toISOString() };
}

function plusClock(start: string, minutes: number) {
    const [hour, minute] = start.split(":").map(Number);
    const total = (hour ?? 0) * 60 + (minute ?? 0) + minutes;
    return clockValue(Math.floor(total / 60) % 24, ((total % 60) + 60) % 60);
}

function clockSpan(start: string, end: string) {
    const [startHour, startMinute] = start.split(":").map(Number);
    const [endHour, endMinute] = end.split(":").map(Number);
    return ((endHour ?? 0) * 60 + (endMinute ?? 0)) - ((startHour ?? 0) * 60 + (startMinute ?? 0));
}

function DateField({ id, label, value, disabled, onChange }: { id: string; label: string; value: string | null; disabled?: boolean; onChange: (value: string | null) => void }) {
    const [open, setOpen] = useState(false);
    return (
        <Field>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger render={<Button type="button" id={id} variant="outline" className="h-11 justify-start" disabled={disabled} />}>
                    {value ? civilDateLabel(value) : "Choose a date"}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={value ? dateFromValue(value) : undefined} onSelect={(day) => { if (day) { onChange(dateValue(day)); setOpen(false); } }} />
                </PopoverContent>
            </Popover>
        </Field>
    );
}

function ClockField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
    return (
        <Field>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <Select value={value} onValueChange={(next) => { if (next) onChange(next); }}>
                <SelectTrigger id={id} className="h-11 w-full"><SelectValue>{formatClockValue(value)}</SelectValue></SelectTrigger>
                <SelectContent><SelectGroup>{choices.map((choice) => <SelectItem key={choice.value} value={choice.value}>{choice.label}</SelectItem>)}</SelectGroup></SelectContent>
            </Select>
        </Field>
    );
}

function changeWindow(config: ScheduleConfig, dayIndex: number, windowIndex: number, next: { start: string; end: string } | null): ScheduleConfig {
    return {
        ...config,
        weekdays: config.weekdays.map((day, index) => {
            if (index !== dayIndex) return day;
            const windows = next ? day.windows.map((window, cursor) => cursor === windowIndex ? next : window) : day.windows.filter((_, cursor) => cursor !== windowIndex);
            return { ...day, windows };
        }),
    };
}

function isListed(minutes: number) {
    return (MEETING_DURATIONS as readonly number[]).includes(minutes);
}

function dateValue(day: Date) {
    return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
}

function dateFromValue(value: string) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year ?? 2026, (month ?? 1) - 1, day ?? 1);
}

export function appointmentsHref(search: string, changes: Record<string, string | null>) {
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    for (const [key, value] of Object.entries(changes)) {
        if (value === null) params.delete(key);
        else params.set(key, value);
    }
    if (!params.get("view") && [...params.keys()].length > 0) params.set("view", "sessions");
    if (params.get("view") === "sessions" && [...params.keys()].every((key) => key === "view")) params.delete("view");
    const text = params.toString();
    return text ? `/advisor/appointments?${text}` : "/advisor/appointments";
}
