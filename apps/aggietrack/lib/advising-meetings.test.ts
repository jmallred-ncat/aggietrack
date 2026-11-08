import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";
import {
    addAvailability,
    bookSlot,
    cancelSession,
    loadAdvisorAppointments,
    loadStudentAdvising,
    removeOpenSlot,
    rescheduleSession,
    saveDuration,
    saveZoom,
} from "./advising-meetings";
import { meetingStamp } from "./advising-time";

const databaseUrl = process.env.AGT17_DATABASE_URL ?? "postgresql://aggietrack_test:aggietrack_test@127.0.0.1:5432/aggietrack_agt17";
const now = new Date("2026-11-08T15:00:00.000Z");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
let ready = false;

before(async () => {
    try {
        await db.$queryRaw`SELECT 1`;
        await db.$queryRaw`SELECT 1 FROM "MeetingSession" LIMIT 1`;
        ready = true;
    } catch {
        ready = false;
    }
});

after(async () => {
    await db.$disconnect();
});

function skip(t: { skip: (message?: string) => void }) {
    if (!ready) t.skip("isolated advising database is not available");
}

async function fixture() {
    const suffix = randomUUID().slice(0, 8);
    const degree = await db.degree.create({
        data: { name: `Degree ${suffix}`, abbreviation: `D${suffix}`, level: "BACCALAUREATE" },
    });
    const department = await db.department.create({
        data: { name: `Department ${suffix}`, abbreviation: `P${suffix}` },
    });
    const program = await db.program.create({
        data: { code: `C${suffix}`, name: `Program ${suffix}`, degreeId: degree.id, departmentId: department.id },
    });
    const catalog = await db.catalogYear.create({ data: { programId: program.id, year: 2026 } });
    const advisor = await db.user.create({
        data: { id: randomUUID(), name: "Morgan Advisor", email: `advisor-${suffix}@example.test`, firstName: "Morgan", lastName: "Advisor", role: "ADVISOR", emailVerified: true },
    });
    const otherAdvisor = await db.user.create({
        data: { id: randomUUID(), name: "Riley Advisor", email: `other-${suffix}@example.test`, firstName: "Riley", lastName: "Advisor", role: "ADVISOR", emailVerified: true },
    });
    const studentUser = await db.user.create({
        data: { id: randomUUID(), name: "Avery Student", email: `student-${suffix}@example.test`, firstName: "Avery", lastName: "Student", role: "STUDENT", emailVerified: true },
    });
    const otherStudentUser = await db.user.create({
        data: { id: randomUUID(), name: "Jordan Student", email: `other-student-${suffix}@example.test`, firstName: "Jordan", lastName: "Student", role: "STUDENT", emailVerified: true },
    });
    const student = await db.studentProfile.create({ data: { userId: studentUser.id, catalogYearId: catalog.id, advisorId: advisor.id, startConfirmedAt: now } });
    const otherStudent = await db.studentProfile.create({ data: { userId: otherStudentUser.id, catalogYearId: catalog.id, advisorId: advisor.id, startConfirmedAt: now } });
    return { suffix, degree, department, program, catalog, advisor, otherAdvisor, studentUser, otherStudentUser, student, otherStudent };
}

async function cleanup(people: Awaited<ReturnType<typeof fixture>>) {
    const advisorIds = [people.advisor.id, people.otherAdvisor.id];
    await db.meetingSession.deleteMany({ where: { advisorId: { in: advisorIds } } });
    await db.meetingAvailability.deleteMany({ where: { advisorId: { in: advisorIds } } });
    await db.advisorMeetingSettings.deleteMany({ where: { advisorId: { in: advisorIds } } });
    await db.user.deleteMany({ where: { id: { in: [people.studentUser.id, people.otherStudentUser.id, people.advisor.id, people.otherAdvisor.id] } } });
    await db.catalogYear.deleteMany({ where: { programId: people.program.id } });
    await db.program.delete({ where: { id: people.program.id } });
    await db.department.delete({ where: { id: people.department.id } });
    await db.degree.delete({ where: { id: people.degree.id } });
}

