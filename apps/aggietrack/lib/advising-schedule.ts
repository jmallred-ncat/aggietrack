import { createHash } from "node:crypto";
import {
    LEAD_TIME_MS,
    SLOT_STEP_MINUTES,
    civilDateLabel,
    civilDateValue,
    durationLabel,
    easternInstant,
    easternParts,
    formatClock,
    isMeetingDuration,
    issueCopy,
    meetingStamp,
    parseCivilDate,
    parseClock,
    rangesOverlap,
} from "./advising-time";

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export type WeekdayName = (typeof WEEKDAYS)[number];

export type WeekWindow = { start: string; end: string };
export type WeekdayConfig = { unavailable: boolean; windows: WeekWindow[] };
export type ScheduleInterval = { startsAt: string; endsAt: string };
export type ScheduleReplacement = { original: ScheduleInterval; next: ScheduleInterval };

export type ScheduleConfig = {
    firstDay: string | null;
    lastDay: string | null;
    durationMinutes: number;
    weekdays: WeekdayConfig[];
    unavailableDates: string[];
    suppressions: ScheduleInterval[];
    replacements: ScheduleReplacement[];
};

export type TermBounds = {
    id: string;
    label: string;
    startsOn: string | null;
    endsOn: string | null;
};

export type LiveSlot = {
    id: string;
    startsAt: Date;
    endsAt: Date;
    durationMinutes: number;
    status: "OPEN" | "BOOKED";
    source: "MANUAL" | "MANUAL_WINDOW" | "TERM_PATTERN" | "TERM_OVERRIDE";
    termId: string | null;
    termLabel: string | null;
    studentName: string | null;
    studentId: string | null;
    sessionId: string | null;
};

export type OtherBlock = { termId: string; label: string; dates: string[] };

export type ReviewItem = {
    id: string;
    primary: string;
    secondary: string;
    fullTimestamp: string;
    sourceLabel: string;
    studentName: string | null;
    note: string | null;
    startsAt: string | null;
};

export type ReviewBlock = {
    title: string;
    description: string;
    times: ReviewItem[];
};

export type ReviewSection = {
    key: string;
    expandLabel: string;
    items: ReviewItem[];
};

export type PlannedSlot = {
    startsAt: string;
    endsAt: string;
    durationMinutes: number;
    source: "TERM_PATTERN" | "TERM_OVERRIDE";
};

export type ScheduleReview = {
    stale: boolean;
    token: string;
    semester: string;
    rangeLabel: string;
    officialLabel: string | null;
    lines: string[];
    skipLines: string[];
    remainders: string[];
    blocking: ReviewBlock[];
    sections: ReviewSection[];
    plan: { adds: PlannedSlot[]; removeIds: string[] };
};

export type ScheduleIssue = { ok: false; title: string; description: string; field?: string };

const MISSING_DATES = {
    title: "Semester dates are unavailable",
    description: "This semester does not have start and end dates yet, so hours cannot be generated. Choose another semester or wait until dates are posted.",
};

export function emptySchedule(bounds: { startsOn: string | null; endsOn: string | null } | null): ScheduleConfig {
    return {
        firstDay: bounds?.startsOn ?? null,
        lastDay: bounds?.endsOn ?? null,
        durationMinutes: 30,
        weekdays: WEEKDAYS.map(() => ({ unavailable: true, windows: [] })),
        unavailableDates: [],
        suppressions: [],
        replacements: [],
    };
}

export function canonicalSchedule(config: ScheduleConfig): ScheduleConfig {
    return {
        firstDay: config.firstDay,
        lastDay: config.lastDay,
        durationMinutes: config.durationMinutes,
        weekdays: config.weekdays.map((day) => ({
            unavailable: day.unavailable,
            windows: [...day.windows].sort((left, right) => left.start.localeCompare(right.start) || left.end.localeCompare(right.end)),
        })),
        unavailableDates: [...new Set(config.unavailableDates)].sort(),
        suppressions: [...config.suppressions].sort((left, right) => left.startsAt.localeCompare(right.startsAt) || left.endsAt.localeCompare(right.endsAt)),
        replacements: [...config.replacements].sort((left, right) => left.original.startsAt.localeCompare(right.original.startsAt) || left.next.startsAt.localeCompare(right.next.startsAt)),
    };
}

export function schedulesEqual(left: ScheduleConfig, right: ScheduleConfig) {
    return stable(canonicalSchedule(left)) === stable(canonicalSchedule(right));
}

export type TermEditorState = {
    termId: string | null;
    editor: ScheduleConfig;
    baseline: ScheduleConfig;
    revision: string;
};

