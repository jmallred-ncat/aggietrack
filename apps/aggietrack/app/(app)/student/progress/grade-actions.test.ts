import { Grade, TranscriptStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { describe, it, before, after, mock } from "node:test";
import assert from "node:assert";
import { addTranscriptAttempt, removeTranscriptAttempt, updateTranscriptGrade } from "./grade-actions";

// Mock the student profile requirement
mock.method(await import("@/lib/student"), "requireStudentProfile", () => Promise.resolve({ 
    id: "test-student-id",
    catalogYearId: "test-catalog-year-id",
}));

// Mock next/cache
mock.module("next/cache", {
    namedExports: {
        revalidatePath: () => {},
    },
});

describe("updateTranscriptGrade", () => {
    it("should reject invalid input", async () => {
        const result = await updateTranscriptGrade({
            entryId: "test-entry-id",
            grade: "INVALID",
        });

        assert.equal(result.success, false);
        assert.ok(result.error && result.error.includes("Invalid"));
    });
});

describe("addTranscriptAttempt", () => {
    it("should reject invalid input", async () => {
        const result = await addTranscriptAttempt({
            courseId: "test-course-id",
            credits: 3,
            grade: "INVALID",
        });

        assert.equal(result.success, false);
        assert.ok(result.error && result.error.includes("Invalid"));
    });
});

describe("removeTranscriptAttempt", () => {
    it("should reject non-existent entry", async () => {
        const result = await removeTranscriptAttempt({
            entryId: "non-existent-id",
        });

        assert.equal(result.success, false);
        assert.ok(result.error && result.error.includes("not found"));
    });
});
