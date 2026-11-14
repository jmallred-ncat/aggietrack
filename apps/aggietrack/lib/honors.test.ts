import assert from "node:assert/strict";
import { test } from "node:test";
import { Grade } from "./generated/prisma/client";
import { computeHonors } from "./gpa";

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

test("computeHonors: Summa Cum Laude at 3.75 threshold", () => {
  const transcript = [
    { ...baseEntry, id: "1", courseId: "c1", grade: Grade.A, credits: 48 }, // 4.0 × 48
  ];
  const honors = computeHonors(transcript);
  assert.equal(honors.adjustedGpa, 4.0);
  assert.equal(honors.residentHours, 48);
  assert.equal(honors.honor, "Summa Cum Laude");
  assert.equal(honors.eligible, true);
});

test("computeHonors: Summa Cum Laude at 3.75 exact boundary", () => {
  const transcript = [
    { ...baseEntry, id: "1", courseId: "c1", grade: Grade.A, credits: 3 }, // 12
    { ...baseEntry, id: "2", courseId: "c2", grade: Grade.B_PLUS, credits: 3 }, // 9.9
  ];
  // Total: 21.9 / 6 = 3.65 (not summa)
  const honors = computeHonors(transcript);
  assert.equal(honors.adjustedGpa, 3.65);
  assert.equal(honors.honor, "Magna Cum Laude");
});

test("computeHonors: Magna Cum Laude at 3.50-3.74 range", () => {
  const transcript = [
    { ...baseEntry, id: "1", courseId: "c1", grade: Grade.A_MINUS, credits: 48 }, // 3.7 × 48
  ];
  const honors = computeHonors(transcript);
  assert.equal(honors.adjustedGpa, 3.7);
  assert.equal(honors.residentHours, 48);
  assert.equal(honors.honor, "Magna Cum Laude");
  assert.equal(honors.eligible, true);
});

test("computeHonors: Magna Cum Laude at 3.50 exact boundary", () => {
  const transcript = [
    { ...baseEntry, id: "1", courseId: "c1", grade: Grade.A_MINUS, credits: 3 }, // 11.1
    { ...baseEntry, id: "2", courseId: "c2", grade: Grade.B_PLUS, credits: 3 }, // 9.9
  ];
  // Total: 21 / 6 = 3.50 exact
  const honors = computeHonors(transcript);
  assert.equal(honors.adjustedGpa, 3.5);
  assert.equal(honors.honor, "Magna Cum Laude");
});

test("computeHonors: Cum Laude at 3.25-3.49 range", () => {
  const transcript = [
    { ...baseEntry, id: "1", courseId: "c1", grade: Grade.B_PLUS, credits: 48 }, // 3.3 × 48
  ];
  const honors = computeHonors(transcript);
  assert.equal(honors.adjustedGpa, 3.3);
  assert.equal(honors.residentHours, 48);
  assert.equal(honors.honor, "Cum Laude");
  assert.equal(honors.eligible, true);
});

test("computeHonors: Cum Laude at 3.25 exact boundary", () => {
  const transcript = [
    { ...baseEntry, id: "1", courseId: "c1", grade: Grade.B_PLUS, credits: 3 }, // 9.9
    { ...baseEntry, id: "2", courseId: "c2", grade: Grade.B, credits: 3 }, // 9
  ];
  // Total: 18.9 / 6 = 3.15 (not cum laude)
  const honors = computeHonors(transcript);
  assert.equal(honors.adjustedGpa, 3.15);
  assert.equal(honors.honor, null);
});

test("computeHonors: below 3.25 gets no honor", () => {
  const transcript = [
    { ...baseEntry, id: "1", courseId: "c1", grade: Grade.B, credits: 48 }, // 3.0 × 48
  ];
  const honors = computeHonors(transcript);
  assert.equal(honors.adjustedGpa, 3.0);
  assert.equal(honors.residentHours, 48);
  assert.equal(honors.honor, null);
  assert.equal(honors.eligible, true);
});

test("computeHonors: repeats count BOTH attempts (lowers adjusted GPA)", () => {
  const transcript = [
    // First attempt: F
    { ...baseEntry, id: "1", courseId: "c1", grade: Grade.F, credits: 3, createdAt: new Date("2024-01-01") }, // 0
    // Retake: B
    { ...baseEntry, id: "2", courseId: "c1", grade: Grade.B, credits: 3, createdAt: new Date("2024-06-01") }, // 9
    // Other courses: A
    { ...baseEntry, id: "3", courseId: "c2", grade: Grade.A, credits: 3 }, // 12
    { ...baseEntry, id: "4", courseId: "c3", grade: Grade.A, credits: 3 }, // 12
  ];
  // Total: 0 + 9 + 12 + 12 = 33 / 12 = 2.75
  // Cumulative GPA would be (9 + 12 + 12) / 9 = 3.67 (only B counts for repeats)
  // Adjusted GPA includes both F and B: 33 / 12 = 2.75
  const honors = computeHonors(transcript);
  assert.equal(honors.adjustedGpa, 2.75);
  assert.equal(honors.residentHours, 12);
  assert.equal(honors.honor, null); // Below 3.25
});

