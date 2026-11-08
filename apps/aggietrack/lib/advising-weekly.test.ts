import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";
import { STUDENT_HORIZON_MS } from "./advising-time";
import { addAvailability, bookSlot, cancelSession, loadStudentAdvising } from "./advising-meetings";
import { discardTermDraft, publishTerm, reviewTerm, saveTermDraft } from "./advising-publish";
import { emptySchedule, type ScheduleConfig } from "./advising-schedule";
import { migrateDatabaseName, migrateEnvForScratch, openAdvisingTestClient, resolveAdvisingTestTarget } from "./advising-test-target";

const now = new Date("2026-11-08T15:00:00.000Z");
let live: PrismaClient | null = null;
let ready = false;
let skipReason = "AGT17_DATABASE_URL is unset or is not a disposable local scratch database";

before(async () => {
    const target = resolveAdvisingTestTarget(process.env);
    if (!target.ok) {
        skipReason = target.reason;
        return;
    }
    const migrateEnv = migrateEnvForScratch(target.url, process.env);
    if (migrateDatabaseName(migrateEnv) !== target.database) {
        skipReason = "migrate URL does not resolve to the scratch database";
        return;
    }
    live = openAdvisingTestClient(target, (url) => new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) }));
    if (!live) return;
    try {
        await live.$queryRaw`SELECT 1 FROM "AdvisorTermDraft" LIMIT 1`;
        ready = true;
    } catch {
        skipReason = "the scratch database does not have the weekly schedule migration";
        await live.$disconnect().catch(() => undefined);
        live = null;
    }
});

after(async () => {
    if (live) await live.$disconnect();
});

function client() {
    if (!live) throw new Error("weekly tests are not connected");
    return live;
}

function skip(t: { skip: (message?: string) => void }) {
    if (ready && live) return false;
    t.skip(skipReason);
    return true;
}

async function fixture() {
    const suffix = randomUUID().slice(0, 8);
    const year = 4000 + Math.floor(Math.random() * 4000);
    const degree = await client().degree.create({ data: { name: `Degree ${suffix}`, abbreviation: `D${suffix}`, level: "BACCALAUREATE" } });
    const department = await client().department.create({ data: { name: `Department ${suffix}`, abbreviation: `P${suffix}` } });
    const program = await client().program.create({ data: { code: `C${suffix}`, name: `Program ${suffix}`, degreeId: degree.id, departmentId: department.id } });
    const catalog = await client().catalogYear.create({ data: { programId: program.id, year: 2026 } });
    const advisor = await client().user.create({ data: { id: randomUUID(), name: "Sarah Martinez", email: `sarah-${suffix}@example.test`, firstName: "Sarah", lastName: "Martinez", role: "ADVISOR", emailVerified: true } });
    const otherAdvisor = await client().user.create({ data: { id: randomUUID(), name: "Riley Advisor", email: `riley-${suffix}@example.test`, firstName: "Riley", lastName: "Advisor", role: "ADVISOR", emailVerified: true } });
    const studentUser = await client().user.create({ data: { id: randomUUID(), name: "Avery Cole", email: `avery-${suffix}@example.test`, firstName: "Avery", lastName: "Cole", role: "STUDENT", emailVerified: true } });
    const student = await client().studentProfile.create({ data: { userId: studentUser.id, catalogYearId: catalog.id, advisorId: advisor.id, startConfirmedAt: now } });
    const fall = await client().academicTerm.create({ data: { season: "FALL", year, startsOn: new Date("2026-08-19T12:00:00.000Z"), endsOn: new Date("2026-12-11T12:00:00.000Z") } });
    const spring = await client().academicTerm.create({ data: { season: "SPRING", year: year + 1, startsOn: new Date("2027-01-11T12:00:00.000Z"), endsOn: new Date("2027-05-07T12:00:00.000Z") } });
    return { suffix, degree, department, program, catalog, advisor, otherAdvisor, studentUser, student, fall, spring };
}