/** The server-selected semester replaces the whole editor. A dirty editor only sticks while that semester is still selected. */
export function adoptTermEditor(
    state: TermEditorState,
    model: { selectedTermId: string | null; config: ScheduleConfig; revision: string },
): TermEditorState {
    if (model.selectedTermId !== state.termId) {
        return {
            termId: model.selectedTermId,
            editor: model.config,
            baseline: model.config,
            revision: model.revision,
        };
    }
    if (model.revision !== state.revision && schedulesEqual(state.editor, state.baseline)) {
        return { ...state, editor: model.config, baseline: model.config, revision: model.revision };
    }
    return state;
}

/** Browser Back is bypassed for one navigation, then the next dirty form asks again. */
export function createLeaveGuard() {
    let bypass = false;
    return {
        beginDirty() {
            bypass = false;
        },
        allowNavigation() {
            bypass = true;
        },
        onBack(): "prompt" | "pass" {
            if (!bypass) return "prompt";
            bypass = false;
            return "pass";
        },
    };
}

/** A save that finishes after the advisor has switched semesters must not rewrite the destination baseline. */
export function baselineAfterSave(state: TermEditorState, savedTermId: string, config: ScheduleConfig): TermEditorState {
    if (state.termId !== savedTermId) return state;
    return { ...state, baseline: config };
}

export function parseScheduleConfig(value: unknown): ScheduleConfig | null {
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    if (!Array.isArray(record.weekdays) || record.weekdays.length !== 7) return null;
    if (typeof record.durationMinutes !== "number") return null;
    const weekdays: WeekdayConfig[] = [];
    for (const day of record.weekdays) {
        if (!day || typeof day !== "object") return null;
        const source = day as Record<string, unknown>;
        if (typeof source.unavailable !== "boolean" || !Array.isArray(source.windows)) return null;
        const windows: WeekWindow[] = [];
        for (const window of source.windows) {
            if (!window || typeof window !== "object") return null;
            const item = window as Record<string, unknown>;
            if (typeof item.start !== "string" || typeof item.end !== "string") return null;
            windows.push({ start: item.start, end: item.end });
        }
        weekdays.push({ unavailable: source.unavailable, windows });
    }
    const firstDay = record.firstDay === null ? null : typeof record.firstDay === "string" ? record.firstDay : null;
    const lastDay = record.lastDay === null ? null : typeof record.lastDay === "string" ? record.lastDay : null;
    if (record.firstDay !== null && typeof record.firstDay !== "string") return null;
    if (record.lastDay !== null && typeof record.lastDay !== "string") return null;
    if (!Array.isArray(record.unavailableDates) || !Array.isArray(record.suppressions) || !Array.isArray(record.replacements)) return null;
    const unavailableDates = record.unavailableDates.filter((date): date is string => typeof date === "string");
    const suppressions = readIntervals(record.suppressions);
    const replacements = readReplacements(record.replacements);
    if (!suppressions || !replacements) return null;
    return canonicalSchedule({
        firstDay,
        lastDay,
        durationMinutes: record.durationMinutes,
        weekdays,
        unavailableDates,
        suppressions,
        replacements,
    });
}

export function statusKind(published: ScheduleConfig | null, draft: ScheduleConfig | null): "draft" | "published" | "changes" | null {
    if (draft && !published) return "draft";
    if (draft && published && !schedulesEqual(draft, published)) return "changes";
    if (published) return "published";
    return null;
}

export function statusHelper(status: "draft" | "published" | "changes") {
    if (status === "draft") return "Students cannot see these hours until you publish.";
    if (status === "published") return "Students can book the published hours for this semester.";
    return "Students still see the published hours until you publish these changes.";
}

export function statusLabel(status: "draft" | "published" | "changes") {
    if (status === "draft") return "Draft";
    if (status === "published") return "Published";
    return "Unpublished changes";
}

export function termRunLabel(label: string, startsOn: string, endsOn: string) {
    return `${label} runs ${civilDateLabel(startsOn)}\u2013${civilDateLabel(endsOn)}.`;
}

export function termEnded(endsOn: string | null, now: Date) {
    if (!endsOn) return false;
    return endsOn < civilDateValue(now);
}

