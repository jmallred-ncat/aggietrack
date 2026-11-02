import { Grade, TranscriptStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { addTranscriptAttempt, removeTranscriptAttempt, updateTranscriptGrade } from "./grade-actions";

// Mock the student profile requirement
vi.mock("@/lib/student", () => ({
    requireStudentProfile: vi.fn(() => Promise.resolve({ 
        id: "test-student-id",
        catalogYearId: "test-catalog-year-id",
    })),
}));

// Mock next/cache
vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
}));

describe("updateTranscriptGrade", () => {
    let testEntry: any;

    beforeEach(async () => {
        // Create a test transcript entry
        const student = await prisma.studentProfile.findFirst();
        if (!student) {
            throw new Error("No test student found");
        }

        testEntry = await prisma.transcriptEntry.create({
            data: {
                studentId: student.id,
                courseId: "test-course-id",
                credits: 3,
                grade: Grade.C,
                status: TranscriptStatus.COMPLETED,
                source: "NCAT",
            },
        });
    });

    afterEach(async () => {
        if (testEntry) {
            await prisma.transcriptEntry.delete({ where: { id: testEntry.id } }).catch(() => {});
        }
    });

    it("should update the grade successfully", async () => {
        const result = await updateTranscriptGrade({
            entryId: testEntry.id,
            grade: Grade.A,
        });

        expect(result.success).toBe(true);

        const updated = await prisma.transcriptEntry.findUnique({
            where: { id: testEntry.id },
        });

        expect(updated?.grade).toBe(Grade.A);
    });

    it("should reject invalid input", async () => {
        const result = await updateTranscriptGrade({
            entryId: testEntry.id,
            grade: "INVALID",
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain("Invalid grade update request");
    });

    it("should reject non-existent entry", async () => {
        const result = await updateTranscriptGrade({
            entryId: "non-existent-id",
            grade: Grade.A,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain("not found");
    });

    it("should update source to TRANSFER when grade is TR", async () => {
        const result = await updateTranscriptGrade({
            entryId: testEntry.id,
            grade: Grade.TR,
        });

        expect(result.success).toBe(true);

        const updated = await prisma.transcriptEntry.findUnique({
            where: { id: testEntry.id },
        });

        expect(updated?.grade).toBe(Grade.TR);
        expect(updated?.source).toBe("TRANSFER");
    });
});

describe("addTranscriptAttempt", () => {
    it("should reject invalid input", async () => {
        const result = await addTranscriptAttempt({
            courseId: "test-course-id",
            credits: 3,
            grade: "INVALID",
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain("Invalid attempt request");
    });

    it("should reject course not on plan", async () => {
        const result = await addTranscriptAttempt({
            courseId: "non-existent-course",
            subject: null,
            number: null,
            title: null,
            credits: 3,
            grade: Grade.B,
            recommendedTermCourseId: null,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain("not on your plan");
    });
});

describe("removeTranscriptAttempt", () => {
    let testEntry: any;

    beforeEach(async () => {
        const student = await prisma.studentProfile.findFirst();
        if (!student) {
            throw new Error("No test student found");
        }

        testEntry = await prisma.transcriptEntry.create({
            data: {
                studentId: student.id,
                courseId: "test-course-id",
                credits: 3,
                grade: Grade.C,
                status: TranscriptStatus.COMPLETED,
                source: "NCAT",
            },
        });
    });

    afterEach(async () => {
        if (testEntry) {
            await prisma.transcriptEntry.delete({ where: { id: testEntry.id } }).catch(() => {});
        }
    });

    it("should remove an attempt successfully", async () => {
        const result = await removeTranscriptAttempt({
            entryId: testEntry.id,
        });

        expect(result.success).toBe(true);

        const deleted = await prisma.transcriptEntry.findUnique({
            where: { id: testEntry.id },
        });

        expect(deleted).toBeNull();
        testEntry = null; // Prevent cleanup from failing
    });

    it("should reject non-existent entry", async () => {
        const result = await removeTranscriptAttempt({
            entryId: "non-existent-id",
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain("not found");
    });

    it("should reject removing in-progress courses", async () => {
        const student = await prisma.studentProfile.findFirst();
        if (!student) {
            throw new Error("No test student found");
        }

        const inProgressEntry = await prisma.transcriptEntry.create({
            data: {
                studentId: student.id,
                courseId: "test-course-id-2",
                credits: 3,
                status: TranscriptStatus.IN_PROGRESS,
                source: "NCAT",
            },
        });

        const result = await removeTranscriptAttempt({
            entryId: inProgressEntry.id,
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain("in-progress");

        await prisma.transcriptEntry.delete({ where: { id: inProgressEntry.id } });
    });
});
