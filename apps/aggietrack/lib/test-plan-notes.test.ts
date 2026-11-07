import assert from "node:assert/strict";
import { test } from "node:test";
import {
    afterPlanNoteReset,
    planNoteResetAccess,
    planNotesMatchingReset,
    runPlanNoteReset,
    testPlanNoteAccountEmails,
    testPlanNoteDeleteWhere,
    type PlanNoteResetRow,
} from "./test-plan-notes";

const fixtureEmails = [
    "it.start@example.test",
    "it.mid@example.test",
    "it.late@example.test",
    "it.retake-f-to-pass@example.test",
    "it.retake-c-to-a@example.test",
    "it.diverse-grades@example.test",
    "it.over-credits@example.test",
];

function world(): PlanNoteResetRow[] {
    return [
        {
            studentEmail: "it.start@example.test",
            studentRole: "STUDENT",
            planId: "avery-plan",
            status: "SUBMITTED",
            courseIds: ["math-110"],
            transcript: [],
            notes: [
                { id: "avery-note", authorEmail: "it.start@example.test", body: "Can I add MATH 110?" },
                { id: "sarah-on-avery", authorEmail: "advisor.1@example.test", body: "Yes. Add it and send the plan again." },
            ],
        },
        {
            studentEmail: "it.mid@example.test",
            studentRole: "STUDENT",
            planId: "jordan-plan",
            status: "SUBMITTED",
            courseIds: ["math-224", "cst-250"],
            transcript: ["engl-100", "math-110"],
            notes: [
                { id: "jordan-note", authorEmail: "it.mid@example.test", body: "Submitted for review." },
            ],
        },
        {
            studentEmail: "it.late@example.test",
            studentRole: "STUDENT",
            planId: "riley-plan",
            status: "DRAFT",
            courseIds: ["cst-325"],
            transcript: ["engl-101"],
            notes: [],
        },
        {
            studentEmail: "real.student@university.edu",
            studentRole: "STUDENT",
            planId: "real-plan",
            status: "APPROVED",
            courseIds: ["cst-300"],
            transcript: ["engl-101"],
            notes: [
                { id: "real-note", authorEmail: "real.student@university.edu", body: "Please review this." },
                { id: "sarah-on-real", authorEmail: "advisor.1@example.test", body: "This real plan stays." },
            ],
        },
        {
            studentEmail: "it.extra@example.test",
            studentRole: "STUDENT",
            planId: "lookalike-plan",
            status: "DRAFT",
            courseIds: ["hist-207"],
            transcript: ["psyc-101"],
            notes: [
                { id: "lookalike-note", authorEmail: "it.extra@example.test", body: "This address only looks like a fixture." },
            ],
        },
    ];
}

test("plan note reset is limited to the fixture student emails", () => {
    const where = testPlanNoteDeleteWhere();
    assert.deepEqual(testPlanNoteAccountEmails(), fixtureEmails);
    assert.deepEqual(where.plannedTerm.student.user.email.in, fixtureEmails);
    assert.equal(where.plannedTerm.student.user.role, "STUDENT");
    assert.equal(testPlanNoteDeleteWhere.length, 0);
    const serialized = JSON.stringify(where);
    assert.doesNotMatch(serialized, /contains|startsWith|endsWith|mode/);
    assert.equal(planNotesMatchingReset(world()).map((note) => note.id).join(), "avery-note,sarah-on-avery,jordan-note");
});

test("reset clears advisor and student notes on test plans and leaves everything else", () => {
    const before = world();
    const executions = [{ id: "T-14", status: "Pass", evidence: "run-14" }];
    const first = afterPlanNoteReset(before);
    assert.equal(first.deleted, 3);
    const avery = first.rows.find((row) => row.planId === "avery-plan");
    const jordan = first.rows.find((row) => row.planId === "jordan-plan");
    const riley = first.rows.find((row) => row.planId === "riley-plan");
    const real = first.rows.find((row) => row.planId === "real-plan");
    const lookalike = first.rows.find((row) => row.planId === "lookalike-plan");
    assert.deepEqual(avery?.notes, []);
    assert.equal(avery?.status, "SUBMITTED");
    assert.deepEqual(avery?.courseIds, ["math-110"]);
    assert.deepEqual(jordan?.notes, []);
    assert.equal(jordan?.status, "SUBMITTED");
    assert.deepEqual(jordan?.courseIds, ["math-224", "cst-250"]);
    assert.deepEqual(jordan?.transcript, ["engl-100", "math-110"]);
    assert.equal(riley?.status, "DRAFT");
    assert.deepEqual(riley?.courseIds, ["cst-325"]);
    assert.deepEqual(real?.notes.map((note) => note.id), ["real-note", "sarah-on-real"]);
    assert.equal(real?.status, "APPROVED");
    assert.deepEqual(real?.courseIds, ["cst-300"]);
    assert.deepEqual(lookalike?.notes.map((note) => note.id), ["lookalike-note"]);
    assert.deepEqual(before[0]?.notes.map((note) => note.id), ["avery-note", "sarah-on-avery"]);
    assert.deepEqual(executions, [{ id: "T-14", status: "Pass", evidence: "run-14" }]);

    const second = afterPlanNoteReset(first.rows);
    assert.equal(second.deleted, 0);
    assert.deepEqual(second.rows.find((row) => row.planId === "jordan-plan")?.courseIds, ["math-224", "cst-250"]);
});

test("an empty test thread resets without deleting other notes", () => {
    const onlyEmpty = world().map((row) => row.studentEmail.startsWith("it.") && row.studentEmail.endsWith("@example.test") && fixtureEmails.includes(row.studentEmail)
        ? { ...row, notes: [] }
        : row);
    const result = afterPlanNoteReset(onlyEmpty);
    assert.equal(result.deleted, 0);
    assert.deepEqual(result.rows.find((row) => row.planId === "real-plan")?.notes.map((note) => note.id), ["real-note", "sarah-on-real"]);
    assert.equal(result.rows.find((row) => row.planId === "avery-plan")?.status, "SUBMITTED");
});

test("unauthorized plan note reset does not delete", async () => {
    const password = "test-student-password";
    const expectedSecret = "test-student-secret";
    let calls = 0;
    const clear = async () => {
        calls += 1;
        return { deleted: 4 };
    };
    const denied = await runPlanNoteReset(planNoteResetAccess({
        vercelEnv: "preview",
        password,
        expectedSecret,
        providedSecret: "other-secret",
    }), clear);
    assert.equal(denied.status, 401);
    assert.equal(denied.deleted, null);
    assert.equal(calls, 0);

    const live = await runPlanNoteReset(planNoteResetAccess({
        vercelEnv: "production",
        password,
        expectedSecret,
        providedSecret: expectedSecret,
    }), clear);
    assert.equal(live.status, 403);
    assert.equal(calls, 0);

    const allowed = await runPlanNoteReset(planNoteResetAccess({
        vercelEnv: "preview",
        password,
        expectedSecret,
        providedSecret: expectedSecret,
    }), clear);
    assert.equal(allowed.status, 200);
    assert.equal(allowed.deleted, 4);
    assert.equal(calls, 1);
});
