import { Prisma, type PrismaClient } from "./generated/prisma/client";
import {
    ADVISOR_HORIZON_MS,
    CANCELED_VISIBLE_MS,
    LEAD_TIME_MS,
    PAST_SESSION_LIMIT,
    STUDENT_HORIZON_MS,
    buildSingleSlot,
    buildWindowSlots,
    civilDateValue,
    clockValue,
    durationLabel,
    easternParts,
    isMeetingDuration,
    issueCopy,
    meetingStamp,
    pointStamp,
    rangesOverlap,
    type SlotDraft,
} from "./advising-time";
import type {
    AdvisorAppointmentsView,
    AvailabilityRow,
    MeetingCard,
    MeetingFailure,
    MeetingNotice,
    MeetingResult,
    OpenSlotChoice,
    StudentAdvisingView,
    UpcomingAdvising,
} from "./advising-types";
import { dateBlockedByPublished, loadAdvisorAvailability, publishedCoversSlot } from "./advising-publish";
import { parseScheduleConfig } from "./advising-schedule";
import { academicTermLabel } from "./academic-term";
import { normalizeZoomUrl, zoomFailure } from "./advising-zoom";
import { personName } from "./plan-status";

type Db = PrismaClient;
type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

const NOTE_LIMIT = 2000;

class MeetingRefusal extends Error {
    constructor(readonly failure: MeetingFailure) {
        super(failure.title);
    }
}

function failure(code: string, title: string, description: string, sessionId?: string): MeetingFailure {
    return { ok: false, code, title, description, sessionId };
}

const signedOut = () => failure("signed-out", "Sign in to continue", "Your session ended. Sign in again before making changes.");
const unavailable = () => failure("unavailable", "This session is unavailable", "It does not exist or you do not have access to it.");
const stale = () => failure("stale", "That time is no longer open", "Someone booked it, or it was removed. Pick another time.");
const openOverlap = () => failure("overlap", "This overlaps another open time", "Change the start or end so it does not cover a time you already added.");
const sessionOverlap = () => failure("overlap", "That time overlaps another session", "Choose a time that does not overlap a session you already have.");
const rescheduleFailed = () => failure("reschedule", "Session could not be rescheduled", "Your original time is unchanged.");
const noteRequired = (description: string) => failure("note", "Add a note", description);
const noteTooLong = () => failure("note-long", "Note is too long", "Keep your note to 2,000 characters or fewer.");
const saveFailed = () => failure("failed", "Something did not save. Try again.", "Try again.");

function isRetryable(error: unknown) {
    const code = postgresState(error);
    return code === "40001" || code === "40P01" || code === "P2034";
}

function isExclusion(error: unknown) {
    return postgresState(error) === "23P01";
}

function postgresState(error: unknown) {
    if (!error || typeof error !== "object") return "";
    const code = "code" in error && typeof error.code === "string" ? error.code : "";
    if (code === "P2034" || code === "23P01" || code === "40001" || code === "40P01") return code;
    const message = "message" in error && typeof error.message === "string" ? error.message : "";
    const meta = "meta" in error && error.meta && typeof error.meta === "object" ? error.meta : null;
    const metaCode = meta && "code" in meta && typeof meta.code === "string" ? meta.code : "";
    return metaCode || (message.match(/23P01|40001|40P01|P2034/)?.[0] ?? "");
}

async function withLocks<T>(db: Db, keys: string[], run: (tx: Tx) => Promise<T>): Promise<T> {
    const sorted = [...new Set(keys)].sort();
    let last: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            return await db.$transaction(async (tx) => {
                for (const key of sorted) {
                    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtextextended($1, 0::bigint))", key);
                }
                return await run(tx);
            }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20_000 });
        } catch (error) {
            if (error instanceof MeetingRefusal) throw error;
            last = error;
            if (!isRetryable(error) || attempt === 2) throw error;
        }
    }
    throw last;
}

async function settle(run: () => Promise<MeetingResult>, onConflict: MeetingFailure = sessionOverlap()): Promise<MeetingResult> {
    try {
        return await run();
    } catch (error) {
        if (error instanceof MeetingRefusal) return error.failure;
        if (isExclusion(error)) return onConflict;
        return saveFailed();
    }
}

function cleanNote(value: string | null | undefined, required: boolean, requiredDescription: string) {
    const note = (value ?? "").trim();
    if (required && !note) throw new MeetingRefusal(noteRequired(requiredDescription));
    if (note.length > NOTE_LIMIT) throw new MeetingRefusal(noteTooLong());
    return note || null;
}

