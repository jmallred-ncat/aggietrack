import assert from "node:assert/strict";
import { test } from "node:test";
import { Grade } from "./generated/prisma/client";
import { computeGpa } from "./gpa";

const baseEntry = {
  id: "1",
  courseId: "course1",
  subject: null,
  number: null,
  credits: 3,
  status: "COMPLETED" as const,
  source: "NCAT",
  createdAt: new Date("2024-01-01"),
};

test("computeGpa: quality points for plus/minus grades", () => {
  const transcript = [
    { ...baseEntry, id: "1", courseId: "c1", grade: Grade.A, credits: 3 }, // 4.0 * 3 = 12
    { ...baseEntry, id: "2", courseId: "c2", grade: Grade.A_MINUS, credits: 3 }, // 3.7 * 3 = 11.1
    { ...baseEntry, id: "3", courseId: "c3", grade: Grade.B_PLUS, credits: 3 }, // 3.3 * 3 = 9.9
    { ...baseEntry, id: "4", courseId: "c4", grade: Grade.B, credits: 3 }, // 3.0 * 3 = 9
    { ...baseEntry, id: "5", courseId: "c5", grade: Grade.B_MINUS, credits: 3 }, // 2.7 * 3 = 8.1
    { ...baseEntry, id: "6", courseId: "c6", grade: Grade.C_PLUS, credits: 3 }, // 2.3 * 3 = 6.9
    { ...baseEntry, id: "7", courseId: "c7", grade: Grade.C, credits: 3 }, // 2.0 * 3 = 6
    { ...baseEntry, id: "8", courseId: "c8", grade: Grade.C_MINUS, credits: 3 }, // 1.7 * 3 = 5.1
    { ...baseEntry, id: "9", courseId: "c9", grade: Grade.D_PLUS, credits: 3 }, // 1.3 * 3 = 3.9
    { ...baseEntry, id: "10", courseId: "c10", grade: Grade.D, credits: 3 }, // 1.0 * 3 = 3
    { ...baseEntry, id: "11", courseId: "c11", grade: Grade.F, credits: 3 }, // 0.0 * 3 = 0
  ];
  // Total: 75 points / 33 credits = 2.272727... rounds to 2.27
  const gpa = computeGpa(transcript);
  assert.equal(gpa, 2.27);
});

test("computeGpa: transfer courses excluded from GPA", () => {
  const transcript = [
    { ...baseEntry, id: "1", courseId: "c1", grade: Grade.A, credits: 3 }, // 12 points
    { ...baseEntry, id: "2", courseId: "c2", grade: Grade.TR, credits: 3, source: "TRANSFER" }, // Excluded
  ];
  // Only the A counts: 12 / 3 = 4.0
  const gpa = computeGpa(transcript);
  assert.equal(gpa, 4.0);
});

test("computeGpa: W/I/P excluded from GPA", () => {
  const transcript = [
    { ...baseEntry, id: "1", courseId: "c1", grade: Grade.A, credits: 3 }, // 12 points
    { ...baseEntry, id: "2", courseId: "c2", grade: Grade.W, credits: 3 }, // Excluded
    { ...baseEntry, id: "3", courseId: "c3", grade: Grade.I, credits: 3 }, // Excluded
    { ...baseEntry, id: "4", courseId: "c4", grade: Grade.P, credits: 3 }, // Excluded
  ];
  // Only the A counts: 12 / 3 = 4.0
  const gpa = computeGpa(transcript);
  assert.equal(gpa, 4.0);
});

test("computeGpa: IN_PROGRESS excluded from GPA", () => {
  const transcript = [
    { ...baseEntry, id: "1", courseId: "c1", grade: Grade.A, credits: 3 }, // 12 points
    { ...baseEntry, id: "2", courseId: "c2", grade: null, credits: 3, status: "IN_PROGRESS" as const }, // Excluded
  ];
  // Only the A counts: 12 / 3 = 4.0
  const gpa = computeGpa(transcript);
  assert.equal(gpa, 4.0);
});

test("computeGpa: repeats use higher grade only", () => {
  const transcript = [
    { ...baseEntry, id: "1", courseId: "c1", grade: Grade.F, credits: 3, createdAt: new Date("2024-01-01") }, // First attempt
    { ...baseEntry, id: "2", courseId: "c1", grade: Grade.B, credits: 3, createdAt: new Date("2024-06-01") }, // Retake (better)
  ];
  // Only the B counts: 9 / 3 = 3.0
  const gpa = computeGpa(transcript);
  assert.equal(gpa, 3.0);
});

test("computeGpa: repeats with same grade use most recent", () => {
  const transcript = [
    { ...baseEntry, id: "1", courseId: "c1", grade: Grade.B, credits: 3, createdAt: new Date("2024-01-01") },
    { ...baseEntry, id: "2", courseId: "c1", grade: Grade.B, credits: 3, createdAt: new Date("2024-06-01") }, // Most recent
  ];
  // Most recent B counts: 9 / 3 = 3.0
  const gpa = computeGpa(transcript);
  assert.equal(gpa, 3.0);
});

test("computeGpa: rounding to 2 decimals", () => {
  const transcript = [
    { ...baseEntry, id: "1", courseId: "c1", grade: Grade.A, credits: 3 }, // 12
    { ...baseEntry, id: "2", courseId: "c2", grade: Grade.B, credits: 3 }, // 9
    { ...baseEntry, id: "3", courseId: "c3", grade: Grade.C, credits: 3 }, // 6
  ];
  // 27 / 9 = 3.0
  const gpa = computeGpa(transcript);
  assert.equal(gpa, 3.0);
});

test("computeGpa: returns null when no graded hours", () => {
  const transcript = [
    { ...baseEntry, id: "1", courseId: "c1", grade: Grade.W, credits: 3 },
    { ...baseEntry, id: "2", courseId: "c2", grade: Grade.P, credits: 3 },
    { ...baseEntry, id: "3", courseId: "c3", grade: null, credits: 3, status: "IN_PROGRESS" as const },
  ];
  const gpa = computeGpa(transcript);
  assert.equal(gpa, null);
});

test("computeGpa: returns null for empty transcript", () => {
  const gpa = computeGpa([]);
  assert.equal(gpa, null);
});

test("computeGpa: F contributes 0.0 quality points but counts in hours", () => {
  const transcript = [
    { ...baseEntry, id: "1", courseId: "c1", grade: Grade.A, credits: 3 }, // 12 points
    { ...baseEntry, id: "2", courseId: "c2", grade: Grade.F, credits: 3 }, // 0 points, 3 hours
  ];
  // 12 / 6 = 2.0
  const gpa = computeGpa(transcript);
  assert.equal(gpa, 2.0);
});

test("computeGpa: variable credit courses", () => {
  const transcript = [
    { ...baseEntry, id: "1", courseId: "c1", grade: Grade.A, credits: 4 }, // 16 points
    { ...baseEntry, id: "2", courseId: "c2", grade: Grade.B, credits: 3 }, // 9 points
    { ...baseEntry, id: "3", courseId: "c3", grade: Grade.C, credits: 1 }, // 2 points
  ];
  // 27 / 8 = 3.375 rounds to 3.38
  const gpa = computeGpa(transcript);
  assert.equal(gpa, 3.38);
});
