import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { applyAdvisorDecision, type ReviewPlan } from "./plan-review";

function plan(partial: Partial<ReviewPlan> = {}): ReviewPlan {
    return {
        id: "plan-1",
        status: "SUBMITTED",
        revision: 3,
        studentId: "student-1",
        termId: "term-1",
        student: { advisorId: "advisor-1" },
        courses: [{ courseId: "course-1", credits: 3 }],
        ...partial,
    };
}

function memory() {
    let current = plan();
    const notes: Array<Record<string, unknown> & { id: string; plannedTermId: string; requestId: string; authorId: string }> = [];
    const transcripts: Array<Record<string, unknown>> = [];
    const tx = {
        plannedTerm: {
            updateMany: async (args: { where: { revision?: number; status?: string; student?: { advisorId: string } }; data: Record<string, unknown> }) => {
                if (current.revision !== args.where.revision) return { count: 0 };
                if (current.status !== args.where.status) return { count: 0 };
                if (current.student.advisorId !== args.where.student?.advisorId) return { count: 0 };
                const increment = (args.data.revision as { increment?: number } | undefined)?.increment ?? 0;
                current = {
                    ...current,
                    status: String(args.data.status),
                    revision: current.revision + increment,
                    student: current.student,
                    courses: current.courses,
                };
                return { count: 1 };
            },
            findUnique: async () => current,
        },
        planNote: {
            findUnique: async (args: { where: { authorId_requestId: { authorId: string; requestId: string } } }) =>
                notes.find((note) => note.authorId === args.where.authorId_requestId.authorId && note.requestId === args.where.authorId_requestId.requestId) ?? null,
            create: async (args: { data: Record<string, unknown> }) => {
                const note = { id: `note-${notes.length + 1}`, ...args.data } as typeof notes[number];
                notes.push(note);
                return note;
            },
        },
        transcriptEntry: {
            findMany: async () => transcripts.map((row) => ({ courseId: row.courseId as string })),
            createMany: async (args: { data: Array<Record<string, unknown>> }) => {
                transcripts.push(...args.data);
                return { count: args.data.length };
            },
        },
    };
    return {
        tx,
        notes: () => notes,
        transcripts: () => transcripts,
        current: () => current,
        set: (next: ReviewPlan) => {
            current = next;
        },
    };
}

test("approval marks courses in progress and records one approval event", async () => {
    const db = memory();
    const result = await applyAdvisorDecision(db.tx as never, {
        advisorId: "advisor-1",
        advisorName: "Sarah Martinez",
        requestId: "req-approve",
        expectedRevision: 3,
        plan: db.current(),
        decision: "approve",
        registrationPin: "pin12",
    });
    assert.equal(result.success, true);
    assert.equal(db.current().status, "APPROVED");
    assert.equal(db.current().revision, 4);
    assert.equal(db.transcripts().length, 1);
    assert.equal(db.transcripts()[0]?.status, "IN_PROGRESS");
    assert.equal(db.notes()[0]?.kind, "APPROVAL");
    assert.equal(db.notes()[0]?.body, "");
    const again = await applyAdvisorDecision(db.tx as never, {
        advisorId: "advisor-1",
        advisorName: "Sarah Martinez",
        requestId: "req-approve",
        expectedRevision: 4,
        plan: db.current(),
        decision: "approve",
        registrationPin: "pin12",
    });
    assert.equal(again.success && again.idempotent, true);
    assert.equal(db.transcripts().length, 1);
    assert.equal(db.notes().length, 1);
});

test("return requests changes without touching the transcript", async () => {
    const db = memory();
    const result = await applyAdvisorDecision(db.tx as never, {
        advisorId: "advisor-1",
        advisorName: "Sarah Martinez",
        requestId: "req-return",
        expectedRevision: 3,
        plan: db.current(),
        decision: "return",
        comment: "  Add the lab section.  ",
    });
    assert.equal(result.success, true);
    assert.equal(db.current().status, "RETURNED");
    assert.equal(db.transcripts().length, 0);
    assert.equal(db.notes().length, 1);
    assert.equal(db.notes()[0]?.kind, "RETURN");
    assert.equal(db.notes()[0]?.body, "Add the lab section.");
});

test("an unassigned advisor, a stale revision, and a rule violation write nothing", async () => {
    const db = memory();
    const unassigned = await applyAdvisorDecision(db.tx as never, {
        advisorId: "other",
        advisorName: "Michael Chen",
        requestId: "req-1",
        expectedRevision: 3,
        plan: db.current(),
        decision: "approve",
        registrationPin: "pin12",
    });
    assert.equal(unassigned.success, false);
    const stale = await applyAdvisorDecision(db.tx as never, {
        advisorId: "advisor-1",
        advisorName: "Sarah Martinez",
        requestId: "req-2",
        expectedRevision: 2,
        plan: db.current(),
        decision: "return",
        comment: "Please update the plan.",
    });
    assert.equal(stale.success, false);
    assert.equal(stale.success === false && stale.code, "stale");
    const blocked = await applyAdvisorDecision(db.tx as never, {
        advisorId: "advisor-1",
        advisorName: "Sarah Martinez",
        requestId: "req-3",
        expectedRevision: 3,
        plan: db.current(),
        decision: "approve",
        registrationPin: "pin12",
        violations: ["MATH 224 must be taken with CST 250 in Spring 2027."],
    });
    assert.equal(blocked.success, false);
    assert.equal(db.current().status, "SUBMITTED");
    assert.equal(db.notes().length, 0);
    assert.equal(db.transcripts().length, 0);
    const empty = await applyAdvisorDecision(db.tx as never, {
        advisorId: "advisor-1",
        advisorName: "Sarah Martinez",
        requestId: "req-4",
        expectedRevision: 3,
        plan: plan({ courses: [] }),
        decision: "approve",
        registrationPin: "pin12",
    });
    assert.equal(empty.success === false && empty.code, "empty");
});

test("only approval records courses in progress", () => {
    const planner = readFileSync(new URL("../app/(app)/student/(started)/planner/actions.ts", import.meta.url), "utf8");
    const register = planner.slice(planner.indexOf("export async function markPlannedTermRegistered"));
    assert.equal(register.includes("recordCoursesInProgress"), false);
    const review = readFileSync(new URL("./plan-review.ts", import.meta.url), "utf8");
    const approve = review.slice(review.indexOf('input.decision === "approve"'));
    const returned = review.slice(review.indexOf('input.decision === "return"'));
    assert.match(approve, /recordCoursesInProgress/);
    assert.equal(returned.includes("recordCoursesInProgress"), false);
    const grades = readFileSync(new URL("../app/(app)/student/progress/grade-actions.ts", import.meta.url), "utf8");
    const add = grades.slice(grades.indexOf("export async function addTranscriptAttempt"));
    assert.ok(add.indexOf("progressInProgressRejection") < add.indexOf("requireStudentProfile"));
});