async function openWindow(advisorId: string, start: string, end: string, date = "2026-11-20") {
    const result = await addAvailability(db, advisorId, { date, start, end, now });
    assert.equal(result.ok, true, JSON.stringify(result));
    return db.meetingAvailability.findMany({ where: { advisorId, status: "OPEN" }, orderBy: { startsAt: "asc" } });
}

test("booking one slot twice and at the same time leaves a single session", async (t) => {
    skip(t);
    const people = await fixture();
    try {
        const slots = await openWindow(people.advisor.id, "14:00", "14:30");
        const slot = slots[0];
        assert.ok(slot);
        const [first, second] = await Promise.all([
            bookSlot(db, people.studentUser.id, slot.id, "Degree plan", now),
            bookSlot(db, people.otherStudentUser.id, slot.id, null, now),
        ]);
        const wins = [first, second].filter((result) => result.ok);
        assert.equal(wins.length, 1);
        const owner = await db.meetingSession.findFirst({ where: { availabilityId: slot.id }, include: { student: true } });
        assert.ok(owner);
        const again = await bookSlot(db, owner.student.userId, slot.id, null, now);
        assert.equal(again.ok, true);
        const sessions = await db.meetingSession.count({ where: { availabilityId: slot.id, status: "CONFIRMED" } });
        assert.equal(sessions, 1);
        const stored = await db.meetingAvailability.findUnique({ where: { id: slot.id } });
        assert.equal(stored?.status, "BOOKED");
    } finally {
        await cleanup(people);
    }
});

test("a student and an advisor cannot overlap confirmed sessions", async (t) => {
    skip(t);
    const people = await fixture();
    try {
        const start = new Date("2026-11-20T19:00:00.000Z");
        const end = new Date("2026-11-20T19:30:00.000Z");
        const left = await db.meetingAvailability.create({ data: { advisorId: people.advisor.id, startsAt: start, endsAt: end, durationMinutes: 30, status: "OPEN" } });
        const right = await db.meetingAvailability.create({ data: { advisorId: people.advisor.id, startsAt: start, endsAt: end, durationMinutes: 30, status: "OPEN" } });
        const booked = await bookSlot(db, people.studentUser.id, left.id, null, now);
        assert.equal(booked.ok, true);
        const studentOverlap = await bookSlot(db, people.studentUser.id, right.id, null, now);
        assert.equal(studentOverlap.ok, false);
        if (!studentOverlap.ok) assert.equal(studentOverlap.title, "That time overlaps another session");
        const advisorOverlap = await bookSlot(db, people.otherStudentUser.id, right.id, null, now);
        assert.equal(advisorOverlap.ok, false);
        const confirmed = await db.meetingSession.count({ where: { advisorId: people.advisor.id, status: "CONFIRMED" } });
        assert.equal(confirmed, 1);
        const original = await db.meetingSession.findFirst({ where: { availabilityId: left.id } });
        assert.equal(original?.startsAt.toISOString(), start.toISOString());
    } finally {
        await cleanup(people);
    }
});