async function cleanup(people: Awaited<ReturnType<typeof fixture>>) {
    const advisorIds = [people.advisor.id, people.otherAdvisor.id];
    await client().meetingSession.deleteMany({ where: { advisorId: { in: advisorIds } } });
    await client().meetingAvailability.deleteMany({ where: { advisorId: { in: advisorIds } } });
    await client().advisorTermDraft.deleteMany({ where: { advisorId: { in: advisorIds } } });
    await client().advisorTermSchedule.deleteMany({ where: { advisorId: { in: advisorIds } } });
    await client().advisorMeetingSettings.deleteMany({ where: { advisorId: { in: advisorIds } } });
    await client().user.deleteMany({ where: { id: { in: [people.studentUser.id, people.advisor.id, people.otherAdvisor.id] } } });
    await client().academicTerm.deleteMany({ where: { id: { in: [people.fall.id, people.spring.id] } } });
    await client().catalogYear.deleteMany({ where: { programId: people.program.id } });
    await client().program.delete({ where: { id: people.program.id } });
    await client().department.delete({ where: { id: people.department.id } });
    await client().degree.delete({ where: { id: people.degree.id } });
}

function monday(bounds: { startsOn: string; endsOn: string }, start = "14:00", end = "16:00", length = 30): ScheduleConfig {
    const config = emptySchedule(bounds);
    config.durationMinutes = length;
    config.weekdays[1] = { unavailable: false, windows: [{ start, end }] };
    return config;
}

test("an incomplete draft is saved and stays invisible to the assigned student", async (t) => {
    if (skip(t)) return;
    const people = await fixture();
    try {
        const config = emptySchedule({ startsOn: "2026-08-19", endsOn: "2026-12-11" });
        config.weekdays[1] = { unavailable: false, windows: [] };
        const saved = await saveTermDraft(client(), people.advisor.id, people.fall.id, config);
        assert.equal(saved.ok, true);
        const review = await reviewTerm(client(), people.advisor.id, people.fall.id, config, now);
        assert.equal(review.ok, false);
        if (!review.ok) assert.equal(review.title, "Add hours for Monday");
        const student = await loadStudentAdvising(client(), people.studentUser.id, now);
        assert.equal(student?.slots.length, 0);
        const other = await saveTermDraft(client(), people.otherAdvisor.id, people.fall.id, monday({ startsOn: "2026-08-19", endsOn: "2026-12-11" }));
        assert.equal(other.ok, true);
        assert.equal((await loadStudentAdvising(client(), people.studentUser.id, now))?.slots.length, 0);
    } finally {
        await cleanup(people);
    }
});

test("publishing a future semester stores times past eight and sixteen weeks without showing them to the student yet", async (t) => {
    if (skip(t)) return;
    const people = await fixture();
    try {
        const config = monday({ startsOn: "2027-01-11", endsOn: "2027-05-07" });
        const review = await reviewTerm(client(), people.advisor.id, people.spring.id, config, now);
        assert.equal(review.ok, false);
        if (review.ok || !review.review) return;
        assert.ok(review.review.plan.adds.length > 16);
        assert.equal(review.review.plan.adds.some((slot) => slot.startsAt.startsWith("2027-05-")), true);
        const published = await publishTerm(client(), people.advisor.id, people.spring.id, review.review.token, now);
        assert.equal(published.ok, true, JSON.stringify(published));
        const stored = await client().meetingAvailability.count({ where: { advisorId: people.advisor.id, termId: people.spring.id, source: "TERM_PATTERN" } });
        assert.equal(stored, review.review.plan.adds.length);
        const student = await loadStudentAdvising(client(), people.studentUser.id, now);
        assert.equal(student?.slots.length, 0);
        const horizon = now.getTime() + STUDENT_HORIZON_MS;
        assert.equal(student?.slots.every((slot) => new Date(slot.iso).getTime() <= horizon), true);
        const fall = monday({ startsOn: "2026-08-19", endsOn: "2026-12-11" });
        const fallReview = await reviewTerm(client(), people.advisor.id, people.fall.id, fall, now);
        if (fallReview.ok || !fallReview.review) assert.fail(JSON.stringify(fallReview));
        const fallPublish = await publishTerm(client(), people.advisor.id, people.fall.id, fallReview.review.token, now);
        assert.equal(fallPublish.ok, true, JSON.stringify(fallPublish));
        const springLeft = await client().meetingAvailability.count({ where: { termId: people.spring.id } });
        assert.equal(springLeft, stored);
    } finally {
        await cleanup(people);
    }
});

