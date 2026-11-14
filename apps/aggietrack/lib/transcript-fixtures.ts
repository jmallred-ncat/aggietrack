import { Grade, TranscriptSource, TranscriptStatus } from "./generated/prisma/client";
import { earnsDegreeCredit } from "./applicable-credits";
import { computeGpa } from "./gpa";
import { plannedAttempts } from "./frozen-transcript";
import { courseKey, courses } from "../prisma/seed/courses";
import { cstCatalogCourses } from "../prisma/seed/cst-catalog";
import { gecCourses } from "../prisma/seed/gec";
import { info2025 } from "../prisma/seed/info-2025";
import { mgmtCourses } from "../prisma/seed/mgmt";
import { testAdvisorByEmail, testStudentByEmail, testStudents } from "./test-students";

export const transcriptFixtures = [
    { id: "none", label: "No credits yet" },
    { id: "credits-3", label: "3 credits" },
    { id: "credits-6", label: "6 credits" },
    { id: "credits-120", label: "120 credits" },
    { id: "failed", label: "Failed grade" },
    { id: "repeat", label: "Repeat" },
] as const;

export type TranscriptFixtureId = (typeof transcriptFixtures)[number]["id"];

export type FixtureAttempt = {
    subject: string;
    number: string;
    credits: number;
    grade: Grade;
    status: TranscriptStatus;
    source: TranscriptSource;
};

const catalog = [...courses, ...cstCatalogCourses, ...gecCourses, ...mgmtCourses];
const requiredKeys = new Set(
    info2025.groups.flatMap((group) => group.courses ?? []).map((course) => courseKey(course)),
);

export function transcriptFixtureById(id: string) {
    return transcriptFixtures.find((fixture) => fixture.id === id) ?? null;
}

export function transcriptFixtureByLabel(label: string) {
    return transcriptFixtures.find((fixture) => fixture.label === label) ?? null;
}

function catalogCourse(subject: string, number: string) {
    const course = catalog.find((item) => item.subject === subject && item.number === number);
    if (!course) {
        throw new Error(`${subject} ${number} is not in the Information Technology 2025 catalog data.`);
    }
    return course;
}

/** A named required course whose catalog row is exactly 3 credits. */
function requiredThreeCredit(subject: string, number: string, grade: Grade): FixtureAttempt {
    const course = catalogCourse(subject, number);
    const code = `${subject} ${number}`;
    if (!requiredKeys.has(courseKey(course))) {
        throw new Error(`${code} is not a required Information Technology 2025 course.`);
    }
    if (course.credits !== 3) {
        throw new Error(`${code} is ${course.credits} credits in the catalog, and this fixture expects 3.`);
    }
    const status = grade === Grade.F ? TranscriptStatus.FAILED 
        : grade === Grade.W ? TranscriptStatus.WITHDRAWN 
        : TranscriptStatus.COMPLETED;
    return {
        subject,
        number,
        credits: course.credits,
        grade,
        status,
        source: TranscriptSource.NCAT,
    };
}

function morganCompletion(): FixtureAttempt[] {
    const morgan = testStudents.find((student) => student.email === "it.over-credits@example.test");
    if (!morgan) throw new Error("Morgan Lee is not a fixture student.");
    return plannedAttempts(morgan).map((attempt) => {
        const code = `${attempt.subject} ${attempt.number}`;
        if (!attempt.grade) throw new Error(`${code} has no grade in Morgan Lee's completion.`);
        const credits = attempt.entered?.credits ?? catalogCourse(attempt.subject, attempt.number).credits;
        return {
            subject: attempt.subject,
            number: attempt.number,
            credits,
            grade: attempt.grade,
            status: attempt.status,
            source: attempt.source,
        };
    });
}

/**
 * Attempts written after the frozen reset.
 * CST 120, CST 130, and CST 112 are required 3-credit Information Technology 2025 courses.
 * 120 credits reuses Morgan Lee's frozen completion.
 */
export function fixtureAttempts(id: TranscriptFixtureId): FixtureAttempt[] {
    switch (id) {
        case "none":
            return [];
        case "credits-3":
            return [requiredThreeCredit("CST", "120", Grade.B)];
        case "credits-6":
            return [
                requiredThreeCredit("CST", "120", Grade.B),
                requiredThreeCredit("CST", "130", Grade.A),
            ];
        case "credits-120":
            return morganCompletion();
        case "failed":
            return [
                requiredThreeCredit("CST", "130", Grade.A),
                requiredThreeCredit("CST", "120", Grade.F),
            ];
        case "repeat":
            return [
                requiredThreeCredit("CST", "112", Grade.F),
                requiredThreeCredit("CST", "112", Grade.B),
            ];
        default: {
            const unknown: never = id;
            throw new Error(`Unknown transcript fixture ${unknown}.`);
        }
    }
}