test("stale assignment, stale slot, and another account cannot write the session", async (t) => {
    skip(t);
    const people = await fixture();
    try {
        const slots = await openWindow(people.advisor.id, "14:00", "15:00");
        const otherSlots = await openWindow(people.otherAdvisor.id, "15:00", "15:30");
        const booked = await bookSlot(db, people.studentUser.id, slots[0]!.id, null, now);
        assert.equal(booked.ok, true);
        if (!booked.ok || !booked.sessionId) return;
        await db.studentProfile.update({ where: { id: people.student.id }, data: { advisorId: people.otherAdvisor.id } });
        const former = await bookSlot(db, people.studentUser.id, slots[1]!.id, null, now);
        assert.equal(former.ok, false);
        const current = await bookSlot(db, people.studentUser.id, otherSlots[0]!.id, null, now);
        assert.equal(current.ok, true);
        const tamper = await cancelSession(db, people.otherStudentUser.id, booked.sessionId, null, now);
        assert.equal(tamper.ok, false);
        const advisorTamper = await cancelSession(db, people.otherAdvisor.id, booked.sessionId, "Not yours", now);
        assert.equal(advisorTamper.ok, false);
        const studentView = await loadStudentAdvising(db, people.studentUser.id, now);
        assert.equal(studentView?.upcoming.some((card) => card.id === booked.sessionId), true);
        const formerAdvisor = await loadAdvisorAppointments(db, people.advisor.id, now);
        assert.equal(formerAdvisor?.upcoming.some((card) => card.id === booked.sessionId), true);
        const newAdvisor = await loadAdvisorAppointments(db, people.otherAdvisor.id, now);
        assert.equal(newAdvisor?.upcoming.some((card) => card.id === booked.sessionId), false);
        const removed = await db.meetingAvailability.delete({ where: { id: slots[1]!.id } }).then(() => true);
        assert.equal(removed, true);
        const missing = await bookSlot(db, people.otherStudentUser.id, slots[1]!.id, null, now);
        assert.equal(missing.ok, false);
        if (!missing.ok) assert.equal(missing.title, "That time is no longer open");
    } finally {
        await cleanup(people);
    }
});

test("reschedule rolls back on conflict and releases the old time on success", async (t) => {
    skip(t);
    const people = await fixture();
    try {
        const slots = await openWindow(people.advisor.id, "14:00", "16:00");
        assert.equal(slots.length, 4);
        const booked = await bookSlot(db, people.studentUser.id, slots[0]!.id, null, now);
        const other = await bookSlot(db, people.studentUser.id, slots[2]!.id, null, now);
        assert.equal(booked.ok && other.ok, true);
        if (!booked.ok || !booked.sessionId) return;
        const overlapping = await db.meetingAvailability.create({
            data: { advisorId: people.advisor.id, startsAt: slots[2]!.startsAt, endsAt: slots[2]!.endsAt, durationMinutes: 30, status: "OPEN" },
        });
        const blocked = await rescheduleSession(db, people.studentUser.id, booked.sessionId, overlapping.id, null, now);
        assert.equal(blocked.ok, false);
        if (!blocked.ok) assert.equal(blocked.title, "Session could not be rescheduled");
        const unchanged = await db.meetingSession.findUnique({ where: { id: booked.sessionId } });
        assert.equal(unchanged?.availabilityId, slots[0]!.id);
        assert.equal((await db.meetingAvailability.findUnique({ where: { id: slots[1]!.id } }))?.status, "OPEN");
        const moved = await rescheduleSession(db, people.advisor.id, booked.sessionId, slots[1]!.id, "A faculty meeting was added.", now);
        assert.equal(moved.ok, true);
        const updated = await db.meetingSession.findUnique({ where: { id: booked.sessionId } });
        assert.equal(updated?.availabilityId, slots[1]!.id);
        assert.equal((await db.meetingAvailability.findUnique({ where: { id: slots[0]!.id } }))?.status, "OPEN");
        const blank = await cancelSession(db, people.advisor.id, booked.sessionId, "   ", now);
        assert.equal(blank.ok, false);
        if (!blank.ok) assert.equal(blank.title, "Add a note");
        assert.equal((await db.meetingSession.findUnique({ where: { id: booked.sessionId } }))?.status, "CONFIRMED");
    } finally {
        await cleanup(people);
    }
});

test("duration and availability edits do not rewrite a booking", async (t) => {
    skip(t);
    const people = await fixture();
    try {
        const slots = await openWindow(people.advisor.id, "14:00", "15:00");
        const booked = await bookSlot(db, people.studentUser.id, slots[0]!.id, null, now);
        assert.equal(booked.ok, true);
        const before = await db.meetingSession.findFirst({ where: { availabilityId: slots[0]!.id } });
        const saved = await saveDuration(db, people.advisor.id, 60);
        assert.equal(saved.ok, true);
        const after = await db.meetingSession.findUnique({ where: { id: before!.id } });
        assert.equal(after?.durationMinutes, 30);
        assert.equal(after?.startsAt.toISOString(), before?.startsAt.toISOString());
        const slot = await db.meetingAvailability.findUnique({ where: { id: slots[0]!.id } });
        assert.equal(slot?.durationMinutes, 30);
        const removed = await removeOpenSlot(db, people.advisor.id, slots[0]!.id);
        assert.equal(removed.ok, false);
        if (!removed.ok) assert.equal(removed.title, "This time has a booked session");
        assert.equal(await db.meetingSession.count({ where: { id: before!.id, status: "CONFIRMED" } }), 1);
        const view = await loadStudentAdvising(db, people.studentUser.id, now);
        assert.equal(view?.upcoming[0]?.durationLabel, "30 minutes");
        assert.match(view?.upcoming[0]?.fullTimestamp ?? "", /2:00–2:30 PM EST/);
    } finally {
        await cleanup(people);
    }
});

