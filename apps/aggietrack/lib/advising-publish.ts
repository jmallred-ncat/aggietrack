import { Prisma, type PrismaClient } from "./generated/prisma/client";
import { academicTermLabel, semesterInSession } from "./academic-term";
import {
    buildReview,
    canonicalSchedule,
    coversExactInterval,
    emptySchedule,
    parseScheduleConfig,
    schedulesEqual,
    statusHelper,
    statusKind,
    statusLabel,
    termEnded,
    termRunLabel,
    type LiveSlot,
    type ScheduleConfig,
    type ScheduleReview,
} from "./advising-schedule";
import { LEAD_TIME_MS, civilDateLabel, civilDateValue, clockValue, durationLabel, easternParts, isMeetingDuration, meetingStamp } from "./advising-time";
import type { AdvisorAvailabilityModel, AvailabilityRow, MeetingResult } from "./advising-types";
import { personName } from "./plan-status";

type Db = PrismaClient;
type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

class ScheduleRefusal extends Error {
    constructor(readonly failure: Extract<MeetingResult, { ok: false }>) {
        super(failure.title);
    }
}

function fail(code: string, title: string, description: string, review?: ScheduleReview, field?: string): Extract<MeetingResult, { ok: false }> {
    return { ok: false, code, title, description, review, field };
}

async function withLocks<T>(db: Db, keys: string[], run: (tx: Tx) => Promise<T>): Promise<T> {
    const sorted = [...new Set(keys)].sort();
    let last: unknown;
    for (let attempt = 0; attempt < 8; attempt += 1) {
        try {
            return await db.$transaction(async (tx) => {
                for (const key of sorted) {
                    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtextextended($1, 0::bigint))", key);
                }
                return await run(tx);
            }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20_000 });
        } catch (error) {
            if (error instanceof ScheduleRefusal) throw error;
            last = error;
            const message = error instanceof Error ? error.message : "";
            const code = error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "";
            const meta = error && typeof error === "object" && "meta" in error && error.meta && typeof error.meta === "object" ? error.meta : null;
            const metaCode = meta && "code" in meta && typeof meta.code === "string" ? meta.code : "";
            const retry = /23P01|40001|40P01|P2034/.test(`${code} ${metaCode} ${message}`);
            if (!retry || attempt === 7) throw error;
            await new Promise((resolve) => setTimeout(resolve, Math.min(400, 40 * 2 ** attempt)));
        }
    }
    throw last;
}

async function settle(run: () => Promise<MeetingResult>): Promise<MeetingResult> {
    try {
        return await run();
    } catch (error) {
        if (error instanceof ScheduleRefusal) return error.failure;
        return fail("failed", "Schedule could not be published. Try again.", "Try again.");
    }
}

function liveSlot(slot: {
    id: string;
    startsAt: Date;
    endsAt: Date;
    durationMinutes: number;
    status: "OPEN" | "BOOKED";
    source: LiveSlot["source"];
    termId: string | null;
    term: { season: Parameters<typeof academicTermLabel>[0]["season"]; year: number } | null;
    session: { id: string; studentId: string; student: { user: { firstName: string; lastName: string; name: string } } } | null;
}): LiveSlot {
    return {
        id: slot.id,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        durationMinutes: slot.durationMinutes,
        status: slot.status,
        source: slot.source,
        termId: slot.termId,
        termLabel: slot.term ? academicTermLabel(slot.term) : null,
        studentName: slot.session ? personName(slot.session.student.user) : null,
        studentId: slot.session?.studentId ?? null,
        sessionId: slot.session?.id ?? null,
    };
}

const slotInclude = {
    term: { select: { season: true, year: true } },
    session: { include: { student: { include: { user: { select: { firstName: true, lastName: true, name: true } } } } } },
} as const;