function roleLabel(role: string) {
    if (role === "STUDENT") return "Student";
    if (role === "ADVISOR") return "Advisor";
    return "";
}

function phraseFor(kind: string, name: string) {
    switch (kind) {
        case "BOOKED":
            return `${name} booked this session.`;
        case "CANCELED":
            return `${name} canceled this session.`;
        case "RESCHEDULED":
            return `${name} rescheduled this session.`;
        case "ZOOM_ADDED":
            return `${name} added a Zoom link.`;
        case "ZOOM_UPDATED":
            return `${name} updated the Zoom link.`;
        case "ZOOM_REMOVED":
            return `${name} removed the Zoom link.`;
        default:
            return null;
    }
}

type SessionRow = {
    id: string;
    startsAt: Date;
    endsAt: Date;
    durationMinutes: number;
    status: string;
    zoomUrl: string | null;
    advisor: { firstName: string | null; lastName: string | null; name: string | null };
    student: { user: { firstName: string | null; lastName: string | null; name: string | null } };
    events: Array<{
        id: string;
        actorName: string;
        actorRole: string;
        kind: string;
        body: string | null;
        fromStartsAt: Date | null;
        fromEndsAt: Date | null;
        toStartsAt: Date | null;
        toEndsAt: Date | null;
        createdAt: Date;
    }>;
};

function instantFrom(stamp: ReturnType<typeof meetingStamp>, instant: Date) {
    return { dateLabel: stamp.date, timeLabel: stamp.time, iso: instant.toISOString(), full: stamp.full };
}

function toCard(row: SessionRow, viewer: "student" | "advisor", now: Date): MeetingCard {
    const stamp = meetingStamp(row.startsAt, row.endsAt);
    const ended = row.endsAt.getTime() <= now.getTime();
    const started = row.startsAt.getTime() <= now.getTime();
    let statusLabel: MeetingCard["statusLabel"] = "Status unavailable";
    let statusTone: MeetingCard["statusTone"] = "outline";
    if (row.status === "CANCELED") {
        statusLabel = "Canceled";
    } else if (row.status === "CONFIRMED" && ended) {
        statusLabel = "Past";
    } else if (row.status === "CONFIRMED") {
        statusLabel = "Confirmed";
        statusTone = "default";
    }
    const zoom = row.zoomUrl ? normalizeZoomUrl(row.zoomUrl) : null;
    const notices: MeetingNotice[] = [];
    for (const event of row.events) {
        const phrase = phraseFor(event.kind, event.actorName);
        if (!phrase) continue;
        const eventStamp = pointStamp(event.createdAt);
        const moved = event.kind === "RESCHEDULED" && event.fromStartsAt && event.fromEndsAt && event.toStartsAt && event.toEndsAt;
        notices.push({
            id: event.id,
            name: event.actorName,
            roleLabel: roleLabel(event.actorRole),
            phrase,
            support: null,
            body: event.body,
            dateLabel: eventStamp.date,
            timeLabel: eventStamp.time,
            iso: event.createdAt.toISOString(),
            from: moved ? instantFrom(meetingStamp(event.fromStartsAt!, event.fromEndsAt!), event.fromStartsAt!) : null,
            to: moved ? instantFrom(meetingStamp(event.toStartsAt!, event.toEndsAt!), event.toStartsAt!) : null,
        });
    }
    return {
        id: row.id,
        personName: personName(viewer === "student" ? row.advisor : row.student.user),
        statusLabel,
        statusTone,
        dateLabel: stamp.date,
        timeLabel: stamp.time,
        fullTimestamp: stamp.full,
        iso: row.startsAt.toISOString(),
        durationMinutes: row.durationMinutes,
        durationLabel: durationLabel(row.durationMinutes),
        zoomUrl: zoom?.ok ? zoom.url : null,
        canChange: row.status === "CONFIRMED" && !started,
        started: row.status === "CONFIRMED" && started && !ended,
        notices,
    };
}

const sessionInclude = {
    advisor: { select: { firstName: true, lastName: true, name: true } },
    student: { include: { user: { select: { firstName: true, lastName: true, name: true } } } },
    events: { orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }] },
};