test("unpublished edits leave the published hours bookable until publish", async (t) => {
    if (skip(t)) return;
    const people = await fixture();
    try {
        const original = monday({ startsOn: "2026-08-19", endsOn: "2026-12-11" });
        original.firstDay = "2026-11-09";
        original.lastDay = "2026-11-16";
        const review = await reviewTerm(client(), people.advisor.id, people.fall.id, original, now);
        if (review.ok || !review.review) assert.fail(JSON.stringify(review));
        assert.equal((await publishTerm(client(), people.advisor.id, people.fall.id, review.review.token, now)).ok, true);
        const before = await loadStudentAdvising(client(), people.studentUser.id, now);
        assert.ok((before?.slots.length ?? 0) > 0);
        const edited = monday({ startsOn: "2026-08-19", endsOn: "2026-12-11" }, "15:00", "16:00");
        edited.firstDay = "2026-11-09";
        edited.lastDay = "2026-11-16";
        assert.equal((await saveTermDraft(client(), people.advisor.id, people.fall.id, edited)).ok, true);
        const during = await loadStudentAdvising(client(), people.studentUser.id, now);
        assert.deepEqual(during?.slots.map((slot) => slot.iso), before?.slots.map((slot) => slot.iso));
    } finally {
        await cleanup(people);
    }
});

test("a booking during review blocks publish and keeps the session", async (t) => {
    if (skip(t)) return;
    const people = await fixture();
    try {
        const config = monday({ startsOn: "2026-08-19", endsOn: "2026-12-11" });
        config.firstDay = "2026-11-09";
        config.lastDay = "2026-11-16";
        const first = await reviewTerm(client(), people.advisor.id, people.fall.id, config, now);
        if (first.ok || !first.review) assert.fail(JSON.stringify(first));
        assert.equal((await publishTerm(client(), people.advisor.id, people.fall.id, first.review.token, now)).ok, true);
        const narrowed = { ...config, lastDay: "2026-11-09" };
        const second = await reviewTerm(client(), people.advisor.id, people.fall.id, narrowed, now);
        if (second.ok || !second.review) assert.fail(JSON.stringify(second));
        const removing = await client().meetingAvailability.findFirst({ where: { advisorId: people.advisor.id, termId: people.fall.id, status: "OPEN" }, orderBy: { startsAt: "desc" } });
        assert.ok(removing);
        const booked = await bookSlot(client(), people.studentUser.id, removing.id, "Need to talk", now);
        assert.equal(booked.ok, true, JSON.stringify(booked));
        const stale = await publishTerm(client(), people.advisor.id, people.fall.id, second.review.token, now);
        assert.equal(stale.ok, false);
        if (stale.ok) return;
        assert.equal(stale.code, "stale");
        assert.equal(stale.title, "Review these changes again");
        const session = await client().meetingSession.findFirst({ where: { advisorId: people.advisor.id, status: "CONFIRMED" } });
        assert.ok(session);
        assert.equal((await client().meetingAvailability.findUnique({ where: { id: removing.id } }))?.status, "BOOKED");
        const draft = await client().advisorTermDraft.findUnique({ where: { advisorId_termId: { advisorId: people.advisor.id, termId: people.fall.id } } });
        assert.ok(draft);
    } finally {
        await cleanup(people);
    }
});