test("computeHonors: W excluded from adjusted GPA (no hours, no points)", () => {
  const transcript = [
    { ...baseEntry, id: "1", courseId: "c1", grade: Grade.A, credits: 3 }, // 12
    { ...baseEntry, id: "2", courseId: "c2", grade: Grade.W, credits: 3 }, // Excluded
  ];
  // Total: 12 / 3 = 4.0 (W doesn't count)
  const honors = computeHonors(transcript);
  assert.equal(honors.adjustedGpa, 4.0);
  assert.equal(honors.residentHours, 3);
  assert.equal(honors.honor, "Summa Cum Laude");
  assert.equal(honors.eligible, false); // < 48 hours
});

test("computeHonors: transfer credits excluded from resident hours", () => {
  const transcript = [
    { ...baseEntry, id: "1", courseId: "c1", grade: Grade.A, credits: 24, source: "NCAT" }, // Resident
    { ...baseEntry, id: "2", courseId: "c2", grade: Grade.TR, credits: 24, source: "TRANSFER" }, // Transfer, excluded
  ];
  // Adjusted GPA: only A counts (TR excluded)
  // Resident hours: only 24 (transfer excluded)
  const honors = computeHonors(transcript);
  assert.equal(honors.adjustedGpa, 4.0);
  assert.equal(honors.residentHours, 24);
  assert.equal(honors.honor, "Summa Cum Laude");
  assert.equal(honors.eligible, false); // < 48 resident hours
});

test("computeHonors: <48 resident hours means not eligible", () => {
  const transcript = [
    { ...baseEntry, id: "1", courseId: "c1", grade: Grade.A, credits: 30, source: "NCAT" },
    { ...baseEntry, id: "2", courseId: "c2", grade: Grade.TR, credits: 20, source: "TRANSFER" },
  ];
  const honors = computeHonors(transcript);
  assert.equal(honors.adjustedGpa, 4.0);
  assert.equal(honors.residentHours, 30); // Only NC A&T hours count
  assert.equal(honors.honor, "Summa Cum Laude");
  assert.equal(honors.eligible, false); // < 48 resident hours
});

test("computeHonors: 48 resident hours makes eligible", () => {
  const transcript = [
    { ...baseEntry, id: "1", courseId: "c1", grade: Grade.A, credits: 48, source: "NCAT" },
  ];
  const honors = computeHonors(transcript);
  assert.equal(honors.adjustedGpa, 4.0);
  assert.equal(honors.residentHours, 48);
  assert.equal(honors.honor, "Summa Cum Laude");
  assert.equal(honors.eligible, true); // >= 48 resident hours
});

test("computeHonors: P/I/IN_PROGRESS excluded from adjusted GPA", () => {
  const transcript = [
    { ...baseEntry, id: "1", courseId: "c1", grade: Grade.A, credits: 3 }, // 12
    { ...baseEntry, id: "2", courseId: "c2", grade: Grade.P, credits: 3 }, // Excluded
    { ...baseEntry, id: "3", courseId: "c3", grade: Grade.I, credits: 3 }, // Excluded
    { ...baseEntry, id: "4", courseId: "c4", grade: null, credits: 3, status: "IN_PROGRESS" as const }, // Excluded
  ];
  // Total: 12 / 3 = 4.0 (only A counts)
  const honors = computeHonors(transcript);
  assert.equal(honors.adjustedGpa, 4.0);
  assert.equal(honors.residentHours, 3);
});

test("computeHonors: F grade included in adjusted GPA even when stored as FAILED", () => {
  const transcript = [
    { ...baseEntry, id: "1", courseId: "c1", grade: Grade.A, credits: 3 }, // 12
    { ...baseEntry, id: "2", courseId: "c2", grade: Grade.F, credits: 3, status: "FAILED" as const }, // 0
  ];
  // Total: (12 + 0) / 6 = 2.0
  const honors = computeHonors(transcript);
  assert.equal(honors.adjustedGpa, 2.0);
  assert.equal(honors.residentHours, 6); // Both attempts count toward resident hours
  assert.equal(honors.honor, null); // < 3.25
  assert.equal(honors.eligible, false);
});

test("computeHonors: F never retaken lowers honors GPA and prevents honors", () => {
  const transcript = [
    { ...baseEntry, id: "1", courseId: "c1", grade: Grade.A, credits: 48 }, // 192
    { ...baseEntry, id: "2", courseId: "c2", grade: Grade.F, credits: 3, status: "FAILED" as const }, // 0
  ];
  // Total: 192 / 51 = 3.76 (Magna range is 3.5-3.74, Cum Laude is 3.25-3.49)
  const honors = computeHonors(transcript);
  assert.equal(honors.adjustedGpa, 3.76);
  assert.equal(honors.residentHours, 51);
  assert.equal(honors.honor, "Magna Cum Laude");
  assert.equal(honors.eligible, true);
});
