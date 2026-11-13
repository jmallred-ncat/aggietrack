/** Eastern civil time for advising. Stored instants are UTC. Students and advisors enter and read America/New_York. */

export const ADVISING_TIME_ZONE = "America/New_York";

export const MEETING_DURATIONS = [15, 20, 30, 45, 60] as const;
export type MeetingDuration = (typeof MEETING_DURATIONS)[number];
export const DEFAULT_MEETING_DURATION: MeetingDuration = 30;

export const DAY_START_MINUTES = 7 * 60;
export const DAY_END_MINUTES = 21 * 60;
export const SLOT_STEP_MINUTES = 15;
export const LEAD_TIME_MS = 15 * 60 * 1000;
export const STUDENT_HORIZON_MS = 8 * 7 * 24 * 60 * 60 * 1000;
export const ADVISOR_HORIZON_MS = 16 * 7 * 24 * 60 * 60 * 1000;
export const CANCELED_VISIBLE_MS = 30 * 24 * 60 * 60 * 1000;
export const PAST_SESSION_LIMIT = 8;

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
] as const;

export type CivilDate = { year: number; month: number; day: number };

export type EasternParts = CivilDate & {
    hour: number;
    minute: number;
    weekday: string;
    zone: string;
};

export type TimeChoice = { value: string; label: string };

export function isMeetingDuration(value: number): value is MeetingDuration {
    return (MEETING_DURATIONS as readonly number[]).includes(value);
}

export function durationLabel(minutes: number) {
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

export function easternParts(date: Date): EasternParts {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: ADVISING_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        weekday: "long",
        hourCycle: "h23",
        timeZoneName: "short",
    }).formatToParts(date);
    const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
    let hour = Number(read("hour"));
    if (hour === 24) hour = 0;
    return {
        year: Number(read("year")),
        month: Number(read("month")),
        day: Number(read("day")),
        hour,
        minute: Number(read("minute")),
        weekday: read("weekday"),
        zone: read("timeZoneName"),
    };
}

/** The UTC instant for an Eastern clock time. Fall-back returns the earlier (EDT) occurrence. A spring-forward gap returns null. */
export function easternInstant(year: number, month: number, day: number, hour: number, minute: number): Date | null {
    const matches: Date[] = [];
    for (const offsetHours of [4, 5]) {
        const candidate = new Date(Date.UTC(year, month - 1, day, hour + offsetHours, minute));
        const parts = easternParts(candidate);
        if (parts.year === year && parts.month === month && parts.day === day && parts.hour === hour && parts.minute === minute) {
            matches.push(candidate);
        }
    }
    matches.sort((left, right) => left.getTime() - right.getTime());
    return matches[0] ?? null;
}

export function formatClock(hour: number, minute: number, withPeriod = true) {
    const period = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    const clock = `${hour12}:${String(minute).padStart(2, "0")}`;
    return withPeriod ? `${clock} ${period}` : clock;
}

export function formatClockValue(value: string) {
    const parsed = parseClock(value);
    if (!parsed) return value;
    return formatClock(parsed.hour, parsed.minute);
}

/** A notice is one instant. It has a date and a clock, not a start–end range. */
export function pointStamp(instant: Date) {
    const parts = easternParts(instant);
    const date = `${parts.weekday}, ${MONTHS[parts.month - 1]} ${parts.day}, ${parts.year}`;
    const time = `${formatClock(parts.hour, parts.minute)} ${parts.zone}`;
    return { date, time, full: `${date}, ${time}` };
}

export function meetingStamp(start: Date, end: Date) {
    const startParts = easternParts(start);
    const endParts = easternParts(end);
    const date = `${startParts.weekday}, ${MONTHS[startParts.month - 1]} ${startParts.day}, ${startParts.year}`;
    const samePeriod = startParts.hour >= 12 === endParts.hour >= 12;
    const range = `${formatClock(startParts.hour, startParts.minute, !samePeriod)}–${formatClock(endParts.hour, endParts.minute)}`;
    const time = startParts.zone === endParts.zone
        ? `${range} ${startParts.zone}`
        : `${formatClock(startParts.hour, startParts.minute)} ${startParts.zone}–${formatClock(endParts.hour, endParts.minute)} ${endParts.zone}`;
    return {
        date,
        time,
        full: `${date}, ${time}`,
        dateHeading: `${startParts.weekday}, ${MONTHS[startParts.month - 1]} ${startParts.day}, ${startParts.year}`,
        slotLabel: range,
        zone: startParts.zone,
    };
}

export function timeChoices(): TimeChoice[] {
    const choices: TimeChoice[] = [];
    for (let minutes = DAY_START_MINUTES; minutes <= DAY_END_MINUTES; minutes += SLOT_STEP_MINUTES) {
        const hour = Math.floor(minutes / 60);
        const minute = minutes % 60;
        choices.push({
            value: clockValue(hour, minute),
            label: formatClock(hour, minute),
        });
    }
    return choices;
}

export function clockValue(hour: number, minute: number) {
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function parseClock(value: string): { hour: number; minute: number; minutes: number } | null {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) return null;
    return { hour, minute, minutes: hour * 60 + minute };
}

export function parseCivilDate(value: string): CivilDate | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const noon = easternInstant(year, month, day, 12, 0);
    if (!noon) return null;
    const parts = easternParts(noon);
    if (parts.year !== year || parts.month !== month || parts.day !== day) return null;
    return { year, month, day };
}

