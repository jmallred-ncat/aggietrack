import assert from "node:assert/strict";
import test from "node:test";
import { appointmentsHref } from "../components/advising/advisor-availability";
import {
    adoptTermEditor,
    baselineAfterSave,
    buildReview,
    coversExactInterval,
    emptySchedule,
    explainWindow,
    type LiveSlot,
    type ScheduleConfig,
    type TermBounds,
} from "./advising-schedule";
import { easternInstant } from "./advising-time";

const now = new Date("2026-11-08T15:00:00.000Z");

const spring: TermBounds = { id: "spring", label: "Spring 2027", startsOn: "2027-01-11", endsOn: "2027-05-07" };
const fall: TermBounds = { id: "fall", label: "Fall 2026", startsOn: "2026-08-19", endsOn: "2026-12-11" };

function mondayHours(bounds: TermBounds, start = "14:00", end = "16:00", length = 30): ScheduleConfig {
    const config = emptySchedule(bounds);
    config.durationMinutes = length;
    config.weekdays[1] = { unavailable: false, windows: [{ start, end }] };
    return config;
}

function slot(partial: Partial<LiveSlot> & Pick<LiveSlot, "id" | "startsAt" | "endsAt">): LiveSlot {
    return {
        durationMinutes: 30,
        status: "OPEN",
        source: "TERM_PATTERN",
        termId: "fall",
        termLabel: "Fall 2026",
        studentName: null,
        studentId: null,
        sessionId: null,
        ...partial,
    };
}

test("theoretical spring-forward generator skips a nonexistent civil start", () => {
    const explained = explainWindow({
        date: "2026-03-08",
        start: "02:00",
        end: "03:00",
        durationMinutes: 30,
        now: new Date("2026-03-01T15:00:00.000Z"),
    });
    assert.equal(explained.slots, 0);
    assert.ok(explained.missingHourSkips > 0);
    assert.equal(easternInstant(2026, 3, 8, 2, 30), null);
});

test("full future term is not clipped to 16 weeks and the last day is included", () => {
    const review = buildReview({
        config: mondayHours(spring),
        term: spring,
        hasPublished: false,
        publishedVersion: 0,
        slots: [],
        otherBlocks: [],
        now,
    });
    assert.equal(review.ok, true);
    if (!review.ok) return;
    const mondays = review.review.sections.find((section) => section.key === "adds")?.items ?? [];
    assert.ok(mondays.length > 16, `expected every Monday in Spring 2027, got ${mondays.length}`);
    assert.ok(mondays.some((item) => item.primary.includes("May")));
    assert.equal(mondays.some((item) => item.fullTimestamp.includes("May 3, 2027")), true);
    assert.equal(review.review.lines[0], `This adds ${mondays.length} open times.`);
});

test("a 75-minute window leaves a 15-minute remainder and two sessions", () => {
    const config = mondayHours(fall, "14:00", "15:15");
    config.firstDay = "2026-11-09";
    config.lastDay = "2026-11-09";
    const review = buildReview({ config, term: fall, hasPublished: false, publishedVersion: 0, slots: [], otherBlocks: [], now });
    assert.equal(review.ok, true);
    if (!review.ok) return;
    const adds = review.review.sections.find((section) => section.key === "adds");
    assert.equal(adds?.items.length, 2);
    assert.match(review.review.remainders[0] ?? "", /The last 15 minutes of Monday 2:00–3:15 PM are unused/);
});

test("missing term dates block review and do not invent a range", () => {
    const term: TermBounds = { id: "open", label: "Summer 2027", startsOn: null, endsOn: null };
    const review = buildReview({
        config: emptySchedule(term),
        term,
        hasPublished: false,
        publishedVersion: 0,
        slots: [],
        otherBlocks: [],
        now,
    });
    assert.equal(review.ok, false);
    if (review.ok) return;
    assert.equal(review.title, "Semester dates are unavailable");
    assert.equal(review.description.includes("16"), false);
});