function splitSessions(rows: SessionRow[], viewer: "student" | "advisor", now: Date) {
    const upcoming: MeetingCard[] = [];
    const canceled: MeetingCard[] = [];
    const earlier: MeetingCard[] = [];
    const past: SessionRow[] = [];
    for (const row of rows) {
        if (row.status === "CANCELED") {
            if (now.getTime() <= row.startsAt.getTime() + CANCELED_VISIBLE_MS) {
                canceled.push(toCard(row, viewer, now));
            }
            continue;
        }
        if (row.status === "CONFIRMED" && row.endsAt.getTime() > now.getTime()) {
            upcoming.push(toCard(row, viewer, now));
            continue;
        }
        if (row.status === "CONFIRMED") past.push(row);
    }
    upcoming.sort((left, right) => left.iso.localeCompare(right.iso));
    canceled.sort((left, right) => left.iso.localeCompare(right.iso));
    past.sort((left, right) => right.startsAt.getTime() - left.startsAt.getTime());
    for (const row of past.slice(0, PAST_SESSION_LIMIT)) earlier.push(toCard(row, viewer, now));
    return { upcoming, canceled, earlier };
}

function toSlot(slot: { id: string; startsAt: Date; endsAt: Date; durationMinutes: number }): OpenSlotChoice {
    const stamp = meetingStamp(slot.startsAt, slot.endsAt);
    const start = easternParts(slot.startsAt);
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return {
        id: slot.id,
        dateHeading: stamp.dateHeading,
        slotLabel: stamp.slotLabel,
        accessibleName: `${start.weekday}, ${months[start.month - 1]} ${start.day}, ${stamp.slotLabel.replace("–", " to ")} Eastern Time`,
        fullTimestamp: stamp.full,
        durationMinutes: slot.durationMinutes,
        durationLabel: durationLabel(slot.durationMinutes),
        iso: slot.startsAt.toISOString(),
    };
}

export async function loadStudentAdvising(db: Db, userId: string, now = new Date()): Promise<StudentAdvisingView | null> {
    const user = await db.user.findUnique({
        where: { id: userId },
        include: { studentProfile: { include: { advisor: { select: { id: true, firstName: true, lastName: true, name: true } } } } },
    });
    if (!user?.studentProfile || user.role !== "STUDENT") return null;
    const profile = user.studentProfile;
    const [sessions, slots, settings] = await Promise.all([
        db.meetingSession.findMany({
            where: { studentId: profile.id },
            include: sessionInclude,
        }),
        profile.advisorId
            ? db.meetingAvailability.findMany({
                where: {
                    advisorId: profile.advisorId,
                    status: "OPEN",
                    startsAt: { gte: new Date(now.getTime() + LEAD_TIME_MS), lte: new Date(now.getTime() + STUDENT_HORIZON_MS) },
                },
                orderBy: { startsAt: "asc" },
            })
            : Promise.resolve([]),
        profile.advisorId
            ? db.advisorMeetingSettings.findUnique({ where: { advisorId: profile.advisorId } })
            : Promise.resolve(null),
    ]);
    return {
        advisorName: profile.advisor ? personName(profile.advisor) : null,
        sessionMinutes: profile.advisorId ? (settings?.durationMinutes ?? 30) : null,
        slots: slots.map(toSlot),
        ...splitSessions(sessions, "student", now),
    };
}

export async function loadAdvisorAppointments(db: Db, userId: string, now = new Date(), termId?: string | null): Promise<AdvisorAppointmentsView | null> {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== "ADVISOR") return null;
    const [settings, slots, sessions] = await Promise.all([
        db.advisorMeetingSettings.findUnique({ where: { advisorId: userId } }),
        db.meetingAvailability.findMany({
            where: { advisorId: userId, endsAt: { gt: now } },
            include: { session: { include: { student: { include: { user: { select: { firstName: true, lastName: true, name: true } } } } } } },
            orderBy: { startsAt: "asc" },
        }),
        db.meetingSession.findMany({ where: { advisorId: userId }, include: sessionInclude }),
    ]);
    const rows: AvailabilityRow[] = slots.map((slot) => {
        const stamp = meetingStamp(slot.startsAt, slot.endsAt);
        const parts = easternParts(slot.startsAt);
        const booked = slot.status === "BOOKED";
        const known = slot.status === "OPEN" || slot.status === "BOOKED";
        return {
            id: slot.id,
            dateLabel: stamp.dateHeading,
            timeLabel: stamp.time,
            fullTimestamp: stamp.full,
            durationLabel: durationLabel(slot.durationMinutes),
            durationMinutes: slot.durationMinutes,
            dateValue: civilDateValue(slot.startsAt),
            startValue: clockValue(parts.hour, parts.minute),
            statusLabel: !known ? "Status unavailable" : booked ? "Booked" : "Open",
            statusTone: booked ? "default" : "outline",
            studentName: slot.session ? personName(slot.session.student.user) : null,
            sessionId: slot.session?.id ?? null,
            canChange: slot.status === "OPEN",
        };
    });
    return {
        durationMinutes: settings?.durationMinutes ?? 30,
        rows,
        availability: await loadAdvisorAvailability(db, userId, now, termId),
        ...splitSessions(sessions, "advisor", now),
    };
}