test("zoom links are allowlisted and a reload still shows the booking", async (t) => {
    skip(t);
    const people = await fixture();
    try {
        const slots = await openWindow(people.advisor.id, "16:00", "16:30");
        const booked = await bookSlot(db, people.studentUser.id, slots[0]!.id, null, now);
        assert.equal(booked.ok, true);
        if (!booked.ok || !booked.sessionId) return;
        for (const url of ["http://zoom.us/j/1", "javascript:alert(1)", "https://user:pass@ncat.zoom.us/j/1", "https://zoom.us.evil.com/j/1"]) {
            const rejected = await saveZoom(db, people.advisor.id, booked.sessionId, url);
            assert.equal(rejected.ok, false, url);
            assert.equal((await db.meetingSession.findUnique({ where: { id: booked.sessionId } }))?.zoomUrl, null);
        }
        const saved = await saveZoom(db, people.advisor.id, booked.sessionId, "https://ncat.zoom.us/j/123456");
        assert.equal(saved.ok, true);
        const student = await loadStudentAdvising(db, people.studentUser.id, now);
        const advisor = await loadAdvisorAppointments(db, people.advisor.id, now);
        assert.equal(student?.upcoming[0]?.zoomUrl, "https://ncat.zoom.us/j/123456");
        assert.equal(advisor?.upcoming[0]?.zoomUrl, "https://ncat.zoom.us/j/123456");
        const reloaded = await loadStudentAdvising(db, people.studentUser.id, now);
        assert.equal(reloaded?.upcoming[0]?.id, booked.sessionId);
        const studentWrite = await saveZoom(db, people.studentUser.id, booked.sessionId, "https://zoom.us/j/999");
        assert.equal(studentWrite.ok, false);
        assert.equal((await db.meetingSession.findUnique({ where: { id: booked.sessionId } }))?.zoomUrl, "https://ncat.zoom.us/j/123456");
    } finally {
        await cleanup(people);
    }
});

test("daylight-saving labels use the earlier fall-back instant and reject the spring gap", async (t) => {
    skip(t);
    const people = await fixture();
    try {
        const gap = await addAvailability(db, people.advisor.id, { date: "2026-03-08", start: "02:30", end: "03:00", now: new Date("2026-03-01T15:00:00.000Z") });
        assert.equal(gap.ok, false);
        if (!gap.ok) assert.equal(gap.title, "That time does not exist");
        const earlier = new Date("2026-11-01T05:30:00.000Z");
        const ends = new Date(earlier.getTime() + 15 * 60 * 1000);
        const slot = await db.meetingAvailability.create({
            data: { advisorId: people.advisor.id, startsAt: earlier, endsAt: ends, durationMinutes: 15, status: "BOOKED" },
        });
        await db.meetingSession.create({
            data: {
                studentId: people.student.id,
                advisorId: people.advisor.id,
                availabilityId: slot.id,
                startsAt: earlier,
                endsAt: ends,
                durationMinutes: 15,
                status: "CONFIRMED",
            },
        });
        assert.match(meetingStamp(earlier, ends).full, /1:30–1:45 AM EDT/);
        const empty = await loadAdvisorAppointments(db, people.otherAdvisor.id, now);
        assert.equal(empty?.rows.length, 0);
        assert.equal(empty?.upcoming.length, 0);
    } finally {
        await cleanup(people);
    }
});