export function validatePublish(config: ScheduleConfig, term: TermBounds, hasPublished: boolean, now: Date): { ok: true; config: ScheduleConfig } | ScheduleIssue {
    const next = canonicalSchedule(config);
    if (!term.startsOn || !term.endsOn) return { ok: false, ...MISSING_DATES, field: "semester" };
    if (!next.firstDay || !next.lastDay) {
        return { ok: false, title: "Choose a first and last day", description: "Both days are required and are included.", field: "first" };
    }
    if (!parseCivilDate(next.firstDay) || !parseCivilDate(next.lastDay)) {
        return { ok: false, title: "Choose a first and last day", description: "Both days are required and are included.", field: "first" };
    }
    if (next.lastDay < next.firstDay) {
        return { ok: false, title: "Check the last day", description: "Choose a last day on or after the first day.", field: "last" };
    }
    if (next.firstDay < term.startsOn || next.lastDay > term.endsOn) {
        return { ok: false, title: "Those days are outside this semester", description: `Choose dates inside ${term.label}.`, field: "first" };
    }
    if (next.lastDay < civilDateValue(now)) {
        return { ok: false, title: "Those days are in the past", description: "Choose days that have not ended yet.", field: "last" };
    }
    if (!isMeetingDuration(next.durationMinutes)) {
        const copy = issueCopy("duration", next.durationMinutes);
        return { ok: false, ...copy, field: "length" };
    }
    let anyHours = false;
    for (let index = 0; index < next.weekdays.length; index += 1) {
        const day = next.weekdays[index];
        const name = WEEKDAYS[index] ?? "day";
        if (!day || day.unavailable) continue;
        if (day.windows.length === 0) {
            return {
                ok: false,
                title: `Add hours for ${name}`,
                description: `Add at least one start and end time, or mark ${name} unavailable.`,
                field: `weekday-${index}`,
            };
        }
        const minutes = [];
        for (const window of day.windows) {
            const start = parseClock(window.start);
            const end = parseClock(window.end);
            if (!start || !end) {
                const copy = issueCopy("time", next.durationMinutes);
                return { ok: false, ...copy, field: `weekday-${index}` };
            }
            if (start.minute % SLOT_STEP_MINUTES !== 0 || end.minute % SLOT_STEP_MINUTES !== 0 || start.minutes < 7 * 60 || end.minutes > 21 * 60) {
                const copy = issueCopy("bounds", next.durationMinutes);
                return { ok: false, ...copy, field: `weekday-${index}` };
            }
            if (end.minutes <= start.minutes) {
                const copy = issueCopy("order", next.durationMinutes);
                return { ok: false, ...copy, field: `weekday-${index}` };
            }
            if (end.minutes - start.minutes < next.durationMinutes) {
                const copy = issueCopy("short", next.durationMinutes, formatClock(start.hour, start.minute), formatClock(end.hour, end.minute));
                return { ok: false, ...copy, field: `weekday-${index}` };
            }
            minutes.push([start.minutes, end.minutes] as const);
        }
        minutes.sort((left, right) => left[0] - right[0]);
        for (let cursor = 1; cursor < minutes.length; cursor += 1) {
            const previous = minutes[cursor - 1];
            const current = minutes[cursor];
            if (previous && current && current[0] < previous[1]) {
                return {
                    ok: false,
                    title: "These hours overlap",
                    description: "Change the start or end so the hours on this day do not overlap.",
                    field: `weekday-${index}`,
                };
            }
        }
        anyHours = true;
    }
    if (!anyHours && !hasPublished) {
        return {
            ok: false,
            title: "Add weekly hours",
            description: "Turn on at least one weekday and add hours, or students will not get times from this schedule.",
            field: "weekday-1",
        };
    }
    for (const date of next.unavailableDates) {
        if (!parseCivilDate(date) || date < next.firstDay || date > next.lastDay || date < term.startsOn || date > term.endsOn) {
            return {
                ok: false,
                title: "Check that date",
                description: "Choose a date between the first and last day of this semester schedule.",
                field: "dates",
            };
        }
    }
    return { ok: true, config: next };
}

/** Walk a window without the 7:00 AM picker limit. A spring-forward start is a skip, not a slot. */
export function explainWindow(input: { date: string; start: string; end: string; durationMinutes: number; now: Date }) {
    const date = parseCivilDate(input.date);
    const start = parseClock(input.start);
    const end = parseClock(input.end);
    let slots = 0;
    let missingHourSkips = 0;
    if (!date || !start || !end || !isMeetingDuration(input.durationMinutes)) return { slots, missingHourSkips };
    for (let cursor = start.minutes; cursor + input.durationMinutes <= end.minutes; cursor += input.durationMinutes) {
        const hour = Math.floor(cursor / 60);
        const minute = cursor % 60;
        const startsAt = easternInstant(date.year, date.month, date.day, hour, minute);
        if (!startsAt) {
            missingHourSkips += 1;
            continue;
        }
        if (startsAt.getTime() < input.now.getTime() + LEAD_TIME_MS) continue;
        slots += 1;
    }
    return { slots, missingHourSkips };
}

export function coversExactInterval(config: ScheduleConfig, startsAt: Date, endsAt: Date, now: Date) {
    const plan = collectDesired(config, [], [], now, "term", null, "skip-historical");
    if (!plan.ok) return false;
    return plan.desired.some((item) => item.startsAt.getTime() === startsAt.getTime() && item.endsAt.getTime() === endsAt.getTime());
}