export async function studentUpcoming(db: Db, userId: string, now = new Date()): Promise<UpcomingAdvising | null> {
    const view = await loadStudentAdvising(db, userId, now);
    const first = view?.upcoming[0];
    if (!first) return null;
    return {
        id: first.id,
        personName: first.personName,
        dateLabel: first.dateLabel,
        timeLabel: first.timeLabel,
        iso: first.iso,
        durationLabel: first.durationLabel,
    };
}

export async function advisorUpcoming(db: Db, userId: string, now = new Date()): Promise<UpcomingAdvising[]> {
    const view = await loadAdvisorAppointments(db, userId, now);
    return (view?.upcoming ?? []).map((card) => ({
        id: card.id,
        personName: card.personName,
        dateLabel: card.dateLabel,
        timeLabel: card.timeLabel,
        iso: card.iso,
        durationLabel: card.durationLabel,
    }));
}

async function requireAdvisor(tx: Tx, userId: string) {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new MeetingRefusal(signedOut());
    if (user.role !== "ADVISOR") throw new MeetingRefusal(unavailable());
    return user;
}

async function requireStudent(tx: Tx, userId: string) {
    const user = await tx.user.findUnique({
        where: { id: userId },
        include: { studentProfile: true },
    });
    if (!user) throw new MeetingRefusal(signedOut());
    if (user.role !== "STUDENT" || !user.studentProfile) throw new MeetingRefusal(unavailable());
    return { user, profile: user.studentProfile };
}

function validationFailure(issue: Parameters<typeof issueCopy>[0], duration: number, startLabel?: string, endLabel?: string) {
    const copy = issueCopy(issue, duration, startLabel, endLabel);
    return failure("validation", copy.title, copy.description);
}

async function slotClash(tx: Tx, advisorId: string, slot: SlotDraft, ignoreId?: string) {
    return tx.meetingAvailability.findFirst({
        where: {
            advisorId,
            id: ignoreId ? { not: ignoreId } : undefined,
            startsAt: { lt: slot.endsAt },
            endsAt: { gt: slot.startsAt },
        },
        include: { session: { include: { student: { include: { user: true } } } } },
    });
}

function clashFailure(clash: NonNullable<Awaited<ReturnType<typeof slotClash>>>) {
    if (clash.status === "BOOKED" && clash.session) {
        const stamp = meetingStamp(clash.startsAt, clash.endsAt);
        return failure(
            "booked",
            "This time has a booked session",
            `${personName(clash.session.student.user)} is booked on ${stamp.full}. Cancel or reschedule that session first. Removing other open times does not change the booking.`,
            clash.session.id,
        );
    }
    return openOverlap();
}

async function insertSlots(tx: Tx, advisorId: string, slots: SlotDraft[], source: "MANUAL" | "MANUAL_WINDOW") {
    for (const slot of slots) {
        const clash = await slotClash(tx, advisorId, slot);
        if (clash) throw new MeetingRefusal(clashFailure(clash));
    }
    await tx.meetingAvailability.createMany({
        data: slots.map((slot) => ({
            advisorId,
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
            durationMinutes: slot.durationMinutes,
            status: "OPEN" as const,
            source,
        })),
    });
}

export async function saveDuration(db: Db, userId: string, minutes: number): Promise<MeetingResult> {
    if (!isMeetingDuration(minutes)) {
        const copy = issueCopy("duration", minutes);
        return failure("validation", copy.title, copy.description);
    }
    return settle(() => withLocks(db, [`advisor:${userId}`], async (tx) => {
        await requireAdvisor(tx, userId);
        await tx.advisorMeetingSettings.upsert({
            where: { advisorId: userId },
            create: { advisorId: userId, durationMinutes: minutes },
            update: { durationMinutes: minutes },
        });
        return { ok: true };
    }));
}

/** Date, start, and end only. A server action must not forward a client clock or any other field. */
export function availabilityFields(input: { date?: unknown; start?: unknown; end?: unknown } | null | undefined) {
    const source = input ?? {};
    return {
        date: typeof source.date === "string" ? source.date : "",
        start: typeof source.start === "string" ? source.start : "",
        end: typeof source.end === "string" ? source.end : undefined,
    };
}