export async function loadAdvisorAvailability(db: Db, userId: string, now = new Date(), termId?: string | null): Promise<AdvisorAvailabilityModel> {
    const [terms, schedules, drafts, slots] = await Promise.all([
        db.academicTerm.findMany({ orderBy: [{ startsOn: "asc" }, { year: "asc" }] }),
        db.advisorTermSchedule.findMany({ where: { advisorId: userId } }),
        db.advisorTermDraft.findMany({ where: { advisorId: userId } }),
        db.meetingAvailability.findMany({
            where: { advisorId: userId, status: "OPEN", endsAt: { gt: now } },
            include: slotInclude,
            orderBy: { startsAt: "asc" },
        }),
    ]);
    const open = terms.filter((term) => !termEnded(civilDateValue(term.endsOn), now));
    const current = semesterInSession(open, now);
    const selected = open.find((term) => term.id === termId) ?? current ?? open[0] ?? null;
    const bounds = selected ? { startsOn: civilDateValue(selected.startsOn), endsOn: civilDateValue(selected.endsOn) } : null;
    const publishedRow = selected ? schedules.find((row) => row.termId === selected.id) ?? null : null;
    const draftRow = selected ? drafts.find((row) => row.termId === selected.id) ?? null : null;
    const published = publishedRow ? parseScheduleConfig(publishedRow.config) : null;
    const draft = draftRow ? parseScheduleConfig(draftRow.config) : null;
    const status = statusKind(published, draft);
    const config = draft ?? published ?? emptySchedule(bounds);
    const draftConfig = draft;
    return {
        terms: open.map((term) => {
            const startsOn = civilDateValue(term.startsOn);
            const endsOn = civilDateValue(term.endsOn);
            const label = academicTermLabel(term);
            return { id: term.id, label, startsOn, endsOn, runLabel: termRunLabel(label, startsOn, endsOn) };
        }),
        selectedTermId: selected?.id ?? null,
        status,
        statusLabel: status ? statusLabel(status) : null,
        statusHelper: status ? statusHelper(status) : null,
        config,
        publishedDuration: published ? published.durationMinutes : null,
        datesUnavailable: false,
        runLabel: bounds ? termRunLabel(selected ? academicTermLabel(selected) : "", bounds.startsOn, bounds.endsOn) : null,
        revision: `${selected?.id ?? "none"}:${publishedRow?.version ?? 0}:${draftRow?.updatedAt.toISOString() ?? "none"}`,
        openTimes: slots.map((slot) => openRow(slot, selected?.id ?? null, draftConfig)),
    };
}

export async function saveTermDraft(db: Db, userId: string, termId: string, input: ScheduleConfig): Promise<MeetingResult> {
    const config = parseScheduleConfig(input);
    if (!config) return fail("validation", "Draft could not be saved. Try again.", "Try again.");
    if (!isMeetingDuration(config.durationMinutes)) {
        return fail("validation", "Choose a session length", "Pick 15, 20, 30, 45, or 60 minutes.");
    }
    try {
        return await withLocks(db, [`advisor:${userId}`], async (tx) => {
            const advisor = await tx.user.findUnique({ where: { id: userId } });
            if (!advisor || advisor.role !== "ADVISOR") throw new ScheduleRefusal(fail("unavailable", "This session is unavailable", "It does not exist or you do not have access to it."));
            const term = await tx.academicTerm.findUnique({ where: { id: termId } });
            if (!term || termEnded(civilDateValue(term.endsOn), new Date())) {
                throw new ScheduleRefusal(fail("validation", "Choose a semester", "Pick the semester these hours belong to."));
            }
            const published = await tx.advisorTermSchedule.findUnique({ where: { advisorId_termId: { advisorId: userId, termId } } });
            const publishedConfig = published ? parseScheduleConfig(published.config) : null;
            if (publishedConfig && schedulesEqual(publishedConfig, config)) {
                await tx.advisorTermDraft.deleteMany({ where: { advisorId: userId, termId } });
                return { ok: true as const };
            }
            await tx.advisorTermDraft.upsert({
                where: { advisorId_termId: { advisorId: userId, termId } },
                create: { advisorId: userId, termId, config: canonicalSchedule(config) },
                update: { config: canonicalSchedule(config), version: { increment: 1 } },
            });
            return { ok: true as const };
        });
    } catch (error) {
        if (error instanceof ScheduleRefusal) return error.failure;
        return fail("failed", "Draft could not be saved. Try again.", "Try again.");
    }
}

export async function discardTermDraft(db: Db, userId: string, termId: string): Promise<MeetingResult> {
    try {
        return await withLocks(db, [`advisor:${userId}`], async (tx) => {
            const advisor = await tx.user.findUnique({ where: { id: userId } });
            if (!advisor || advisor.role !== "ADVISOR") throw new ScheduleRefusal(fail("unavailable", "This session is unavailable", "It does not exist or you do not have access to it."));
            await tx.advisorTermDraft.deleteMany({ where: { advisorId: userId, termId } });
            return { ok: true as const };
        });
    } catch (error) {
        if (error instanceof ScheduleRefusal) return error.failure;
        return fail("failed", "Draft could not be saved. Try again.", "Try again.");
    }
}