export function buildReview(input: {
    config: ScheduleConfig;
    term: TermBounds;
    hasPublished: boolean;
    publishedVersion: number;
    slots: LiveSlot[];
    otherBlocks: OtherBlock[];
    now: Date;
    publishedConfig?: ScheduleConfig | null;
}): { ok: true; review: ScheduleReview } | ScheduleIssue {
    const valid = validatePublish(input.config, input.term, input.hasPublished, input.now);
    if (!valid.ok) return valid;
    const config = valid.config;
    const plan = collectDesired(config, input.slots, input.otherBlocks, input.now, input.term.id, input.term, "reject", input.publishedConfig ?? null);
    if (!plan.ok) return plan;
    const owned = input.slots.filter((slot) => slot.termId === input.term.id && (slot.source === "TERM_PATTERN" || slot.source === "TERM_OVERRIDE"));
    const used = new Set<string>();
    const adds: ReviewItem[] = [];
    const plannedAdds: PlannedSlot[] = [];
    const removes: ReviewItem[] = [];
    const unchanged: ReviewItem[] = [];
    const bookings: ReviewItem[] = [];
    for (const desired of plan.desired) {
        const match = owned.find((slot) => slot.startsAt.getTime() === desired.startsAt.getTime() && slot.endsAt.getTime() === desired.endsAt.getTime());
        if (match?.status === "OPEN") {
            used.add(match.id);
            unchanged.push(itemFromSlot(match, desired.source === "TERM_OVERRIDE" ? "Changed time" : "Weekly hours"));
            continue;
        }
        if (match?.status === "BOOKED") {
            used.add(match.id);
            continue;
        }
        adds.push(itemFromDesired(desired));
        plannedAdds.push({
            startsAt: desired.startsAt.toISOString(),
            endsAt: desired.endsAt.toISOString(),
            durationMinutes: desired.durationMinutes,
            source: desired.source,
        });
    }
    for (const slot of owned) {
        if (used.has(slot.id)) continue;
        if (slot.status === "BOOKED") bookings.push(bookedItem(slot, config));
        else if (slot.startsAt.getTime() > input.now.getTime()) removes.push(itemFromSlot(slot, slot.source === "TERM_OVERRIDE" ? "Changed time" : "Weekly hours"));
    }
    for (const date of config.unavailableDates) {
        for (const slot of input.slots) {
            if (slot.status !== "BOOKED" || civilDateValue(slot.startsAt) !== date) continue;
            if (bookings.some((item) => item.id === slot.id)) continue;
            bookings.push(bookedItem(slot, config));
        }
    }
    const removedIds = new Set(removes.map((item) => item.id));
    const blockingTimes: ReviewItem[] = [];
    for (const date of config.unavailableDates) {
        for (const slot of input.slots) {
            if (slot.status !== "OPEN" || slot.endsAt.getTime() <= input.now.getTime()) continue;
            if (civilDateValue(slot.startsAt) !== date || removedIds.has(slot.id)) continue;
            blockingTimes.push(itemFromSlot(slot, sourceLabel(slot, input.term.id)));
        }
    }
    const blocking: ReviewBlock[] = [];
    if (blockingTimes.length > 0) {
        blocking.push({
            title: "This date still has times outside this semester schedule.",
            description: "Remove those times or choose a different date before publishing.",
            times: blockingTimes,
        });
    }
    if (plan.blockedDate) {
        blocking.push({
            title: "That date is marked unavailable",
            description: `${civilDateLabel(plan.blockedDate.date)} is unavailable on your ${plan.blockedDate.label} schedule. Remove that date from ${plan.blockedDate.label} and publish again before publishing hours on that day.`,
            times: [],
        });
    }
    const firstDay = config.firstDay ?? "";
    const lastDay = config.lastDay ?? "";
    const narrowed = Boolean(input.term.startsOn && input.term.endsOn && (firstDay !== input.term.startsOn || lastDay !== input.term.endsOn));
    const lines: string[] = [];
    if (!input.hasPublished || adds.length > 0) lines.push(`This adds ${adds.length} open times.`);
    if (removes.length > 0) lines.push(`This removes ${removes.length} open times.`);
    if (unchanged.length > 0) lines.push(`${unchanged.length} open times stay as they are.`);
    if (bookings.length > 0) lines.push(bookings.length === 1 ? "1 booked session stays as it is." : `${bookings.length} booked sessions stay as they are.`);
    if (config.unavailableDates.length > 0) lines.push(config.unavailableDates.length === 1 ? "1 date will be unavailable." : `${config.unavailableDates.length} dates will be unavailable.`);
    const skipLines = plan.skipLines.filter((line) => !line.startsWith("0 "));
    const sections: ReviewSection[] = [];
    if (adds.length > 0) sections.push({ key: "adds", expandLabel: `Show ${adds.length} open times that will be added`, items: adds });
    if (removes.length > 0) sections.push({ key: "removes", expandLabel: `Show ${removes.length} open times that will be removed`, items: removes });
    if (unchanged.length > 0) sections.push({ key: "unchanged", expandLabel: `Show ${unchanged.length} open times that stay`, items: unchanged });
    if (bookings.length > 0) sections.push({ key: "bookings", expandLabel: bookings.length === 1 ? "Show 1 booked session that stays" : `Show ${bookings.length} booked sessions that stay`, items: bookings });
    if (config.unavailableDates.length > 0) {
        sections.push({
            key: "dates",
            expandLabel: config.unavailableDates.length === 1 ? "Show 1 unavailable date" : `Show ${config.unavailableDates.length} unavailable dates`,
            items: config.unavailableDates.map((date) => ({
                id: date,
                primary: civilDateLabel(date),
                secondary: "",
                fullTimestamp: civilDateLabel(date),
                sourceLabel: "Unavailable date",
                studentName: null,
                note: null,
                startsAt: null,
            })),
        });
    }
    for (const bucket of plan.buckets) {
        if (bucket.items.length === 0) continue;
        sections.push({
            key: bucket.key,
            expandLabel: bucket.items.length === 1 ? `Show 1 skipped time (${bucket.category})` : `Show ${bucket.items.length} skipped times (${bucket.category})`,
            items: bucket.items,
        });
    }
    const review: ScheduleReview = {
        stale: false,
        token: reviewToken(config, input.publishedVersion, input.slots, input.otherBlocks, {
            adds: plannedAdds,
            removeIds: removes.map((item) => item.id),
            unchangedIds: unchanged.map((item) => item.id),
            bookings: bookings.map((item) => {
                const slot = input.slots.find((live) => live.id === item.id);
                return { id: item.id, sessionId: slot?.sessionId ?? null, studentId: slot?.studentId ?? null };
            }),
        }),
        semester: input.term.label,
        rangeLabel: `${input.term.label}: ${civilDateLabel(firstDay)}\u2013${civilDateLabel(lastDay)}`,
        officialLabel: narrowed && input.term.startsOn && input.term.endsOn
            ? `Term dates: ${civilDateLabel(input.term.startsOn)}\u2013${civilDateLabel(input.term.endsOn)}`
            : null,
        lines,
        skipLines: plan.skipLines,
        remainders: plan.remainders,
        blocking,
        sections,
        plan: { adds: plannedAdds, removeIds: removes.map((item) => item.id) },
    };
    return { ok: true, review };
}

