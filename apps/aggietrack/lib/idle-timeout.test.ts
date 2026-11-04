import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
    IDLE_INPUT_EVENTS,
    IDLE_LIMIT_MS,
    IDLE_SIGNED_OUT_MESSAGE,
    IDLE_SIGN_IN_HREF,
    IDLE_WARNING_MESSAGE,
    IDLE_WARN_MS,
    SESSION_EXPIRES_IN_SECONDS,
    SESSION_UPDATE_AGE_SECONDS,
    adoptSharedActivity,
    dismissWarning,
    initialIdleClock,
    noteInput,
    readIdle,
    signedOutReasonMessage,
} from "./idle-timeout";

const minute = 60 * 1000;

test("Better Auth session slides for 30 minutes and refreshes every 5", () => {
    assert.equal(SESSION_EXPIRES_IN_SECONDS, 60 * 30);
    assert.equal(SESSION_UPDATE_AGE_SECONDS, 60 * 5);
    const source = readFileSync(new URL("./auth.ts", import.meta.url), "utf8");
    assert.match(source, /session:\s*\{[^}]*expiresIn:\s*SESSION_EXPIRES_IN_SECONDS[^}]*updateAge:\s*SESSION_UPDATE_AGE_SECONDS[^}]*\}/s);
});

test("warns at 28 minutes and signs out after 30 (T-33)", () => {
    const clock = initialIdleClock(0);
    assert.equal(readIdle(clock, IDLE_WARN_MS - 1).phase, "active");

    const warning = readIdle(clock, IDLE_WARN_MS);
    assert.equal(warning.phase, "warn");
    assert.equal(warning.showWarning, true);
    assert.equal(warning.signOut, false);

    const inside = readIdle(clock, 29 * minute + 59 * 1000);
    assert.equal(inside.signOut, false);
    assert.equal(inside.showWarning, true);

    const expired = readIdle(clock, IDLE_LIMIT_MS + 1000);
    assert.equal(expired.phase, "sign-out");
    assert.equal(expired.signOut, true);
    assert.equal(expired.showWarning, false);
});

test("a real action at minute 20 keeps minute 35 and ends at 50 minutes 1 second (T-34)", () => {
    const acted = noteInput(initialIdleClock(0), 20 * minute);
    assert.equal(acted.refreshSession, true);
    assert.equal(readIdle(acted.clock, 35 * minute).phase, "active");
    assert.equal(readIdle(acted.clock, 35 * minute).signOut, false);
    assert.equal(readIdle(acted.clock, 48 * minute).showWarning, true);
    assert.equal(readIdle(acted.clock, 50 * minute + 1000).signOut, true);
});

test("background polling does not reset the idle clock", () => {
    const ignored = ["fetch", "visibilitychange", "focus", "online", "pointermove", "mousemove", "resize"];
    for (const name of ignored) {
        assert.equal(IDLE_INPUT_EVENTS.includes(name as (typeof IDLE_INPUT_EVENTS)[number]), false);
    }
    const clock = initialIdleClock(0);
    assert.equal(readIdle(clock, IDLE_LIMIT_MS + 1000).signOut, true);
});

test("dismissing the warning does not start the 30 minutes over", () => {
    const clock = dismissWarning(initialIdleClock(0));
    const warning = readIdle(clock, IDLE_WARN_MS);
    assert.equal(warning.showWarning, false);
    assert.equal(warning.signOut, false);
    assert.equal(readIdle(clock, IDLE_LIMIT_MS).signOut, true);
});

test("input after the warning starts the 30 minutes over and touches the session after 5 minutes", () => {
    const early = noteInput(initialIdleClock(0), 4 * minute);
    assert.equal(early.refreshSession, false);
    assert.equal(readIdle(early.clock, 4 * minute).phase, "active");

    const due = noteInput(early.clock, 5 * minute);
    assert.equal(due.refreshSession, true);
    assert.equal(readIdle(due.clock, 32 * minute).phase, "active");
    assert.equal(readIdle(due.clock, 33 * minute).phase, "warn");
    assert.equal(readIdle(due.clock, 35 * minute).signOut, true);
});

test("activity in another tab resets this tab and an older timestamp does not", () => {
    const shared = adoptSharedActivity(initialIdleClock(0), 20 * minute, 20 * minute);
    assert.equal(readIdle(shared, 35 * minute).phase, "active");

    const later = noteInput(initialIdleClock(0), 20 * minute).clock;
    assert.equal(adoptSharedActivity(later, 5 * minute, 21 * minute), later);
    assert.equal(readIdle(adoptSharedActivity(initialIdleClock(0), 10 * minute, 40 * minute), 40 * minute).signOut, true);
});

test("the sign-in page explains an idle sign-out in plain language", () => {
    const message = signedOutReasonMessage("idle");
    assert.equal(message, IDLE_SIGNED_OUT_MESSAGE);
    assert.match(message ?? "", /30 minutes/);
    assert.doesNotMatch(message ?? "", /reason=idle|\bidle\b|DRAFT|SESSION/);
    assert.equal(signedOutReasonMessage("other"), null);
    assert.equal(signedOutReasonMessage(null), null);
    assert.match(IDLE_WARNING_MESSAGE, /2 minutes/);
    assert.equal(IDLE_SIGN_IN_HREF, "/sign-in?reason=idle");
});