export async function addAvailability(
    db: Db,
    userId: string,
    input: { date: string; start: string; end?: string; durationMinutes?: number; termId?: string },
    now = new Date(),
): Promise<MeetingResult> {
    const { date, start, end } = availabilityFields(input);
    return settle(() => withLocks(db, [`advisor:${userId}`], async (tx) => {
        const advisor = await requireAdvisor(tx, userId);
        const settings = await tx.advisorMeetingSettings.findUnique({ where: { advisorId: advisor.id } });
        const duration = typeof input.durationMinutes === "number" ? input.durationMinutes : (settings?.durationMinutes ?? 30);
        if (!isMeetingDuration(duration)) throw new MeetingRefusal(validationFailure("duration", duration));
        if (input.termId) {
            const term = await tx.academicTerm.findUnique({ where: { id: input.termId } });
            const draft = await tx.advisorTermDraft.findUnique({ where: { advisorId_termId: { advisorId: advisor.id, termId: input.termId } } });
            const parsed = draft ? parseScheduleConfig(draft.config) : null;
            const label = term ? academicTermLabel(term) : "this semester";
            if (!term) throw new MeetingRefusal(failure("validation", "Choose a date in this semester", `Pick a day inside ${label}, or choose that semester first.`));
            const first = parsed?.firstDay ?? civilDateValue(term.startsOn);
            const last = parsed?.lastDay ?? civilDateValue(term.endsOn);
            if (date < first || date > last) {
                throw new MeetingRefusal(failure("validation", "Choose a date in this semester", `Pick a day inside ${label}, or choose that semester first.`));
            }
        }
        const blocked = await dateBlockedByPublished(tx, advisor.id, date);
        if (blocked) {
            throw new MeetingRefusal(failure(
                "unavailable-date",
                "That date is marked unavailable",
                `${blocked.dateLabel} is unavailable on your published schedule. Remove that date and publish again before adding a time.`,
            ));
        }
        const built = end
            ? buildWindowSlots({ date, start, end, durationMinutes: duration, now })
            : buildSingleSlot({ date, start, durationMinutes: duration, now });
        if (!built.ok) throw new MeetingRefusal(validationFailure(built.issue, duration, start, end));
        const slots = "slots" in built ? built.slots : [built.slot];
        await insertSlots(tx, advisor.id, slots, end ? "MANUAL_WINDOW" : "MANUAL");
        return { ok: true };
    }));
}

export async function moveOpenSlot(
    db: Db,
    userId: string,
    slotId: string,
    input: { date: string; start: string },
    now = new Date(),
): Promise<MeetingResult> {
    const { date, start } = availabilityFields(input);
    return settle(() => withLocks(db, [`advisor:${userId}`], async (tx) => {
        await requireAdvisor(tx, userId);
        const current = await tx.meetingAvailability.findUnique({ where: { id: slotId } });
        if (!current || current.advisorId !== userId) throw new MeetingRefusal(unavailable());
        if (current.source === "TERM_PATTERN" || current.source === "TERM_OVERRIDE") {
            throw new MeetingRefusal(failure("draft-only", "Change this time when you publish?", "Students can still book the original time until you publish."));
        }
        if (current.status !== "OPEN") {
            const clash = await slotClash(tx, userId, { startsAt: current.startsAt, endsAt: current.endsAt, durationMinutes: current.durationMinutes });
            throw new MeetingRefusal(clash ? clashFailure(clash) : stale());
        }
        const built = buildSingleSlot({
            date,
            start,
            durationMinutes: current.durationMinutes,
            now,
        });
        if (!built.ok) throw new MeetingRefusal(validationFailure(built.issue, current.durationMinutes, start));
        const clash = await slotClash(tx, userId, built.slot, current.id);
        if (clash) throw new MeetingRefusal(clashFailure(clash));
        await tx.meetingAvailability.update({
            where: { id: current.id },
            data: { startsAt: built.slot.startsAt, endsAt: built.slot.endsAt },
        });
        return { ok: true };
    }));
}