export type MaterialPlan = {
    adds: PlannedSlot[];
    removeIds: string[];
    unchangedIds: string[];
    bookings: { id: string; sessionId: string | null; studentId: string | null }[];
};

/** Hash the reviewed set, not the clock. A later instant is stale only when the materialized set or a booking identity changed. */
export function reviewToken(config: ScheduleConfig, publishedVersion: number, slots: LiveSlot[], otherBlocks: OtherBlock[], plan: MaterialPlan) {
    return createHash("sha256").update(stable({
        config: canonicalSchedule(config),
        publishedVersion,
        slots: slots.map((slot) => ({
            id: slot.id,
            startsAt: slot.startsAt.toISOString(),
            endsAt: slot.endsAt.toISOString(),
            status: slot.status,
            source: slot.source,
            termId: slot.termId,
            sessionId: slot.sessionId,
            studentId: slot.studentId,
        })).sort((left, right) => left.id.localeCompare(right.id)),
        blocks: otherBlocks.map((block) => ({ termId: block.termId, dates: [...block.dates].sort() })).sort((left, right) => left.termId.localeCompare(right.termId)),
        plan: {
            adds: [...plan.adds].sort((left, right) => left.startsAt.localeCompare(right.startsAt) || left.endsAt.localeCompare(right.endsAt)),
            removeIds: [...plan.removeIds].sort(),
            unchangedIds: [...plan.unchangedIds].sort(),
            bookings: [...plan.bookings].sort((left, right) => left.id.localeCompare(right.id)),
        },
    })).digest("hex");
}

type DesiredSlot = { startsAt: Date; endsAt: Date; durationMinutes: number; source: "TERM_PATTERN" | "TERM_OVERRIDE" };

