import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Grade } from "./generated/prisma/client";
import { authorizeTestStudents, stateAfterReset, testStudentByEmail } from "./test-students";
import { runPlanNoteReset } from "./test-plan-notes";
import {
    afterFixtureLoad,
    describeFixtureLoad,
    fixtureAttempts,
    fixtureSummary,
    runFixtureLoad,
    transcriptFixtureById,
    transcriptFixtures,
    type FixtureLedger,
} from "./transcript-fixtures";

const password = "test-student-password";
const secret = "test-student-secret";

test("fixtures use required catalog courses and do not invent credit counts", () => {
    assert.deepEqual(transcriptFixtures.map((fixture) => fixture.label), [
        "No credits yet",
        "3 credits",
        "6 credits",
        "120 credits",
        "Failed grade",
        "Repeat",
    ]);
    assert.equal(transcriptFixtureById("3 credits"), null);

    const three = fixtureSummary("credits-3");
    assert.deepEqual(fixtureAttempts("credits-3").map((attempt) => [attempt.subject, attempt.number, attempt.credits, attempt.grade]), [
        ["CST", "120", 3, Grade.B],
    ]);
    assert.equal(three.completedCourses, 1);
    assert.equal(three.attempts, 1);
    assert.equal(three.earnedCredits, 3);
    assert.equal(three.gpa, 3);

    const six = fixtureSummary("credits-6");
    assert.equal(six.completedCourses, 2);
    assert.equal(six.earnedCredits, 6);
    assert.equal(six.gpa, 3.5);

    const failed = describeFixtureLoad("it.start@example.test", "failed");
    assert.equal(failed.ok, true);
    if (!failed.ok) return;
    assert.deepEqual(failed.attempts.map((attempt) => [attempt.subject, attempt.number, attempt.grade]), [
        ["CST", "130", Grade.A],
        ["CST", "120", Grade.F],
    ]);
    assert.equal(failed.summary.courses, 2);
    assert.equal(failed.summary.completedCourses, 1);
    assert.equal(failed.summary.attempts, 2);
    assert.equal(failed.summary.earnedCredits, 3);
    assert.equal(failed.summary.gpa, 2);

    const repeat = fixtureSummary("repeat");
    assert.deepEqual(fixtureAttempts("repeat").map((attempt) => attempt.grade), [Grade.F, Grade.B]);
    assert.equal(fixtureAttempts("repeat").every((attempt) => attempt.subject === "CST" && attempt.number === "112"), true);
    assert.equal(repeat.attempts, 2);
    assert.equal(repeat.courses, 1);
    assert.equal(repeat.completedCourses, 1);
    assert.equal(repeat.earnedCredits, 3);
    assert.equal(repeat.gpa, 3);

    const full = fixtureSummary("credits-120");
    assert.equal(full.earnedCredits, 120);
    assert.equal(full.completedCourses, full.attempts);
    assert.equal(full.gpa, 3.98);
    assert.deepEqual(fixtureAttempts("credits-120"), fixtureAttempts("credits-120"));

    const empty = fixtureSummary("none");
    assert.equal(empty.attempts, 0);
    assert.equal(empty.completedCourses, 0);
    assert.equal(empty.earnedCredits, 0);
    assert.equal(empty.gpa, null);
});

test("fixture load stays on the seven students and a named fixture", () => {
    const avery = describeFixtureLoad(" IT.Start@example.test ", "none");
    assert.equal(avery.ok && avery.email, "it.start@example.test");
    assert.equal(describeFixtureLoad("advisor.1@example.test", "credits-3").ok, false);
    assert.equal(describeFixtureLoad("it.extra@example.test", "credits-3").ok, false);
    assert.equal(describeFixtureLoad("real.student@university.edu", "repeat").ok, false);
    assert.equal(describeFixtureLoad("it.mid@example.test", "credits-3").ok, true);
    assert.equal(describeFixtureLoad("it.mid@example.test", "not-a-fixture").ok, false);
    assert.equal(describeFixtureLoad.length, 2);
});

test("an unauthorized fixture load does not write", async () => {
    let calls = 0;
    const clear = async () => {
        calls += 1;
        return { deleted: 1 };
    };
    const denied = await runPlanNoteReset(authorizeTestStudents({
        vercelEnv: "production",
        password,
        expectedSecret: secret,
        providedSecret: secret,
    }), clear);
    assert.equal(denied.status, 403);
    assert.equal(calls, 0);

    const mismatch = await runPlanNoteReset(authorizeTestStudents({
        vercelEnv: "preview",
        password,
        expectedSecret: secret,
        providedSecret: "other",
    }), clear);
    assert.equal(mismatch.status, 401);
    assert.equal(calls, 0);

    const missing = await runPlanNoteReset(authorizeTestStudents({
        vercelEnv: "preview",
        password: "",
        expectedSecret: secret,
        providedSecret: secret,
    }), clear);
    assert.equal(missing.status, 403);
    assert.equal(calls, 0);
});