export async function removeOpenSlot(db: Db, userId: string, slotId: string): Promise<MeetingResult> {
    return settle(() => withLocks(db, [`advisor:${userId}`], async (tx) => {
        await requireAdvisor(tx, userId);
        const current = await tx.meetingAvailability.findUnique({
            where: { id: slotId },
            include: { session: { include: { student: { include: { user: true } } } } },
        });
        if (!current || current.advisorId !== userId) throw new MeetingRefusal(unavailable());
        if (current.source === "TERM_PATTERN" || current.source === "TERM_OVERRIDE") {
            throw new MeetingRefusal(failure("draft-only", "Remove this time when you publish?", "Students can still book this time until you publish. After you publish, this time will not be offered."));
        }
        if (current.status !== "OPEN") throw new MeetingRefusal(clashFailure(current));
        await tx.meetingAvailability.delete({ where: { id: current.id } });
        return { ok: true };
    }));
}

async function confirmedOverlap(tx: Tx, input: { studentId: string; advisorId: string; start: Date; end: Date; exceptId?: string }) {
    return tx.meetingSession.findFirst({
        where: {
            status: "CONFIRMED",
            id: input.exceptId ? { not: input.exceptId } : undefined,
            startsAt: { lt: input.end },
            endsAt: { gt: input.start },
            OR: [{ studentId: input.studentId }, { advisorId: input.advisorId }],
        },
    });
}

export async function bookSlot(db: Db, userId: string, slotId: string, topic: string | null, now = new Date()): Promise<MeetingResult> {
    return settle(async () => {
        const preview = await db.user.findUnique({ where: { id: userId }, include: { studentProfile: true } });
        if (!preview?.studentProfile) return signedOut();
        const slotPreview = await db.meetingAvailability.findUnique({ where: { id: slotId }, select: { advisorId: true } });
        const note = cleanNote(topic, false, "");
        const keys = [`student:${preview.studentProfile.id}`, `slot:${slotId}`];
        if (slotPreview) keys.push(`advisor:${slotPreview.advisorId}`);
        return withLocks(db, keys, async (tx) => {
            const { user, profile } = await requireStudent(tx, userId);
            if (!profile.advisorId) throw new MeetingRefusal(stale());
            const slot = await tx.meetingAvailability.findUnique({ where: { id: slotId } });
            if (!slot || slot.advisorId !== profile.advisorId) throw new MeetingRefusal(stale());
            const bookable = slot.startsAt.getTime() >= now.getTime() + LEAD_TIME_MS
                && slot.startsAt.getTime() <= now.getTime() + STUDENT_HORIZON_MS;
            if (slot.status === "BOOKED") {
                const existing = await tx.meetingSession.findUnique({ where: { availabilityId: slot.id } });
                if (existing?.studentId === profile.id && existing.status === "CONFIRMED") return { ok: true, sessionId: existing.id };
                throw new MeetingRefusal(stale());
            }
            if (!bookable || slot.status !== "OPEN") throw new MeetingRefusal(stale());
            const overlap = await confirmedOverlap(tx, {
                studentId: profile.id,
                advisorId: slot.advisorId,
                start: slot.startsAt,
                end: slot.endsAt,
            });
            if (overlap) throw new MeetingRefusal(sessionOverlap());
            const claimed = await tx.meetingAvailability.updateMany({
                where: { id: slot.id, status: "OPEN" },
                data: { status: "BOOKED" },
            });
            if (claimed.count !== 1) {
                const existing = await tx.meetingSession.findUnique({ where: { availabilityId: slot.id } });
                if (existing?.studentId === profile.id && existing.status === "CONFIRMED") return { ok: true, sessionId: existing.id };
                throw new MeetingRefusal(stale());
            }
            const session = await tx.meetingSession.create({
                data: {
                    studentId: profile.id,
                    advisorId: slot.advisorId,
                    availabilityId: slot.id,
                    startsAt: slot.startsAt,
                    endsAt: slot.endsAt,
                    durationMinutes: slot.durationMinutes,
                    status: "CONFIRMED",
                    topic: note,
                    events: {
                        create: {
                            actorId: user.id,
                            actorName: personName(user),
                            actorRole: "STUDENT",
                            kind: "BOOKED",
                            body: note,
                        },
                    },
                },
            });
            return { ok: true, sessionId: session.id };
        });
    });
}

async function loadOwnedSession(tx: Tx, userId: string, sessionId: string) {
    const user = await tx.user.findUnique({ where: { id: userId }, include: { studentProfile: true } });
    if (!user) throw new MeetingRefusal(signedOut());
    const session = await tx.meetingSession.findUnique({
        where: { id: sessionId },
        include: {
            availability: true,
            student: { include: { user: { select: { firstName: true, lastName: true, name: true } } } },
        },
    });
    if (!session) throw new MeetingRefusal(unavailable());
    const isStudent = user.role === "STUDENT" && user.studentProfile?.id === session.studentId;
    const isAdvisor = user.role === "ADVISOR" && user.id === session.advisorId;
    if (!isStudent && !isAdvisor) throw new MeetingRefusal(unavailable());
    return { user, session, isAdvisor };
}