function collectDesired(
    config: ScheduleConfig,
    slots: LiveSlot[],
    otherBlocks: OtherBlock[],
    now: Date,
    termId: string,
    term: TermBounds | null,
    historical: "reject" | "skip-historical" = "reject",
    published: ScheduleConfig | null = null,
): { ok: true; desired: DesiredSlot[]; remainders: string[]; skipLines: string[]; buckets: { key: string; category: string; items: ReviewItem[] }[]; blockedDate: { date: string; label: string } | null } | ScheduleIssue {
    if (!config.firstDay || !config.lastDay) {
        return { ok: false, title: "Choose a first and last day", description: "Both days are required and are included.", field: "first" };
    }
    const desired: DesiredSlot[] = [];
    const remainders: string[] = [];
    const buckets = {
        booking: bucket("booking", "overlap a booked session"),
        manual: bucket("manual", "overlap a one-off time"),
        other: bucket("other", "overlap another semester"),
        suppression: bucket("suppression", "overlap a removed or changed time"),
        lead: bucket("lead", "start too soon"),
        gap: bucket("gap", "that hour does not exist"),
    };
    let blockedDate: { date: string; label: string } | null = null;
    const taken: DesiredSlot[] = [];
    for (const replacement of config.replacements) {
        const placed = placeReplacement(config, replacement, slots, now, termId, term, taken, historical, published);
        if (!placed.ok) return placed;
        if (placed.skip) continue;
        if (placed.blocked) {
            blockedDate = placed.blocked;
            continue;
        }
        if (placed.slot) {
            const date = civilDateValue(placed.slot.startsAt);
            const block = otherBlocks.find((entry) => entry.termId !== termId && entry.dates.includes(date));
            if (block) {
                blockedDate ??= { date, label: block.label };
                continue;
            }
            desired.push(placed.slot);
            taken.push(placed.slot);
        }
    }
    const today = civilDateValue(now);
    for (const date of eachDate(config.firstDay, config.lastDay)) {
        if (date < today) continue;
        if (config.unavailableDates.includes(date)) continue;
        const civil = parseCivilDate(date);
        if (!civil) continue;
        const noon = easternInstant(civil.year, civil.month, civil.day, 12, 0);
        if (!noon) continue;
        const weekday = WEEKDAYS.indexOf(easternParts(noon).weekday as WeekdayName);
        const day = config.weekdays[weekday];
        if (!day || day.unavailable) continue;
        for (const window of day.windows) {
            const start = parseClock(window.start);
            const end = parseClock(window.end);
            if (!start || !end) continue;
            const unused = (end.minutes - start.minutes) % config.durationMinutes;
            if (unused > 0) {
                const samePeriod = start.hour >= 12 === end.hour >= 12;
                const range = `${formatClock(start.hour, start.minute, !samePeriod)}\u2013${formatClock(end.hour, end.minute)}`;
                remainders.push(`The last ${unused} minutes of ${WEEKDAYS[weekday]} ${range} are unused because they are shorter than a session.`);
            }
            for (let cursor = start.minutes; cursor + config.durationMinutes <= end.minutes; cursor += config.durationMinutes) {
                const hour = Math.floor(cursor / 60);
                const minute = cursor % 60;
                const startsAt = easternInstant(civil.year, civil.month, civil.day, hour, minute);
                if (!startsAt) {
                    buckets.gap.items.push(plainItem(`${date}-${cursor}`, civilDateLabel(date), formatClock(hour, minute), "Weekly hours"));
                    continue;
                }
                const endsAt = new Date(startsAt.getTime() + config.durationMinutes * 60 * 1000);
                const slot = { startsAt, endsAt, durationMinutes: config.durationMinutes, source: "TERM_PATTERN" as const };
                const reason = skipReason(slot, slots, config, termId, taken, now);
                if (reason === "keep") {
                    const block = otherBlocks.find((entry) => entry.termId !== termId && entry.dates.includes(date));
                    if (block) {
                        blockedDate ??= { date, label: block.label };
                        continue;
                    }
                    desired.push(slot);
                    continue;
                }
                const item = itemFromDesired(slot);
                buckets[reason].items.push(item);
            }
        }
    }
    const skipLines = [
        line(buckets.booking.items.length, "times skipped because they overlap a booked session"),
        line(buckets.manual.items.length, "times skipped because they overlap a one-off time"),
        line(buckets.other.items.length, "times skipped because they overlap another semester"),
        line(buckets.suppression.items.length, "times skipped because they overlap a removed or changed time"),
        line(buckets.lead.items.length, "times skipped because they start too soon"),
        line(buckets.gap.items.length, "times skipped because that hour does not exist"),
    ].filter((entry): entry is string => Boolean(entry));
    return { ok: true, desired, remainders, skipLines, buckets: Object.values(buckets), blockedDate };
}

function retainedOverride(slots: LiveSlot[], termId: string, start: Date, end: Date) {
    return slots.find((live) => live.termId === termId && live.source === "TERM_OVERRIDE" && live.startsAt.getTime() === start.getTime() && live.endsAt.getTime() === end.getTime()) ?? null;
}