export async function reviewTerm(db: Db, userId: string, termId: string, input: ScheduleConfig, now = new Date()): Promise<MeetingResult> {
    const parsed = parseScheduleConfig(input);
    if (!parsed) return fail("validation", "Draft could not be saved. Try again.", "Try again.");
    try {
        return await withLocks(db, [`advisor:${userId}`], async (tx) => {
            const context = await loadContext(tx, userId, termId, now);
            const reviewed = buildReview({ ...context, config: parsed, now });
            if (!reviewed.ok) throw new ScheduleRefusal(fail("validation", reviewed.title, reviewed.description, undefined, reviewed.field));
            await tx.advisorTermDraft.upsert({
                where: { advisorId_termId: { advisorId: userId, termId } },
                create: { advisorId: userId, termId, config: canonicalSchedule(parsed) },
                update: { config: canonicalSchedule(parsed), version: { increment: 1 } },
            });
            const again = await loadContext(tx, userId, termId, now);
            const fresh = buildReview({ ...again, config: parsed, now });
            if (!fresh.ok) throw new ScheduleRefusal(fail("validation", fresh.title, fresh.description));
            return { ok: false as const, code: "review", title: "Review and publish?", description: `Publishing updates the times students can book for ${again.term.label}. Booked sessions stay as they are.`, review: fresh.review };
        });
    } catch (error) {
        if (error instanceof ScheduleRefusal) return error.failure;
        return fail("failed", "Draft could not be saved. Try again.", "Try again.");
    }
}

export async function publishTerm(db: Db, userId: string, termId: string, token: string, now = new Date()): Promise<MeetingResult> {
    const result = await settle(() => withLocks(db, [`advisor:${userId}`], async (tx) => {
        const draft = await tx.advisorTermDraft.findUnique({ where: { advisorId_termId: { advisorId: userId, termId } } });
        const config = draft ? parseScheduleConfig(draft.config) : null;
        if (!config) throw new ScheduleRefusal(fail("failed", "Schedule could not be published. Try again.", "Try again."));
        const context = await loadContext(tx, userId, termId, now);
        const reviewed = buildReview({ ...context, config, now });
        if (!reviewed.ok) throw new ScheduleRefusal(fail("validation", reviewed.title, reviewed.description));
        if (reviewed.review.blocking.length > 0) {
            const block = reviewed.review.blocking[0];
            throw new ScheduleRefusal(fail("blocked", block?.title ?? "Schedule could not be published. Try again.", block?.description ?? "Try again.", reviewed.review));
        }
        if (reviewed.review.token !== token) {
            throw new ScheduleRefusal(fail(
                "stale",
                "Review these changes again",
                "Bookings or hours changed since you opened this review. Nothing was published. Check the updated counts and publish again if they look right.",
                { ...reviewed.review, stale: true },
            ));
        }
        const version = context.publishedVersion + 1;
        await tx.advisorTermSchedule.upsert({
            where: { advisorId_termId: { advisorId: userId, termId } },
            create: { advisorId: userId, termId, config: canonicalSchedule(config), version },
            update: { config: canonicalSchedule(config), version, publishedAt: now },
        });
        if (reviewed.review.plan.removeIds.length > 0) {
            const removed = await tx.meetingAvailability.deleteMany({
                where: { id: { in: reviewed.review.plan.removeIds }, advisorId: userId, termId, status: "OPEN" },
            });
            if (removed.count !== reviewed.review.plan.removeIds.length) {
                throw new ScheduleRefusal(fail("stale", "Review these changes again", "Bookings or hours changed since you opened this review. Nothing was published. Check the updated counts and publish again if they look right."));
            }
        }
        if (reviewed.review.plan.adds.length > 0) {
            await tx.meetingAvailability.createMany({
                data: reviewed.review.plan.adds.map((slot) => ({
                    advisorId: userId,
                    termId,
                    startsAt: new Date(slot.startsAt),
                    endsAt: new Date(slot.endsAt),
                    durationMinutes: slot.durationMinutes,
                    status: "OPEN" as const,
                    source: slot.source,
                })),
            });
        }
        await tx.advisorTermDraft.deleteMany({ where: { advisorId: userId, termId } });
        return { ok: true as const };
    }));
    if (!result.ok && result.code === "stale" && !result.review) {
        const draft = await db.advisorTermDraft.findUnique({ where: { advisorId_termId: { advisorId: userId, termId } } });
        const config = draft ? parseScheduleConfig(draft.config) : null;
        if (config) {
            const refreshed = await reviewTerm(db, userId, termId, config, now);
            if (!refreshed.ok && refreshed.review) {
                return { ...result, review: { ...refreshed.review, stale: true } };
            }
        }
    }
    return result;
}

export async function dateBlockedByPublished(tx: Tx, advisorId: string, date: string) {
    const schedules = await tx.advisorTermSchedule.findMany({ where: { advisorId }, include: { term: true } });
    for (const schedule of schedules) {
        const config = parseScheduleConfig(schedule.config);
        if (!config?.unavailableDates.includes(date)) continue;
        return { label: academicTermLabel(schedule.term), dateLabel: civilDateLabel(date) };
    }
    return null;
}