export async function cancelSession(db: Db, userId: string, sessionId: string, note: string | null, now = new Date()): Promise<MeetingResult> {
    return settle(async () => {
        const owned = await db.meetingSession.findUnique({ where: { id: sessionId } });
        if (!owned) return unavailable();
        const text = cleanNote(note, false, "");
        return withLocks(db, [`session:${sessionId}`, `advisor:${owned.advisorId}`, `student:${owned.studentId}`], async (tx) => {
            const { user, session, isAdvisor } = await loadOwnedSession(tx, userId, sessionId);
            const advisorNote = isAdvisor ? cleanNote(note, true, "Explain why you are canceling this session.") : text;
            if (session.status !== "CONFIRMED" || session.startsAt.getTime() <= now.getTime()) throw new MeetingRefusal(unavailable());
            await tx.meetingSession.update({
                where: { id: session.id },
                data: { status: "CANCELED", canceledAt: now, availabilityId: null },
            });
            if (session.availability) {
                const reopen = await publishedCoversSlot(tx, session.availability, now);
                if (reopen) {
                    await tx.meetingAvailability.update({
                        where: { id: session.availability.id },
                        data: { status: "OPEN" },
                    });
                } else {
                    await tx.meetingAvailability.delete({ where: { id: session.availability.id } });
                }
            }
            await tx.meetingEvent.create({
                data: {
                    sessionId: session.id,
                    actorId: user.id,
                    actorName: personName(user),
                    actorRole: isAdvisor ? "ADVISOR" : "STUDENT",
                    kind: "CANCELED",
                    body: advisorNote,
                },
            });
            return { ok: true, sessionId: session.id };
        });
    });
}

export async function rescheduleSession(
    db: Db,
    userId: string,
    sessionId: string,
    slotId: string,
    note: string | null,
    now = new Date(),
): Promise<MeetingResult> {
    return settle(async () => {
        const owned = await db.meetingSession.findUnique({ where: { id: sessionId } });
        if (!owned) return rescheduleFailed();
        return withLocks(db, [`session:${sessionId}`, `slot:${slotId}`, `advisor:${owned.advisorId}`, `student:${owned.studentId}`], async (tx) => {
            const { user, session, isAdvisor } = await loadOwnedSession(tx, userId, sessionId);
            const text = cleanNote(note, isAdvisor, "Explain why you are rescheduling this session.");
            if (session.status !== "CONFIRMED" || !session.availabilityId || !session.availability || session.startsAt.getTime() <= now.getTime()) {
                throw new MeetingRefusal(rescheduleFailed());
            }
            const slot = await tx.meetingAvailability.findUnique({ where: { id: slotId } });
            const horizon = isAdvisor ? ADVISOR_HORIZON_MS : STUDENT_HORIZON_MS;
            const bookable = !!slot
                && slot.advisorId === session.advisorId
                && slot.id !== session.availabilityId
                && slot.startsAt.getTime() >= now.getTime() + LEAD_TIME_MS
                && slot.startsAt.getTime() <= now.getTime() + horizon;
            if (!slot || !bookable) throw new MeetingRefusal(rescheduleFailed());
            if (slot.status === "BOOKED") throw new MeetingRefusal(rescheduleFailed());
            const overlap = await confirmedOverlap(tx, {
                studentId: session.studentId,
                advisorId: session.advisorId,
                start: slot.startsAt,
                end: slot.endsAt,
                exceptId: session.id,
            });
            if (overlap) throw new MeetingRefusal(rescheduleFailed());
            const claimed = await tx.meetingAvailability.updateMany({
                where: { id: slot.id, status: "OPEN" },
                data: { status: "BOOKED" },
            });
            if (claimed.count !== 1) throw new MeetingRefusal(rescheduleFailed());
            await tx.meetingSession.update({
                where: { id: session.id },
                data: {
                    availabilityId: slot.id,
                    startsAt: slot.startsAt,
                    endsAt: slot.endsAt,
                    durationMinutes: slot.durationMinutes,
                },
            });
            if (session.availability) {
                const reopen = await publishedCoversSlot(tx, session.availability, now);
                if (reopen) {
                    await tx.meetingAvailability.update({
                        where: { id: session.availability.id },
                        data: { status: "OPEN" },
                    });
                } else {
                    await tx.meetingAvailability.delete({ where: { id: session.availability.id } });
                }
            }
            await tx.meetingEvent.create({
                data: {
                    sessionId: session.id,
                    actorId: user.id,
                    actorName: personName(user),
                    actorRole: isAdvisor ? "ADVISOR" : "STUDENT",
                    kind: "RESCHEDULED",
                    body: text,
                    fromStartsAt: session.startsAt,
                    fromEndsAt: session.endsAt,
                    toStartsAt: slot.startsAt,
                    toEndsAt: slot.endsAt,
                },
            });
            return { ok: true, sessionId: session.id };
        });
    }, rescheduleFailed());
}