test("manual and other-term times block an unavailable date, and a booking is kept", async (t) => {
    if (skip(t)) return;
    const people = await fixture();
    try {
        const added = await addAvailability(client(), people.advisor.id, { date: "2026-11-20", start: "10:00", durationMinutes: 30, termId: people.fall.id }, now);
        assert.equal(added.ok, true, JSON.stringify(added));
        const config = monday({ startsOn: "2026-08-19", endsOn: "2026-12-11" });
        config.unavailableDates = ["2026-11-20"];
        const blocked = await reviewTerm(client(), people.advisor.id, people.fall.id, config, now);
        if (blocked.ok || !blocked.review) assert.fail(JSON.stringify(blocked));
        assert.equal(blocked.review.blocking[0]?.title, "This date still has times outside this semester schedule.");
        assert.equal((await publishTerm(client(), people.advisor.id, people.fall.id, blocked.review.token, now)).ok, false);
        const oneOff = await client().meetingAvailability.findFirst({ where: { advisorId: people.advisor.id, source: "MANUAL" } });
        assert.equal(oneOff?.status, "OPEN");
        await client().academicTerm.update({ where: { id: people.spring.id }, data: { startsOn: new Date("2026-11-16T12:00:00.000Z") } });
        const springConfig = monday({ startsOn: "2026-11-16", endsOn: "2027-05-07" });
        springConfig.firstDay = "2026-11-16";
        springConfig.lastDay = "2026-11-16";
        const springReview = await reviewTerm(client(), people.advisor.id, people.spring.id, springConfig, now);
        if (springReview.ok || !springReview.review) assert.fail(JSON.stringify(springReview));
        assert.equal((await publishTerm(client(), people.advisor.id, people.spring.id, springReview.review.token, now)).ok, true);
        const fallBlocked = monday({ startsOn: "2026-08-19", endsOn: "2026-12-11" });
        fallBlocked.unavailableDates = ["2026-11-16"];
        fallBlocked.firstDay = "2026-11-09";
        fallBlocked.lastDay = "2026-12-11";
        const overlap = await reviewTerm(client(), people.advisor.id, people.fall.id, fallBlocked, now);
        if (overlap.ok || !overlap.review) assert.fail(JSON.stringify(overlap));
        assert.equal(overlap.review.blocking[0]?.title, "This date still has times outside this semester schedule.");
        assert.match(overlap.review.blocking.flatMap((block) => block.times).map((item) => item.sourceLabel).join("\n"), /Published in Spring/);
        const springCount = await client().meetingAvailability.count({ where: { termId: people.spring.id } });
        assert.ok(springCount > 0);
    } finally {
        await cleanup(people);
    }
});

test("a generated removal stays bookable until publish and does not return after a longer length", async (t) => {
    if (skip(t)) return;
    const people = await fixture();
    try {
        const config = monday({ startsOn: "2026-08-19", endsOn: "2026-12-11" });
        config.firstDay = "2026-11-09";
        config.lastDay = "2026-11-09";
        const review = await reviewTerm(client(), people.advisor.id, people.fall.id, config, now);
        if (review.ok || !review.review) assert.fail(JSON.stringify(review));
        assert.equal((await publishTerm(client(), people.advisor.id, people.fall.id, review.review.token, now)).ok, true);
        const slot = await client().meetingAvailability.findFirst({ where: { advisorId: people.advisor.id, status: "OPEN" }, orderBy: { startsAt: "asc" } });
        assert.ok(slot);
        const suppressed = {
            ...config,
            suppressions: [{ startsAt: slot.startsAt.toISOString(), endsAt: slot.endsAt.toISOString() }],
        };
        assert.equal((await saveTermDraft(client(), people.advisor.id, people.fall.id, suppressed)).ok, true);
        assert.equal((await loadStudentAdvising(client(), people.studentUser.id, now))?.slots.some((item) => item.id === slot.id), true);
        const removal = await reviewTerm(client(), people.advisor.id, people.fall.id, suppressed, now);
        if (removal.ok || !removal.review) assert.fail(JSON.stringify(removal));
        assert.equal((await publishTerm(client(), people.advisor.id, people.fall.id, removal.review.token, now)).ok, true);
        assert.equal(await client().meetingAvailability.findUnique({ where: { id: slot.id } }), null);
        const longer = monday({ startsOn: "2026-08-19", endsOn: "2026-12-11" }, "14:00", "16:00", 45);
        longer.firstDay = "2026-11-09";
        longer.lastDay = "2026-11-09";
        longer.suppressions = suppressed.suppressions;
        const again = await reviewTerm(client(), people.advisor.id, people.fall.id, longer, now);
        if (again.ok || !again.review) assert.fail(JSON.stringify(again));
        assert.equal(again.review.plan.adds.some((item) => item.startsAt === slot.startsAt.toISOString()), false);
        assert.equal((await publishTerm(client(), people.advisor.id, people.fall.id, again.review.token, now)).ok, true);
        const returned = await client().meetingAvailability.findFirst({ where: { advisorId: people.advisor.id, startsAt: slot.startsAt } });
        assert.equal(returned, null);
    } finally {
        await cleanup(people);
    }
});