function placeReplacement(
    config: ScheduleConfig,
    replacement: ScheduleReplacement,
    slots: LiveSlot[],
    now: Date,
    termId: string,
    term: TermBounds | null,
    taken: DesiredSlot[],
    historical: "reject" | "skip-historical",
    published: ScheduleConfig | null,
): { ok: true; slot?: DesiredSlot; skip?: boolean; blocked?: { date: string; label: string } } | ScheduleIssue {
    const start = new Date(replacement.next.startsAt);
    const end = new Date(replacement.next.endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
        return { ok: false, title: "This changed time overlaps another time", description: "Choose another time before publishing.", field: "dates" };
    }
    const retained = retainedOverride(slots, termId, start, end);
    const persisted = published?.replacements.some((item) => sameInterval(item.original, replacement.original) && sameInterval(item.next, replacement.next)) ?? false;
    const historicalInstance = historical === "skip-historical" || retained !== null || persisted;
    if (start.getTime() < now.getTime() + LEAD_TIME_MS) {
        if (historicalInstance) return { ok: true, skip: true };
        return { ok: false, ...issueCopy("lead", config.durationMinutes), field: "dates" };
    }
    const date = civilDateValue(start);
    if (term?.startsOn && term.endsOn && (date < term.startsOn || date > term.endsOn)) {
        return { ok: false, title: "Those days are outside this semester", description: `Choose dates inside ${term.label}.`, field: "dates" };
    }
    const civil = parseCivilDate(date);
    const noon = civil ? easternInstant(civil.year, civil.month, civil.day, 12, 0) : null;
    const weekday = noon ? WEEKDAYS.indexOf(easternParts(noon).weekday as WeekdayName) : -1;
    const day = config.weekdays[weekday];
    const outside = !config.firstDay || !config.lastDay || date < config.firstDay || date > config.lastDay;
    if (outside || config.unavailableDates.includes(date) || !day || day.unavailable) return { ok: true, skip: true };
    const checked = replacementBounds(start, end);
    if (!checked.ok) return { ok: false, ...issueCopy(checked.issue, config.durationMinutes), field: checked.issue === "duration" ? "length" : "dates" };
    if (retained?.status === "BOOKED") return { ok: true, skip: true };
    const slot = { startsAt: start, endsAt: end, durationMinutes: checked.duration, source: "TERM_OVERRIDE" as const };
    const reason = skipReason(slot, slots, config, termId, taken, now, replacement.original, retained?.id);
    if (reason !== "keep") {
        return { ok: false, title: "This changed time overlaps another time", description: "Choose another time before publishing.", field: "dates" };
    }
    return { ok: true, slot };
}

/** New replacements must be an exact allowed length on the 15-minute civil grid, inside one advising day. */
function replacementBounds(start: Date, end: Date): { ok: true; duration: number } | { ok: false; issue: "duration" | "step" | "bounds" | "gap" } {
    const exact = end.getTime() - start.getTime();
    if (exact <= 0 || exact % 60_000 !== 0) return { ok: false, issue: "duration" };
    const duration = exact / 60_000;
    if (!isMeetingDuration(duration)) return { ok: false, issue: "duration" };
    const startParts = easternParts(start);
    const endParts = easternParts(end);
    const canonicalStart = easternInstant(startParts.year, startParts.month, startParts.day, startParts.hour, startParts.minute);
    const canonicalEnd = easternInstant(endParts.year, endParts.month, endParts.day, endParts.hour, endParts.minute);
    if (!canonicalStart || !canonicalEnd) return { ok: false, issue: "gap" };
    if (canonicalStart.getTime() !== start.getTime() || canonicalEnd.getTime() !== end.getTime()) return { ok: false, issue: "step" };
    const startMinutes = startParts.hour * 60 + startParts.minute;
    const endMinutes = endParts.hour * 60 + endParts.minute;
    const sameDay = startParts.year === endParts.year && startParts.month === endParts.month && startParts.day === endParts.day;
    if (!sameDay || endMinutes > 21 * 60) return { ok: false, issue: "bounds" };
    if (startMinutes < 7 * 60 || startMinutes > 21 * 60 || startMinutes % 15 !== 0) return { ok: false, issue: "step" };
    return { ok: true, duration };
}

function skipReason(
    slot: DesiredSlot,
    slots: LiveSlot[],
    config: ScheduleConfig,
    termId: string,
    taken: DesiredSlot[],
    now: Date,
    ownOriginal?: ScheduleInterval,
    ignoreSlotId?: string,
): "keep" | "booking" | "manual" | "other" | "suppression" | "lead" {
    if (slot.startsAt.getTime() < now.getTime() + LEAD_TIME_MS) return "lead";
    if (slots.some((live) => live.id !== ignoreSlotId && live.status === "BOOKED" && rangesOverlap(slot.startsAt, slot.endsAt, live.startsAt, live.endsAt))) return "booking";
    if (slots.some((live) => live.status === "OPEN" && (live.source === "MANUAL" || live.source === "MANUAL_WINDOW") && rangesOverlap(slot.startsAt, slot.endsAt, live.startsAt, live.endsAt))) return "manual";
    if (slots.some((live) => live.status === "OPEN" && live.termId && live.termId !== termId && rangesOverlap(slot.startsAt, slot.endsAt, live.startsAt, live.endsAt))) return "other";
    const suppressed = config.suppressions.some((interval) => {
        if (ownOriginal && interval.startsAt === ownOriginal.startsAt && interval.endsAt === ownOriginal.endsAt) return false;
        const start = new Date(interval.startsAt);
        const end = new Date(interval.endsAt);
        return rangesOverlap(slot.startsAt, slot.endsAt, start, end);
    });
    if (suppressed) return "suppression";
    if (taken.some((item) => rangesOverlap(slot.startsAt, slot.endsAt, item.startsAt, item.endsAt))) return "suppression";
    return "keep";
}