test("interval overlap skips a longer neighbor and keeps a booking", () => {
    const config = mondayHours(fall, "14:00", "16:00", 45);
    config.firstDay = "2026-11-09";
    config.lastDay = "2026-11-09";
    const start = easternInstant(2026, 11, 9, 14, 0);
    assert.ok(start);
    const booked = slot({
        id: "booked",
        startsAt: start,
        endsAt: new Date(start.getTime() + 30 * 60 * 1000),
        status: "BOOKED",
        studentName: "Avery Cole",
        sessionId: "session-1",
    });
    const review = buildReview({
        config,
        term: fall,
        hasPublished: true,
        publishedVersion: 1,
        slots: [booked],
        otherBlocks: [],
        now,
    });
    assert.equal(review.ok, true);
    if (!review.ok) return;
    const added = review.review.sections.find((section) => section.key === "adds")?.items ?? [];
    assert.equal(added.some((item) => item.fullTimestamp.includes("2:00")), false);
    assert.match(review.review.skipLines.join("\n"), /overlap a booked session/);
    const kept = review.review.sections.find((section) => section.key === "bookings");
    assert.equal(kept?.items[0]?.studentName, "Avery Cole");
    assert.equal(kept?.items.some((item) => item.note?.includes("Cancel")), false);
});

test("a suppressed interval is not recreated when the session length changes", () => {
    const config = mondayHours(fall, "14:00", "16:00", 45);
    config.firstDay = "2026-11-09";
    config.lastDay = "2026-11-09";
    const start = easternInstant(2026, 11, 9, 14, 0);
    assert.ok(start);
    config.suppressions = [{ startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 30 * 60 * 1000).toISOString() }];
    const review = buildReview({ config, term: fall, hasPublished: true, publishedVersion: 2, slots: [], otherBlocks: [], now });
    assert.equal(review.ok, true);
    if (!review.ok) return;
    const adds = review.review.sections.find((section) => section.key === "adds")?.items ?? [];
    assert.equal(adds.some((item) => item.fullTimestamp.includes("2:00")), false);
    assert.match(review.review.skipLines.join("\n"), /removed or changed time/);
});

test("same-term open times are removals, and a manual time blocks an unavailable date", () => {
    const config = mondayHours(fall);
    config.firstDay = "2026-11-16";
    config.lastDay = "2026-11-16";
    config.unavailableDates = ["2026-11-16"];
    const pattern = easternInstant(2026, 11, 16, 14, 0);
    const manual = easternInstant(2026, 11, 16, 10, 0);
    assert.ok(pattern && manual);
    const review = buildReview({
        config,
        term: fall,
        hasPublished: true,
        publishedVersion: 3,
        slots: [
            slot({ id: "pattern", startsAt: pattern, endsAt: new Date(pattern.getTime() + 30 * 60 * 1000) }),
            slot({ id: "manual", startsAt: manual, endsAt: new Date(manual.getTime() + 30 * 60 * 1000), source: "MANUAL", termId: null }),
        ],
        otherBlocks: [],
        now,
    });
    assert.equal(review.ok, true);
    if (!review.ok) return;
    assert.equal(review.review.sections.some((section) => section.key === "removes" && section.items.some((item) => item.id === "pattern")), true);
    assert.equal(review.review.blocking[0]?.title, "This date still has times outside this semester schedule.");
    assert.equal(review.review.blocking[0]?.times[0]?.sourceLabel, "Added as a single time");
    assert.equal(review.review.blocking[0]?.times.some((item) => item.id === "pattern"), false);
});

test("another semester unavailable date blocks publish without absorbing that semester", () => {
    const config = mondayHours(spring);
    config.firstDay = "2027-01-11";
    config.lastDay = "2027-01-11";
    const review = buildReview({
        config,
        term: spring,
        hasPublished: false,
        publishedVersion: 0,
        slots: [],
        otherBlocks: [{ termId: "fall", label: "Fall 2026", dates: ["2027-01-11"] }],
        now,
    });
    assert.equal(review.ok, true);
    if (!review.ok) return;
    assert.match(review.review.blocking[0]?.description ?? "", /Fall 2026/);
    assert.equal(review.review.sections.some((section) => section.key === "adds"), false);
});

test("released coverage requires the exact published interval", () => {
    const config = mondayHours(fall);
    const start = easternInstant(2026, 11, 16, 14, 0);
    assert.ok(start);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    assert.equal(coversExactInterval(config, start, end, now), true);
    const longer = mondayHours(fall, "14:00", "16:00", 45);
    assert.equal(coversExactInterval(longer, start, end, now), false);
    config.unavailableDates = ["2026-11-16"];
    assert.equal(coversExactInterval(config, start, end, now), false);
    config.unavailableDates = [];
    config.suppressions = [{ startsAt: start.toISOString(), endsAt: end.toISOString() }];
    assert.equal(coversExactInterval(config, start, end, now), false);
});