test("applying a fixture twice replaces only that student's transcript", () => {
    const first = describeFixtureLoad("it.late@example.test", "repeat");
    const second = describeFixtureLoad("it.late@example.test", "repeat");
    assert.equal(first.ok && second.ok, true);
    if (!first.ok || !second.ok) return;
    assert.deepEqual(second.attempts, first.attempts);
    assert.deepEqual(second.summary, first.summary);

    const other = describeFixtureLoad("it.over-credits@example.test", "credits-120");
    assert.equal(other.ok, true);
    if (!other.ok) return;
    assert.notEqual(other.email, first.email);
    assert.equal(other.summary.earnedCredits, 120);
    assert.equal(first.summary.earnedCredits, 3);
});

test("loading a fixture clears that student's plans and leaves everyone else", () => {
    const rows: FixtureLedger[] = [
        { email: "it.start@example.test", role: "STUDENT", transcript: ["old"], plans: ["plan-a"], notes: ["note-a"], sessions: 2, executions: ["run-1"] },
        { email: "it.mid@example.test", role: "STUDENT", transcript: ["jordan"], plans: ["plan-j"], notes: ["note-j"], sessions: 1, executions: ["run-2"] },
        { email: "advisor.1@example.test", role: "ADVISOR", transcript: [], plans: [], notes: ["advisor-note"], sessions: 1, executions: ["run-3"] },
        { email: "real.student@university.edu", role: "STUDENT", transcript: ["kept"], plans: ["real-plan"], notes: ["real-note"], sessions: 4, executions: ["run-4"] },
    ];
    const once = afterFixtureLoad(rows, "it.start@example.test", "credits-3");
    assert.equal(once.ok, true);
    if (!once.ok) return;
    const avery = once.rows[0]!;
    assert.deepEqual(avery.transcript, ["CST 120 B"]);
    assert.deepEqual(avery.plans, []);
    assert.deepEqual(avery.notes, []);
    assert.equal(avery.sessions, 0);
    assert.deepEqual(avery.executions, ["run-1"]);
    assert.deepEqual(once.rows[1], rows[1]);
    assert.deepEqual(once.rows[2], rows[2]);
    assert.deepEqual(once.rows[3], rows[3]);

    const twice = afterFixtureLoad(once.rows, "it.start@example.test", "credits-3");
    assert.equal(twice.ok, true);
    if (!twice.ok) return;
    assert.deepEqual(twice.rows, once.rows);

    const refused = afterFixtureLoad(rows, "it.extra@example.test", "failed");
    assert.equal(refused.ok, false);
    if (refused.ok) return;
    assert.deepEqual(refused.rows, rows);
});

test("reset still restores the frozen story", () => {
    const avery = testStudentByEmail("it.start@example.test");
    const taylor = testStudentByEmail("it.retake-f-to-pass@example.test");
    assert.ok(avery);
    assert.ok(taylor);
    if (!avery || !taylor) return;
    assert.deepEqual(stateAfterReset(avery).transcript, []);
    assert.ok(stateAfterReset(taylor).transcript.length > fixtureAttempts("repeat").length);
    assert.equal(fixtureAttempts("none").length, 0);
});

test("the load route rejects a wrong role and a catalog mismatch before replacement", async () => {
    let writes = 0;
    const replace = async () => {
        writes += 1;
        return "wrote";
    };
    const advisor = await runFixtureLoad({
        email: "it.start@example.test",
        fixtureId: "failed",
        existingRole: "ADVISOR",
        catalogMismatches: [],
        replace,
    });
    assert.equal(advisor.status, 400);
    assert.equal(advisor.result, null);
    assert.equal(writes, 0);

    const admin = await runFixtureLoad({
        email: "it.mid@example.test",
        fixtureId: "credits-3",
        existingRole: "ADMIN",
        catalogMismatches: [],
        replace,
    });
    assert.equal(admin.result, null);
    assert.equal(writes, 0);

    const mismatch = await runFixtureLoad({
        email: "it.late@example.test",
        fixtureId: "repeat",
        existingRole: "STUDENT",
        catalogMismatches: ["CST 112 is 1 credits in the catalog, and this fixture expects 3. The account was not changed."],
        replace,
    });
    assert.equal(mismatch.result, null);
    assert.match(mismatch.error ?? "", /The account was not changed/);
    assert.equal(writes, 0);

    const created = await runFixtureLoad({
        email: "it.start@example.test",
        fixtureId: "none",
        existingRole: null,
        catalogMismatches: [],
        replace,
    });
    assert.equal(created.result, "wrote");
    assert.equal(writes, 1);

    const route = readFileSync("app/api/test-students/load-fixture/route.ts", "utf8");
    assert.match(route, /loadTestTranscriptFixture/);
    assert.equal(route.includes("resetTestStudent"), false);
    assert.match(route, /accountChanged: false/);
    const accounts = readFileSync("lib/test-student-accounts.ts", "utf8");
    const loader = accounts.slice(
        accounts.indexOf("export async function loadTestTranscriptFixture"),
        accounts.indexOf("export async function resetTestPlanNotes"),
    );
    assert.equal(loader.includes("resetTestStudent"), false);
    assert.match(loader, /runFixtureLoad/);
    assert.match(loader, /\$transaction/);
    const reset = accounts.slice(
        accounts.indexOf("export async function resetTestStudent"),
        accounts.indexOf("async function fixtureCatalogMismatches"),
    );
    assert.match(reset, /ensureUser\(student, password, true\)/);
});