/** Resolves a load from the fixture allowlist. Client course lists are not an input. */
export function describeFixtureLoad(email: string, fixtureId: string) {
    const student = testStudentByEmail(email);
    if (!student) return { ok: false as const, error: "That is not a test student." };
    if (testAdvisorByEmail(email)) return { ok: false as const, error: "That is not a test student." };
    const fixture = transcriptFixtureById(fixtureId);
    if (!fixture) return { ok: false as const, error: "That is not a transcript fixture." };
    const attempts = fixtureAttempts(fixture.id);
    return {
        ok: true as const,
        email: student.email,
        name: `${student.firstName} ${student.lastName}`,
        fixture: fixture.label,
        attempts,
        summary: fixtureSummary(fixture.id),
    };
}

export function fixtureSummary(id: TranscriptFixtureId) {
    const attempts = fixtureAttempts(id);
    const byCourse = new Map<string, FixtureAttempt[]>();
    for (const attempt of attempts) {
        const key = `${attempt.subject} ${attempt.number}`;
        const group = byCourse.get(key) ?? [];
        group.push(attempt);
        byCourse.set(key, group);
    }

    let earnedCredits = 0;
    let completedCourses = 0;
    for (const group of byCourse.values()) {
        const earning = group.filter((attempt) => attempt.status === TranscriptStatus.COMPLETED && earnsDegreeCredit(attempt.grade));
        if (earning.length === 0) continue;
        earnedCredits += earning[earning.length - 1]!.credits;
        completedCourses += 1;
    }

    const gpa = computeGpa(attempts.map((attempt, index) => ({
        id: `${attempt.subject}-${attempt.number}-${index}`,
        courseId: `${attempt.subject}-${attempt.number}`,
        subject: attempt.subject,
        number: attempt.number,
        credits: attempt.credits,
        grade: attempt.grade,
        status: attempt.status,
        source: attempt.source,
        createdAt: new Date(Date.UTC(2024, 0, index + 1)),
    })));

    return {
        attempts: attempts.length,
        courses: byCourse.size,
        completedCourses,
        earnedCredits,
        gpa,
    };
}

/**
 * Decides whether a fixture load may write.
 * A stored account at an allowlisted email is rejected when its role is not STUDENT.
 * Catalog mismatches are rejected here too. Neither path calls the replacement.
 */
export function fixtureLoadGate(input: {
    email: string;
    fixtureId: string;
    existingRole: string | null;
    catalogMismatches: readonly string[];
}) {
    const described = describeFixtureLoad(input.email, input.fixtureId);
    if (!described.ok) return { write: false as const, status: 400, error: described.error };
    if (input.existingRole && input.existingRole !== "STUDENT") {
        return { write: false as const, status: 400, error: "That account is not a test student." };
    }
    const mismatch = input.catalogMismatches[0];
    if (mismatch) return { write: false as const, status: 500, error: mismatch };
    return { write: true as const, described };
}

/** The load route uses this so a rejected role or catalog never reaches the replacement. */
export async function runFixtureLoad<T>(input: {
    email: string;
    fixtureId: string;
    existingRole: string | null;
    catalogMismatches: readonly string[];
    replace: () => Promise<T>;
}) {
    const gate = fixtureLoadGate(input);
    if (!gate.write) return { status: gate.status, error: gate.error, result: null };
    return { status: 200 as const, error: null, result: await input.replace() };
}

export type FixtureLedger = {
    email: string;
    role: "STUDENT" | "ADVISOR";
    transcript: readonly string[];
    plans: readonly string[];
    notes: readonly string[];
    sessions: number;
    executions: readonly string[];
};

/** Models the reset-then-write for one allowlisted student. Other rows stay. */
export function afterFixtureLoad(rows: readonly FixtureLedger[], email: string, fixtureId: string) {
    const described = describeFixtureLoad(email, fixtureId);
    if (!described.ok) return { ok: false as const, error: described.error, rows };
    const next = rows.map((row) => {
        if (row.email !== described.email || row.role !== "STUDENT") return row;
        return {
            ...row,
            transcript: described.attempts.map((attempt) => `${attempt.subject} ${attempt.number} ${attempt.grade}`),
            plans: [],
            notes: [],
            sessions: 0,
        };
    });
    return { ok: true as const, rows: next, fixture: described.fixture, summary: described.summary };
}