export async function publishedCoversSlot(tx: Tx, slot: { advisorId: string; startsAt: Date; endsAt: Date; source: LiveSlot["source"]; termId: string | null }, now: Date) {
    if (slot.startsAt.getTime() < now.getTime() + LEAD_TIME_MS) return false;
    const date = civilDateValue(slot.startsAt);
    if (await dateBlockedByPublished(tx, slot.advisorId, date)) return false;
    if (slot.source === "MANUAL" || slot.source === "MANUAL_WINDOW") return true;
    if (!slot.termId) return false;
    const published = await tx.advisorTermSchedule.findUnique({ where: { advisorId_termId: { advisorId: slot.advisorId, termId: slot.termId } } });
    const config = published ? parseScheduleConfig(published.config) : null;
    if (!config) return false;
    return coversExactInterval(config, slot.startsAt, slot.endsAt, now);
}

async function loadContext(tx: Tx, userId: string, termId: string, now: Date) {
    const advisor = await tx.user.findUnique({ where: { id: userId } });
    if (!advisor || advisor.role !== "ADVISOR") throw new ScheduleRefusal(fail("unavailable", "This session is unavailable", "It does not exist or you do not have access to it."));
    const term = await tx.academicTerm.findUnique({ where: { id: termId } });
    if (!term) throw new ScheduleRefusal(fail("validation", "Choose a semester", "Pick the semester these hours belong to."));
    const [schedules, slots] = await Promise.all([
        tx.advisorTermSchedule.findMany({ where: { advisorId: userId }, include: { term: true } }),
        tx.meetingAvailability.findMany({ where: { advisorId: userId }, include: slotInclude }),
    ]);
    const published = schedules.find((row) => row.termId === termId) ?? null;
    const otherBlocks = schedules.flatMap((row) => {
        if (row.termId === termId) return [];
        const config = parseScheduleConfig(row.config);
        if (!config?.unavailableDates.length) return [];
        return [{ termId: row.termId, label: academicTermLabel(row.term), dates: config.unavailableDates }];
    });
    return {
        term: {
            id: term.id,
            label: academicTermLabel(term),
            startsOn: civilDateValue(term.startsOn),
            endsOn: civilDateValue(term.endsOn),
        },
        hasPublished: Boolean(published && parseScheduleConfig(published.config)),
        publishedVersion: published?.version ?? 0,
        slots: slots.map((slot) => liveSlot(slot)),
        otherBlocks,
    };
}

function openRow(slot: {
    id: string;
    startsAt: Date;
    endsAt: Date;
    durationMinutes: number;
    source: LiveSlot["source"];
    termId: string | null;
    term: { season: Parameters<typeof academicTermLabel>[0]["season"]; year: number } | null;
}, termId: string | null, draft: ScheduleConfig | null): AvailabilityRow {
    const stamp = meetingStamp(slot.startsAt, slot.endsAt);
    const parts = easternParts(slot.startsAt);
    const pending = pendingLabel(slot, termId, draft);
    const sourceLabel = slot.source === "MANUAL_WINDOW"
        ? "Added as a window"
        : slot.source === "MANUAL"
            ? "Added as a single time"
            : slot.source === "TERM_OVERRIDE"
                ? "Changed time"
                : slot.termId && termId && slot.termId !== termId
                    ? `Published in ${slot.term ? academicTermLabel(slot.term) : "another semester"}`
                    : "Weekly hours";
    return {
        id: slot.id,
        dateLabel: stamp.dateHeading,
        timeLabel: stamp.time,
        fullTimestamp: stamp.full,
        durationLabel: durationLabel(slot.durationMinutes),
        durationMinutes: slot.durationMinutes,
        dateValue: civilDateValue(slot.startsAt),
        startValue: clockValue(parts.hour, parts.minute),
        statusLabel: "Open",
        statusTone: "outline",
        studentName: null,
        sessionId: null,
        canChange: true,
        pendingLabel: pending,
        sourceLabel,
        inventory: slot.source === "MANUAL" || slot.source === "MANUAL_WINDOW" ? "manual" : slot.termId === termId ? "this" : "other",
    };
}

function pendingLabel(slot: { startsAt: Date; endsAt: Date; termId: string | null; source: LiveSlot["source"] }, termId: string | null, draft: ScheduleConfig | null) {
    if (!draft || !termId || slot.termId !== termId) return null;
    if (slot.source !== "TERM_PATTERN" && slot.source !== "TERM_OVERRIDE") return null;
    const start = slot.startsAt.toISOString();
    const end = slot.endsAt.toISOString();
    if (draft.replacements.some((item) => item.original.startsAt === start && item.original.endsAt === end)) return "Will change";
    if (draft.suppressions.some((item) => item.startsAt === start && item.endsAt === end)) return "Will be removed";
    return null;
}

export function draftFailureTitle(kind: "save" | "publish") {
    return kind === "save" ? "Draft could not be saved. Try again." : "Schedule could not be published. Try again.";
}
