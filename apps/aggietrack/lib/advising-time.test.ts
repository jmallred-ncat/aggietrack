import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    buildSingleSlot,
    buildWindowSlots,
    easternInstant,
    easternParts,
    meetingStamp,
    pointStamp,
} from "./advising-time";

describe("eastern advising time", () => {
    it("uses the earlier Eastern instant when the clock falls back", () => {
        const earlier = easternInstant(2026, 11, 1, 1, 30);
        assert.ok(earlier);
        assert.equal(earlier.toISOString(), "2026-11-01T05:30:00.000Z");
        assert.equal(easternParts(earlier).zone, "EDT");
        const later = new Date("2026-11-01T06:30:00.000Z");
        assert.equal(easternParts(later).hour, 1);
        assert.equal(easternParts(later).minute, 30);
        assert.equal(easternParts(later).zone, "EST");
    });

    it("rejects the spring-forward gap", () => {
        assert.equal(easternInstant(2026, 3, 8, 2, 30), null);
        const built = buildSingleSlot({
            date: "2026-03-08",
            start: "02:30",
            durationMinutes: 30,
            now: new Date("2026-03-01T15:00:00.000Z"),
        });
        assert.equal(built.ok, false);
        if (!built.ok) assert.equal(built.issue, "gap");
    });

    it("labels a stored duration in Eastern Time without splitting the clock", () => {
        const start = easternInstant(2026, 11, 10, 14, 0);
        assert.ok(start);
        const end = new Date(start.getTime() + 20 * 60 * 1000);
        const stamp = meetingStamp(start, end);
        assert.equal(stamp.full, "Tuesday, November 10, 2026, 2:00–2:20 PM EST");
        assert.equal(stamp.time, "2:00–2:20 PM EST");
        assert.equal(stamp.slotLabel, "2:00–2:20 PM");
        const noticed = pointStamp(new Date("2026-11-08T14:00:00.000Z"));
        assert.equal(noticed.full, "Sunday, November 8, 2026, 9:00 AM EST");
        assert.equal(noticed.time, "9:00 AM EST");
        assert.equal(noticed.time.includes("–"), false);
    });

    it("keeps a short window from inventing a session", () => {
        const built = buildWindowSlots({
            date: "2026-11-10",
            start: "14:00",
            end: "14:15",
            durationMinutes: 30,
            now: new Date("2026-11-01T15:00:00.000Z"),
        });
        assert.equal(built.ok, false);
        if (!built.ok) assert.equal(built.issue, "short");
    });

    it("rejects a start that would end after 9:00 PM", () => {
        const built = buildSingleSlot({
            date: "2026-11-10",
            start: "20:45",
            durationMinutes: 30,
            now: new Date("2026-11-01T15:00:00.000Z"),
        });
        assert.equal(built.ok, false);
        if (!built.ok) assert.equal(built.issue, "short");
    });

    it("builds the slots that fit a window at the stored duration", () => {
        const built = buildWindowSlots({
            date: "2026-11-10",
            start: "14:00",
            end: "15:00",
            durationMinutes: 30,
            now: new Date("2026-11-01T15:00:00.000Z"),
        });
        assert.equal(built.ok, true);
        if (built.ok) {
            assert.equal(built.slots.length, 2);
            assert.equal(built.slots[0]?.startsAt.toISOString(), "2026-11-10T19:00:00.000Z");
            assert.equal(built.slots[1]?.startsAt.toISOString(), "2026-11-10T19:30:00.000Z");
            assert.equal(built.slots[0]?.durationMinutes, 30);
        }
    });
});