export async function saveZoom(db: Db, userId: string, sessionId: string, url: string): Promise<MeetingResult> {
    const problem = zoomFailure(url);
    if (problem) return { ok: false, code: "zoom", ...problem };
    const parsed = normalizeZoomUrl(url);
    if (!parsed.ok) return failure("zoom", "Check the Zoom link", "Enter a valid Zoom URL.");
    return settle(() => withLocks(db, [`session:${sessionId}`], async (tx) => {
        const { user, session } = await loadOwnedSession(tx, userId, sessionId);
        if (user.role !== "ADVISOR" || user.id !== session.advisorId) throw new MeetingRefusal(unavailable());
        if (session.status !== "CONFIRMED") throw new MeetingRefusal(unavailable());
        const kind = session.zoomUrl ? "ZOOM_UPDATED" as const : "ZOOM_ADDED" as const;
        await tx.meetingSession.update({ where: { id: session.id }, data: { zoomUrl: parsed.url } });
        await tx.meetingEvent.create({
            data: {
                sessionId: session.id,
                actorId: user.id,
                actorName: personName(user),
                actorRole: "ADVISOR",
                kind,
            },
        });
        return { ok: true, sessionId: session.id };
    }));
}

export async function removeZoom(db: Db, userId: string, sessionId: string): Promise<MeetingResult> {
    return settle(() => withLocks(db, [`session:${sessionId}`], async (tx) => {
        const { user, session } = await loadOwnedSession(tx, userId, sessionId);
        if (user.role !== "ADVISOR" || user.id !== session.advisorId) throw new MeetingRefusal(unavailable());
        if (!session.zoomUrl) return { ok: true, sessionId: session.id };
        await tx.meetingSession.update({ where: { id: session.id }, data: { zoomUrl: null } });
        await tx.meetingEvent.create({
            data: {
                sessionId: session.id,
                actorId: user.id,
                actorName: personName(user),
                actorRole: "ADVISOR",
                kind: "ZOOM_REMOVED",
            },
        });
        return { ok: true, sessionId: session.id };
    }));
}

export async function rescheduleChoices(db: Db, userId: string, sessionId: string, now = new Date()): Promise<OpenSlotChoice[]> {
    const user = await db.user.findUnique({ where: { id: userId }, include: { studentProfile: true } });
    const session = await db.meetingSession.findUnique({ where: { id: sessionId } });
    if (!user || !session) return [];
    const isStudent = user.role === "STUDENT" && user.studentProfile?.id === session.studentId;
    const isAdvisor = user.role === "ADVISOR" && user.id === session.advisorId;
    if (!isStudent && !isAdvisor) return [];
    if (session.status !== "CONFIRMED" || !session.availabilityId) return [];
    const horizon = isAdvisor ? ADVISOR_HORIZON_MS : STUDENT_HORIZON_MS;
    const currentSlotId = session.availabilityId;
    const [slots, sessions] = await Promise.all([
        db.meetingAvailability.findMany({
            where: {
                advisorId: session.advisorId,
                status: "OPEN",
                id: { not: currentSlotId },
                startsAt: { gte: new Date(now.getTime() + LEAD_TIME_MS), lte: new Date(now.getTime() + horizon) },
            },
            orderBy: { startsAt: "asc" },
        }),
        db.meetingSession.findMany({
            where: {
                status: "CONFIRMED",
                id: { not: session.id },
                OR: [{ studentId: session.studentId }, { advisorId: session.advisorId }],
            },
        }),
    ]);
    return slots
        .filter((slot) => !sessions.some((other) => rangesOverlap(slot.startsAt, slot.endsAt, other.startsAt, other.endsAt)))
        .map(toSlot);
}