export function civilDateValue(date: Date) {
    const parts = easternParts(date);
    return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function civilDateLabel(value: string) {
    const date = parseCivilDate(value);
    if (!date) return value;
    const noon = easternInstant(date.year, date.month, date.day, 12, 0);
    if (!noon) return value;
    const parts = easternParts(noon);
    return `${parts.weekday}, ${MONTHS[parts.month - 1]} ${parts.day}, ${parts.year}`;
}

export type SlotDraft = { startsAt: Date; endsAt: Date; durationMinutes: number };

export type AvailabilityIssue =
    | "date"
    | "time"
    | "step"
    | "bounds"
    | "order"
    | "same-day"
    | "gap"
    | "short"
    | "lead"
    | "horizon"
    | "duration";

export function issueCopy(
    issue: AvailabilityIssue,
    duration: number,
    startLabel = "",
    endLabel = "",
): { title: string; description: string } {
    switch (issue) {
        case "date":
            return { title: "Choose a date", description: "Pick the day these times should fall on." };
        case "time":
            return { title: "Enter a start and end time", description: "Both times are required." };
        case "step":
        case "bounds":
            return {
                title: "Choose a listed time",
                description: "Open times use the 15-minute times between 7:00 AM and 9:00 PM.",
            };
        case "order":
            return { title: "Check the end time", description: "Choose an end time after the start time." };
        case "same-day":
            return { title: "Check the end time", description: "Choose an end time after the start time." };
        case "gap":
            return {
                title: "That time does not exist",
                description: "Eastern Time skips this hour when clocks change. Choose another time.",
            };
        case "short":
            return {
                title: "This window is too short",
                description: `Offered sessions have to fit inside the window. A ${duration}-minute session does not fit between ${startLabel || "the start"} and ${endLabel || "the end"}.`,
            };
        case "lead":
            return { title: "That time is in the past", description: "Add a time that has not started yet." };
        case "horizon":
            return { title: "That date is too far ahead", description: "Add times in the next 16 weeks." };
        case "duration":
            return { title: "Choose a session length", description: "Pick 15, 20, 30, 45, or 60 minutes." };
    }
}

function onGrid(minutes: number) {
    return minutes >= DAY_START_MINUTES && minutes <= DAY_END_MINUTES && minutes % SLOT_STEP_MINUTES === 0;
}

export function buildWindowSlots(input: {
    date: string;
    start: string;
    end: string;
    durationMinutes: number;
    now: Date;
    horizonMs?: number;
}): { ok: true; slots: SlotDraft[] } | { ok: false; issue: AvailabilityIssue } {
    if (!isMeetingDuration(input.durationMinutes)) return { ok: false, issue: "duration" };
    const date = parseCivilDate(input.date);
    if (!date) return { ok: false, issue: "date" };
    const startClock = parseClock(input.start);
    const endClock = parseClock(input.end);
    if (!startClock || !endClock) return { ok: false, issue: "time" };
    if (startClock.minute % SLOT_STEP_MINUTES !== 0 || endClock.minute % SLOT_STEP_MINUTES !== 0) {
        return { ok: false, issue: "step" };
    }
    if (endClock.minutes <= startClock.minutes) return { ok: false, issue: "order" };
    if (!easternInstant(date.year, date.month, date.day, startClock.hour, startClock.minute)) {
        return { ok: false, issue: "gap" };
    }
    if (!easternInstant(date.year, date.month, date.day, endClock.hour, endClock.minute)) {
        return { ok: false, issue: "gap" };
    }
    if (!onGrid(startClock.minutes) || !onGrid(endClock.minutes)) return { ok: false, issue: "bounds" };

    const horizon = input.horizonMs ?? ADVISOR_HORIZON_MS;
    const slots: SlotDraft[] = [];
    for (let cursor = startClock.minutes; cursor + input.durationMinutes <= endClock.minutes; cursor += input.durationMinutes) {
        const hour = Math.floor(cursor / 60);
        const minute = cursor % 60;
        const startsAt = easternInstant(date.year, date.month, date.day, hour, minute);
        if (!startsAt) return { ok: false, issue: "gap" };
        const endsAt = new Date(startsAt.getTime() + input.durationMinutes * 60 * 1000);
        const endParts = easternParts(endsAt);
        const sameDay = endParts.year === date.year && endParts.month === date.month && endParts.day === date.day;
        if (!sameDay || endParts.hour * 60 + endParts.minute > DAY_END_MINUTES) return { ok: false, issue: "bounds" };
        if (startsAt.getTime() < input.now.getTime() + LEAD_TIME_MS) return { ok: false, issue: "lead" };
        if (startsAt.getTime() > input.now.getTime() + horizon) return { ok: false, issue: "horizon" };
        slots.push({ startsAt, endsAt, durationMinutes: input.durationMinutes });
    }
    if (slots.length === 0) return { ok: false, issue: "short" };
    return { ok: true, slots };
}

export function buildSingleSlot(input: {
    date: string;
    start: string;
    durationMinutes: number;
    now: Date;
    horizonMs?: number;
}): { ok: true; slot: SlotDraft } | { ok: false; issue: AvailabilityIssue } {
    if (!isMeetingDuration(input.durationMinutes)) return { ok: false, issue: "duration" };
    const startClock = parseClock(input.start);
    if (!startClock) return { ok: false, issue: "time" };
    const endMinutes = startClock.minutes + input.durationMinutes;
    if (endMinutes > DAY_END_MINUTES) return { ok: false, issue: "short" };
    const end = clockValue(Math.floor(endMinutes / 60), endMinutes % 60);
    const built = buildWindowSlots({ ...input, end });
    if (!built.ok) return built;
    const slot = built.slots[0];
    if (!slot) return { ok: false, issue: "short" };
    return { ok: true, slot };
}

export function rangesOverlap(leftStart: Date, leftEnd: Date, rightStart: Date, rightEnd: Date) {
    return leftStart < rightEnd && rightStart < leftEnd;
}