test("a destination semester replaces a dirty editor, and a late save cannot rewrite it", () => {
    const springEditor = mondayHours(spring, "08:00", "12:00");
    springEditor.weekdays[2] = { unavailable: false, windows: [{ start: "14:00", end: "17:00" }] };
    springEditor.unavailableDates = ["2027-02-16"];
    const fallPublished = mondayHours(fall);
    const holdingSpring = {
        termId: "spring",
        editor: springEditor,
        baseline: mondayHours(spring),
        revision: "spring:1:draft",
    };
    const switched = adoptTermEditor(holdingSpring, { selectedTermId: "fall", config: fallPublished, revision: "fall:3:none" });
    assert.equal(switched.termId, "fall");
    assert.equal(switched.editor.firstDay, fall.startsOn);
    assert.equal(switched.editor.weekdays[2]?.unavailable, true);
    assert.deepEqual(switched.editor.unavailableDates, []);
    assert.equal(switched.baseline, switched.editor);
    const late = baselineAfterSave(switched, "spring", springEditor);
    assert.equal(late.baseline.firstDay, fall.startsOn);
    const dirtySameTerm = adoptTermEditor(holdingSpring, { selectedTermId: "spring", config: fallPublished, revision: "spring:2:draft" });
    assert.equal(dirtySameTerm.editor, springEditor);
});

test("one booked session and one unavailable date are singular, and a booked-only date does not block", () => {
    const config = mondayHours(fall);
    config.firstDay = "2026-11-16";
    config.lastDay = "2026-11-16";
    config.unavailableDates = ["2026-11-16"];
    const start = easternInstant(2026, 11, 16, 14, 0);
    assert.ok(start);
    const review = buildReview({
        config,
        term: fall,
        hasPublished: true,
        publishedVersion: 2,
        slots: [slot({
            id: "booked-only",
            startsAt: start,
            endsAt: new Date(start.getTime() + 30 * 60 * 1000),
            status: "BOOKED",
            sessionId: "session-a",
            studentId: "student-a",
            studentName: "Avery Cole",
        })],
        otherBlocks: [],
        now,
    });
    assert.equal(review.ok, true);
    if (!review.ok) return;
    assert.equal(review.review.blocking.length, 0);
    assert.match(review.review.lines.join("\n"), /1 date will be unavailable/);
    assert.match(review.review.lines.join("\n"), /1 booked session stays as it is/);
    assert.equal(review.review.sections.find((section) => section.key === "dates")?.expandLabel, "Show 1 unavailable date");
    assert.equal(review.review.sections.find((section) => section.key === "bookings")?.expandLabel, "Show 1 booked session that stays");
});

test("crossing the 15-minute lead changes the reviewed set and token without hashing the clock", () => {
    const config = mondayHours(fall, "14:00", "14:30");
    config.firstDay = "2026-11-09";
    config.lastDay = "2026-11-09";
    const included = buildReview({ config, term: fall, hasPublished: false, publishedVersion: 0, slots: [], otherBlocks: [], now: new Date("2026-11-09T18:44:00.000Z") });
    const skipped = buildReview({ config, term: fall, hasPublished: false, publishedVersion: 0, slots: [], otherBlocks: [], now: new Date("2026-11-09T18:46:00.000Z") });
    assert.equal(included.ok && skipped.ok, true);
    if (!included.ok || !skipped.ok) return;
    assert.equal(included.review.plan.adds.length, 1);
    assert.equal(skipped.review.plan.adds.length, 0);
    assert.notEqual(included.review.token, skipped.review.token);
    const again = buildReview({ config, term: fall, hasPublished: false, publishedVersion: 0, slots: [], otherBlocks: [], now: new Date("2026-11-09T18:44:30.000Z") });
    if (!again.ok) return;
    assert.equal(again.review.token, included.review.token);
});

test("a rebooked session changes the token while the slot id and status stay booked", () => {
    const config = mondayHours(fall);
    config.firstDay = "2026-11-16";
    config.lastDay = "2026-11-16";
    const start = easternInstant(2026, 11, 16, 14, 0);
    assert.ok(start);
    const shared = { id: "slot", startsAt: start, endsAt: new Date(start.getTime() + 30 * 60 * 1000), status: "BOOKED" as const };
    const first = buildReview({
        config, term: fall, hasPublished: true, publishedVersion: 1, otherBlocks: [], now,
        slots: [slot({ ...shared, sessionId: "session-a", studentId: "student-a", studentName: "Avery Cole" })],
    });
    const second = buildReview({
        config, term: fall, hasPublished: true, publishedVersion: 1, otherBlocks: [], now,
        slots: [slot({ ...shared, sessionId: "session-b", studentId: "student-b", studentName: "Blair Diaz" })],
    });
    assert.equal(first.ok && second.ok, true);
    if (!first.ok || !second.ok) return;
    assert.notEqual(first.review.token, second.review.token);
});

