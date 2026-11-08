import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";
import {
    addAvailability,
    availabilityFields,
    bookSlot,
    cancelSession,
    loadAdvisorAppointments,
    loadStudentAdvising,
    moveOpenSlot,
    removeOpenSlot,
    rescheduleChoices,
    rescheduleSession,
    saveDuration,
    saveZoom,
    studentUpcoming,
} from "./advising-meetings";
import { meetingStamp } from "./advising-time";

// Require an explicit scratch database. A fallback would let `pnpm test` write the hands-on database.
const databaseUrl = process.env.AGT17_DATABASE_URL ?? "";
const now = new Date("2026-11-08T15:00:00.000Z");
const db = (databaseUrl
    ? new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) })
    : null) as PrismaClient;
let ready = false;

before(async () => {
    if (!databaseUrl) return;
    try {
        await db.$queryRaw`SELECT 1`;
        await db.$queryRaw`SELECT 1 FROM "MeetingSession" LIMIT 1`;
        ready = true;
    } catch {
        ready = false;
    }
});

after(async () => {
    if (databaseUrl) await db.$disconnect();
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
    const result = await addAvailability(db, advisorId, { date, start, end }, now);
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
        const gap = await addAvailability(db, people.advisor.id, { date: "2026-03-08", start: "02:30", end: "03:00" }, new Date("2026-03-01T15:00:00.000Z"));
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

test("canceling releases the time for another booking and for removal", async (t) => {
    skip(t);
    const people = await fixture();
    try {
        const slots = await openWindow(people.advisor.id, "14:00", "15:00");
        const first = await bookSlot(db, people.studentUser.id, slots[0]!.id, "Degree plan", now);
        assert.equal(first.ok, true);
        if (!first.ok || !first.sessionId) return;
        const canceled = await cancelSession(db, people.studentUser.id, first.sessionId, null, now);
        assert.equal(canceled.ok, true);
        const history = await db.meetingSession.findUnique({ where: { id: first.sessionId }, include: { events: true } });
        assert.equal(history?.status, "CANCELED");
        assert.equal(history?.availabilityId, null);
        assert.equal(history?.events.some((event) => event.kind === "CANCELED"), true);
        assert.equal((await db.meetingAvailability.findUnique({ where: { id: slots[0]!.id } }))?.status, "OPEN");
        const sameStudent = await bookSlot(db, people.studentUser.id, slots[0]!.id, null, now);
        assert.equal(sameStudent.ok, true);
        if (!sameStudent.ok || !sameStudent.sessionId) return;
        const advisorCancel = await cancelSession(db, people.advisor.id, sameStudent.sessionId, "I need to close this time.", now);
        assert.equal(advisorCancel.ok, true);
        if (advisorCancel.ok) assert.equal(advisorCancel.studentName, "Avery Student");
        const otherStudent = await bookSlot(db, people.otherStudentUser.id, slots[0]!.id, null, now);
        assert.equal(otherStudent.ok, true);
        if (!otherStudent.ok || !otherStudent.sessionId) return;
        await cancelSession(db, people.otherStudentUser.id, otherStudent.sessionId, null, now);
        const later = await bookSlot(db, people.studentUser.id, slots[1]!.id, null, now);
        assert.equal(later.ok, true);
        if (!later.ok || !later.sessionId) return;
        const ontoCanceled = await rescheduleSession(db, people.studentUser.id, later.sessionId, slots[0]!.id, null, now);
        assert.equal(ontoCanceled.ok, true);
        assert.equal((await db.meetingSession.findUnique({ where: { id: later.sessionId } }))?.availabilityId, slots[0]!.id);
        const removedReleased = await removeOpenSlot(db, people.advisor.id, slots[1]!.id);
        assert.equal(removedReleased.ok, true);
        await cancelSession(db, people.studentUser.id, later.sessionId, null, now);
        const removed = await removeOpenSlot(db, people.advisor.id, slots[0]!.id);
        assert.equal(removed.ok, true);
        assert.equal(await db.meetingAvailability.findUnique({ where: { id: slots[0]!.id } }), null);
        const kept = await db.meetingSession.findUnique({ where: { id: first.sessionId }, include: { events: true } });
        assert.equal(kept?.status, "CANCELED");
        assert.equal(kept?.availabilityId, null);
        assert.equal(kept?.events.some((event) => event.kind === "CANCELED"), true);
    } finally {
        await cleanup(people);
    }
});

test("a claimed slot rolls back when the session row cannot be saved", async (t) => {
    skip(t);
    const people = await fixture();
    try {
        const slots = await openWindow(people.advisor.id, "14:00", "14:30");
        const slot = slots[0]!;
        const elsewhere = new Date("2026-12-01T19:00:00.000Z");
        await db.meetingSession.create({
            data: {
                studentId: people.otherStudent.id,
                advisorId: people.advisor.id,
                availabilityId: slot.id,
                startsAt: elsewhere,
                endsAt: new Date(elsewhere.getTime() + 30 * 60 * 1000),
                durationMinutes: 30,
                status: "CONFIRMED",
            },
        });
        const blocked = await bookSlot(db, people.studentUser.id, slot.id, null, now);
        assert.equal(blocked.ok, false);
        assert.equal((await db.meetingAvailability.findUnique({ where: { id: slot.id } }))?.status, "OPEN");
        const sessions = await db.meetingSession.count({ where: { availabilityId: slot.id } });
        assert.equal(sessions, 1);
    } finally {
        await cleanup(people);
    }
});

test("concurrent bookings of different overlapping times keep one confirmed session", async (t) => {
    skip(t);
    const people = await fixture();
    try {
        const start = new Date("2026-11-20T19:00:00.000Z");
        const middle = new Date("2026-11-20T19:15:00.000Z");
        const end = new Date("2026-11-20T19:30:00.000Z");
        const later = new Date("2026-11-20T19:45:00.000Z");
        const left = await db.meetingAvailability.create({
            data: { advisorId: people.advisor.id, startsAt: start, endsAt: end, durationMinutes: 30, status: "OPEN" },
        });
        const right = await db.meetingAvailability.create({
            data: { advisorId: people.advisor.id, startsAt: middle, endsAt: later, durationMinutes: 30, status: "OPEN" },
        });
        const [studentLeft, studentRight] = await Promise.all([
            bookSlot(db, people.studentUser.id, left.id, null, now),
            bookSlot(db, people.studentUser.id, right.id, null, now),
        ]);
        assert.equal([studentLeft, studentRight].filter((result) => result.ok).length, 1);
        assert.equal(await db.meetingSession.count({ where: { studentId: people.student.id, status: "CONFIRMED" } }), 1);
        await db.meetingSession.deleteMany({ where: { advisorId: people.advisor.id } });
        await db.meetingAvailability.updateMany({ where: { advisorId: people.advisor.id }, data: { status: "OPEN" } });
        const [firstStudent, secondStudent] = await Promise.all([
            bookSlot(db, people.studentUser.id, left.id, null, now),
            bookSlot(db, people.otherStudentUser.id, right.id, null, now),
        ]);
        assert.equal([firstStudent, secondStudent].filter((result) => result.ok).length, 1);
        assert.equal(await db.meetingSession.count({ where: { advisorId: people.advisor.id, status: "CONFIRMED" } }), 1);
        const winner = await db.meetingSession.findFirst({ where: { advisorId: people.advisor.id, status: "CONFIRMED" } });
        const otherSlot = await db.meetingAvailability.create({
            data: { advisorId: people.otherAdvisor.id, startsAt: start, endsAt: end, durationMinutes: 30, status: "OPEN" },
        });
        await assert.rejects(
            () => db.meetingSession.create({
                data: {
                    studentId: winner!.studentId,
                    advisorId: people.otherAdvisor.id,
                    availabilityId: otherSlot.id,
                    startsAt: start,
                    endsAt: end,
                    durationMinutes: 30,
                    status: "CONFIRMED",
                },
            }),
            /MeetingSession_student_no_overlap|exclusion constraint|23P01/,
        );
    } finally {
        await cleanup(people);
    }
});

test("the dashboard names the session advisor after reassignment", async (t) => {
    skip(t);
    const people = await fixture();
    try {
        const slots = await openWindow(people.advisor.id, "14:00", "14:30");
        const booked = await bookSlot(db, people.studentUser.id, slots[0]!.id, null, now);
        assert.equal(booked.ok, true);
        await db.studentProfile.update({ where: { id: people.student.id }, data: { advisorId: people.otherAdvisor.id } });
        const reassigned = await studentUpcoming(db, people.studentUser.id, now);
        assert.equal(reassigned?.personName, "Morgan Advisor");
        await db.studentProfile.update({ where: { id: people.student.id }, data: { advisorId: null } });
        const unassigned = await studentUpcoming(db, people.studentUser.id, now);
        assert.equal(unassigned?.id, reassigned?.id);
        assert.equal(unassigned?.personName, "Morgan Advisor");
        const page = await loadStudentAdvising(db, people.studentUser.id, now);
        assert.equal(page?.advisorName, null);
        assert.equal(page?.slots.length, 0);
        assert.equal(page?.upcoming[0]?.personName, "Morgan Advisor");
    } finally {
        await cleanup(people);
    }
});

test("a role change removes ownership of the original session", async (t) => {
    skip(t);
    const people = await fixture();
    try {
        const slots = await openWindow(people.advisor.id, "14:00", "15:00");
        const booked = await bookSlot(db, people.studentUser.id, slots[0]!.id, null, now);
        assert.equal(booked.ok, true);
        if (!booked.ok || !booked.sessionId) return;
        await db.user.update({ where: { id: people.studentUser.id }, data: { role: "ADVISOR" } });
        const canceled = await cancelSession(db, people.studentUser.id, booked.sessionId, null, now);
        assert.equal(canceled.ok, false);
        assert.deepEqual(await rescheduleChoices(db, people.studentUser.id, booked.sessionId, now), []);
        const moved = await rescheduleSession(db, people.studentUser.id, booked.sessionId, slots[1]!.id, null, now);
        assert.equal(moved.ok, false);
        assert.equal((await db.meetingSession.findUnique({ where: { id: booked.sessionId } }))?.status, "CONFIRMED");
        await db.user.update({ where: { id: people.studentUser.id }, data: { role: "STUDENT" } });
        const restored = await cancelSession(db, people.studentUser.id, booked.sessionId, null, now);
        assert.equal(restored.ok, true);
    } finally {
        await cleanup(people);
    }
});

test("availability writes ignore a clock supplied on the input object", async (t) => {
    skip(t);
    const people = await fixture();
    try {
        const forgedNow = new Date("2099-01-01T15:00:00.000Z");
        const forged = { date: "2026-01-01", start: "14:00", end: "15:00", now: forgedNow };
        const fields = availabilityFields(forged);
        assert.equal(Object.hasOwn(fields, "now"), false);
        assert.deepEqual(fields, { date: "2026-01-01", start: "14:00", end: "15:00" });
        const past = await addAvailability(db, people.advisor.id, forged, now);
        assert.equal(past.ok, false);
        if (!past.ok) assert.equal(past.title, "That time is in the past");
        const distant = await addAvailability(db, people.advisor.id, {
            date: "2027-06-01",
            start: "14:00",
            end: "14:30",
            now: new Date("2027-05-01T15:00:00.000Z"),
        } as { date: string; start: string; end?: string });
        assert.equal(distant.ok, false);
        if (!distant.ok) assert.equal(distant.title, "That date is too far ahead");
        const allowed = await addAvailability(
            db,
            people.advisor.id,
            { date: "2027-06-01", start: "14:00", end: "14:30" },
            new Date("2027-05-01T15:00:00.000Z"),
        );
        assert.equal(allowed.ok, true);
        const slots = await db.meetingAvailability.findMany({ where: { advisorId: people.advisor.id, status: "OPEN" } });
        const moved = await moveOpenSlot(db, people.advisor.id, slots[0]!.id, { date: "2026-01-02", start: "14:00", now: forgedNow } as { date: string; start: string }, now);
        assert.equal(moved.ok, false);
        if (!moved.ok) assert.equal(moved.title, "That time is in the past");
        assert.equal((await db.meetingAvailability.findUnique({ where: { id: slots[0]!.id } }))?.startsAt.toISOString(), slots[0]!.startsAt.toISOString());
    } finally {
        await cleanup(people);
    }
});