function itemFromDesired(slot: DesiredSlot): ReviewItem {
    const stamp = meetingStamp(slot.startsAt, slot.endsAt);
    return {
        id: `${slot.startsAt.toISOString()}-${slot.endsAt.toISOString()}`,
        primary: stamp.dateHeading,
        secondary: `${stamp.time} · ${durationLabel(slot.durationMinutes)}`,
        fullTimestamp: stamp.full,
        sourceLabel: slot.source === "TERM_OVERRIDE" ? "Changed time" : "Weekly hours",
        studentName: null,
        note: null,
        startsAt: slot.startsAt.toISOString(),
    };
}

function itemFromSlot(slot: LiveSlot, source: string): ReviewItem {
    const stamp = meetingStamp(slot.startsAt, slot.endsAt);
    return {
        id: slot.id,
        primary: stamp.dateHeading,
        secondary: `${stamp.time} · ${durationLabel(slot.durationMinutes)}`,
        fullTimestamp: stamp.full,
        sourceLabel: source,
        studentName: slot.studentName,
        note: null,
        startsAt: slot.startsAt.toISOString(),
    };
}

function bookedItem(slot: LiveSlot, config: ScheduleConfig): ReviewItem {
    const item = itemFromSlot(slot, sourceLabel(slot, slot.termId));
    const date = civilDateValue(slot.startsAt);
    if (config.unavailableDates.includes(date)) {
        item.note = `${slot.studentName ?? "The student"} is booked on ${item.fullTimestamp}. That session stays as it is.`;
    }
    return item;
}

function sourceLabel(slot: LiveSlot, termId: string | null) {
    if (slot.source === "MANUAL") return "Added as a single time";
    if (slot.source === "MANUAL_WINDOW") return "Added as a window";
    if (slot.source === "TERM_OVERRIDE") return "Changed time";
    if (slot.termId && termId && slot.termId !== termId) return `Published in ${slot.termLabel ?? "another semester"}`;
    return "Weekly hours";
}

function plainItem(id: string, primary: string, secondary: string, sourceLabelText: string): ReviewItem {
    return { id, primary, secondary, fullTimestamp: `${primary}, ${secondary}`, sourceLabel: sourceLabelText, studentName: null, note: null, startsAt: null };
}

function bucket(key: string, category: string) {
    return { key, category, items: [] as ReviewItem[] };
}

function sameInterval(left: ScheduleInterval, right: ScheduleInterval) {
    const leftStart = new Date(left.startsAt).getTime();
    const rightStart = new Date(right.startsAt).getTime();
    const leftEnd = new Date(left.endsAt).getTime();
    const rightEnd = new Date(right.endsAt).getTime();
    return leftStart === rightStart && leftEnd === rightEnd && !Number.isNaN(leftStart) && !Number.isNaN(leftEnd);
}

function line(count: number, text: string) {
    if (count === 0) return null;
    if (count === 1 && text.startsWith("times ")) {
        return `1 time ${text.slice("times ".length).replace("they overlap", "it overlaps").replace("they start", "it starts")}`;
    }
    return `${count} ${text}`;
}

function eachDate(first: string, last: string) {
    const dates: string[] = [];
    let cursor = first;
    while (cursor <= last) {
        dates.push(cursor);
        const next = addCivilDays(cursor, 1);
        if (next <= cursor) break;
        cursor = next;
        if (dates.length > 800) throw new Error("semester range is longer than 800 days");
    }
    return dates;
}

function addCivilDays(value: string, days: number) {
    const parsed = parseCivilDate(value);
    if (!parsed) return value;
    const utc = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days));
    return `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, "0")}-${String(utc.getUTCDate()).padStart(2, "0")}`;
}

function readIntervals(value: unknown[]): ScheduleInterval[] | null {
    const intervals: ScheduleInterval[] = [];
    for (const entry of value) {
        if (!entry || typeof entry !== "object") return null;
        const record = entry as Record<string, unknown>;
        if (typeof record.startsAt !== "string" || typeof record.endsAt !== "string") return null;
        intervals.push({ startsAt: record.startsAt, endsAt: record.endsAt });
    }
    return intervals;
}

function readReplacements(value: unknown[]): ScheduleReplacement[] | null {
    const replacements: ScheduleReplacement[] = [];
    for (const entry of value) {
        if (!entry || typeof entry !== "object") return null;
        const record = entry as Record<string, unknown>;
        const original = readIntervals([record.original])?.[0];
        const next = readIntervals([record.next])?.[0];
        if (!original || !next) return null;
        replacements.push({ original, next });
    }
    return replacements;
}

function stable(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map((item) => stable(item)).join(",")}]`;
    if (value && typeof value === "object") {
        return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
    }
    return JSON.stringify(value);
}