test("an expired override does not block a later weekly interval, and a booked override can be republished", () => {
    const config = mondayHours(fall);
    config.firstDay = "2026-11-09";
    config.lastDay = "2026-11-16";
    const past = easternInstant(2026, 11, 9, 14, 0);
    const future = easternInstant(2026, 11, 16, 14, 0);
    assert.ok(past && future);
    config.replacements = [{
        original: { startsAt: past.toISOString(), endsAt: new Date(past.getTime() + 30 * 60 * 1000).toISOString() },
        next: { startsAt: past.toISOString(), endsAt: new Date(past.getTime() + 30 * 60 * 1000).toISOString() },
    }];
    const later = new Date("2026-11-10T15:00:00.000Z");
    assert.equal(coversExactInterval(config, future, new Date(future.getTime() + 30 * 60 * 1000), later), true);
    const bookedStart = easternInstant(2026, 11, 16, 15, 0);
    assert.ok(bookedStart);
    const republish = mondayHours(fall);
    republish.firstDay = "2026-11-16";
    republish.lastDay = "2026-11-16";
    republish.replacements = [{
        original: { startsAt: future.toISOString(), endsAt: new Date(future.getTime() + 30 * 60 * 1000).toISOString() },
        next: { startsAt: bookedStart.toISOString(), endsAt: new Date(bookedStart.getTime() + 30 * 60 * 1000).toISOString() },
    }];
    const review = buildReview({
        config: republish,
        term: fall,
        hasPublished: true,
        publishedVersion: 4,
        slots: [slot({
            id: "override",
            startsAt: bookedStart,
            endsAt: new Date(bookedStart.getTime() + 30 * 60 * 1000),
            source: "TERM_OVERRIDE",
            status: "BOOKED",
            sessionId: "session-kept",
            studentId: "student-a",
            studentName: "Avery Cole",
        })],
        otherBlocks: [],
        now,
    });
    assert.equal(review.ok, true);
    if (!review.ok) return;
    assert.equal(review.review.plan.adds.some((item) => item.startsAt === bookedStart.toISOString()), false);
    assert.equal(review.review.plan.removeIds.includes("override"), false);
});

test("a new replacement must use an exact allowed grid interval inside the semester", () => {
    const config = mondayHours(fall);
    config.firstDay = "2026-11-16";
    config.lastDay = "2026-11-16";
    const start = easternInstant(2026, 11, 16, 14, 7);
    const aligned = easternInstant(2026, 11, 16, 14, 0);
    assert.ok(start && aligned);
    config.replacements = [{
        original: { startsAt: aligned.toISOString(), endsAt: new Date(aligned.getTime() + 30 * 60 * 1000).toISOString() },
        next: { startsAt: start.toISOString(), endsAt: new Date(start.getTime() + 30 * 60 * 1000).toISOString() },
    }];
    const offGrid = buildReview({ config, term: fall, hasPublished: true, publishedVersion: 1, slots: [], otherBlocks: [], now });
    assert.equal(offGrid.ok, false);
    const outside = easternInstant(2027, 1, 12, 14, 0);
    assert.ok(outside);
    config.replacements[0]!.next = { startsAt: outside.toISOString(), endsAt: new Date(outside.getTime() + 30 * 60 * 1000).toISOString() };
    const wrongTerm = buildReview({ config, term: fall, hasPublished: true, publishedVersion: 1, slots: [], otherBlocks: [], now });
    assert.equal(wrongTerm.ok, false);
    if (wrongTerm.ok) return;
    assert.equal(wrongTerm.title, "Those days are outside this semester");
});

test("appointment links keep unrelated query keys", () => {
    assert.equal(
        appointmentsHref("view=availability&term=spring&session=abc&ref=1", { view: null }),
        "/advisor/appointments?term=spring&session=abc&ref=1",
    );
    assert.equal(
        appointmentsHref("view=availability&term=spring&ref=1", { term: "fall" }),
        "/advisor/appointments?view=availability&term=fall&ref=1",
    );
});

test("an unfinished weekday is allowed to parse and is rejected only for publish", () => {
    const config = emptySchedule(fall);
    config.weekdays[1] = { unavailable: false, windows: [] };
    const review = buildReview({ config, term: fall, hasPublished: false, publishedVersion: 0, slots: [], otherBlocks: [], now });
    assert.equal(review.ok, false);
    if (review.ok) return;
    assert.equal(review.title, "Add hours for Monday");
});