test("a one-off uses the requested length, and cancel reopens only a still-covered interval", async (t) => {
    if (skip(t)) return;
    const people = await fixture();
    try {
        const config = monday({ startsOn: "2026-08-19", endsOn: "2026-12-11" });
        config.firstDay = "2026-11-09";
        config.lastDay = "2026-11-09";
        const review = await reviewTerm(client(), people.advisor.id, people.fall.id, config, now);
        if (review.ok || !review.review) assert.fail(JSON.stringify(review));
        assert.equal((await publishTerm(client(), people.advisor.id, people.fall.id, review.review.token, now)).ok, true);
        const dirty = monday({ startsOn: "2026-08-19", endsOn: "2026-12-11" }, "14:00", "16:00", 45);
        dirty.firstDay = "2026-11-09";
        dirty.lastDay = "2026-11-09";
        assert.equal((await saveTermDraft(client(), people.advisor.id, people.fall.id, dirty)).ok, true);
        const one = await addAvailability(client(), people.advisor.id, { date: "2026-11-09", start: "11:00", durationMinutes: 30, termId: people.fall.id }, now);
        assert.equal(one.ok, true, JSON.stringify(one));
        const manual = await client().meetingAvailability.findFirst({ where: { advisorId: people.advisor.id, source: "MANUAL" } });
        assert.equal(manual?.durationMinutes, 30);
        const far = await addAvailability(client(), people.advisor.id, { date: "2027-05-03", start: "14:00", durationMinutes: 30, termId: people.spring.id }, now);
        assert.equal(far.ok, false);
        if (!far.ok) assert.equal(far.title, "That date is too far ahead");
        const slot = await client().meetingAvailability.findFirst({ where: { advisorId: people.advisor.id, source: "TERM_PATTERN", status: "OPEN" }, orderBy: { startsAt: "asc" } });
        assert.ok(slot);
        const booked = await bookSlot(client(), people.studentUser.id, slot.id, null, now);
        assert.equal(booked.ok, true, JSON.stringify(booked));
        const covered = await cancelSession(client(), people.studentUser.id, booked.ok ? booked.sessionId ?? "" : "", null, now);
        assert.equal(covered.ok, true, JSON.stringify(covered));
        assert.equal((await client().meetingAvailability.findUnique({ where: { id: slot.id } }))?.status, "OPEN");
        const again = await bookSlot(client(), people.studentUser.id, slot.id, null, now);
        assert.equal(again.ok, true, JSON.stringify(again));
        const longer = await reviewTerm(client(), people.advisor.id, people.fall.id, dirty, now);
        if (longer.ok || !longer.review) assert.fail(JSON.stringify(longer));
        assert.equal((await publishTerm(client(), people.advisor.id, people.fall.id, longer.review.token, now)).ok, true);
        assert.equal((await client().meetingSession.findFirst({ where: { id: again.ok ? again.sessionId : "" } }))?.durationMinutes, 30);
        const released = await cancelSession(client(), people.studentUser.id, again.ok ? again.sessionId ?? "" : "", null, now);
        assert.equal(released.ok, true, JSON.stringify(released));
        assert.equal(await client().meetingAvailability.findUnique({ where: { id: slot.id } }), null);
        assert.ok(await client().meetingAvailability.findFirst({ where: { advisorId: people.advisor.id, source: "MANUAL" } }));
    } finally {
        await cleanup(people);
    }
});
