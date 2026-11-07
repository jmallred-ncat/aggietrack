import { UserRole } from "./generated/prisma/client";
import { authorizeTestStudents, testStudents, type TestStudentAccess } from "./test-students";

/** Exact fixture emails. Not an address pattern, and not advisor accounts. */
export function testPlanNoteAccountEmails() {
    return testStudents.map((student) => student.email);
}

/** Notes on plans owned by those students. Advisor-written notes on those plans are included. */
export function testPlanNoteDeleteWhere() {
    return {
        plannedTerm: {
            student: {
                user: {
                    email: { in: testPlanNoteAccountEmails() },
                    role: UserRole.STUDENT,
                },
            },
        },
    };
}

export type PlanNoteResetRow = {
    studentEmail: string;
    studentRole: "STUDENT" | "ADVISOR" | "ADMIN";
    planId: string;
    status: string;
    courseIds: readonly string[];
    transcript: readonly string[];
    notes: readonly { id: string; authorEmail: string; body: string }[];
};

export function planNotesMatchingReset(rows: readonly PlanNoteResetRow[]) {
    const where = testPlanNoteDeleteWhere();
    const emails = new Set(where.plannedTerm.student.user.email.in);
    const role = where.plannedTerm.student.user.role;
    return rows
        .filter((row) => emails.has(row.studentEmail) && row.studentRole === role)
        .flatMap((row) => row.notes.map((note) => ({ ...note, planId: row.planId })));
}

/** Removes matching notes and leaves plans, courses, statuses, and transcripts in place. */
export function afterPlanNoteReset(rows: readonly PlanNoteResetRow[]) {
    const removing = new Set(planNotesMatchingReset(rows).map((note) => note.id));
    const next = rows.map((row) => ({
        ...row,
        courseIds: [...row.courseIds],
        transcript: [...row.transcript],
        notes: row.notes.filter((note) => !removing.has(note.id)),
    }));
    return { deleted: removing.size, rows: next };
}

export async function runPlanNoteReset(
    access: TestStudentAccess,
    clear: () => Promise<{ deleted: number }>,
) {
    if (!access.ok) return { status: access.status, deleted: null, error: access.error };
    const { deleted } = await clear();
    return { status: 200, deleted, error: null };
}

export function planNoteResetAccess(input: {
    vercelEnv?: string;
    password?: string;
    expectedSecret?: string;
    providedSecret?: string;
}) {
    return authorizeTestStudents(input);
}
