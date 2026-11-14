import { Grade, type TranscriptStatus } from "./generated/prisma/client";

/**
 * Quality points per NC A&T official policy.
 * Source: https://www.ncat.edu/registrar/student-info/grade-point-averages.php
 */
const QUALITY_POINTS: Record<Grade, number | null> = {
  [Grade.A]: 4.0,
  [Grade.A_MINUS]: 3.7,
  [Grade.B_PLUS]: 3.3,
  [Grade.B]: 3.0,
  [Grade.B_MINUS]: 2.7,
  [Grade.C_PLUS]: 2.3,
  [Grade.C]: 2.0,
  [Grade.C_MINUS]: 1.7,
  [Grade.D_PLUS]: 1.3,
  [Grade.D]: 1.0,
  [Grade.F]: 0.0,
  // Excluded from GPA calculation (no hours, no points)
  [Grade.W]: null, // Withdrawn
  [Grade.I]: null, // Incomplete
  [Grade.P]: null, // Pass (no quality points)
  [Grade.TR]: null, // Transfer (credit earned, but no quality points)
};

type TranscriptEntry = {
  id: string;
  courseId: string | null;
  subject: string | null;
  number: string | null;
  credits: number;
  grade: Grade | null;
  status: TranscriptStatus;
  source: string;
  createdAt: Date;
};

/**
 * Compute cumulative GPA per NC A&T policy.
 * 
 * Rules:
 * - Quality points: A 4.0, A- 3.7, B+ 3.3, B 3.0, B- 2.7, C+ 2.3, C 2.0, C- 1.7, D+ 1.3, D 1.0, F 0.0
 * - GPA = total quality points / credit hours attempted with regular letter grades
 * - Excluded from GPA: W, I, P, TR/transfer, IN_PROGRESS (no hours, no points)
 * - Repeats: only the higher grade counts (same grade twice: most recent)
 * - Returns null when no graded hours exist
 * 
 * @param transcript All transcript entries for the student
 * @returns GPA rounded to 2 decimals, or null if no graded hours
 */
export function computeGpa(transcript: TranscriptEntry[]): number | null {
  // Group attempts by course (courseId or subject+number for unlisted courses)
  const courseAttempts = new Map<string, TranscriptEntry[]>();
  
  for (const entry of transcript) {
    // Skip in-progress courses
    if (entry.status === "IN_PROGRESS") continue;
    
    // Skip entries with no grade or non-GPA grades
    if (!entry.grade || QUALITY_POINTS[entry.grade] === null) continue;
    
    const courseKey = entry.courseId 
      ? entry.courseId 
      : `${entry.subject}-${entry.number}`;
    
    if (!courseAttempts.has(courseKey)) {
      courseAttempts.set(courseKey, []);
    }
    courseAttempts.get(courseKey)!.push(entry);
  }
  
  let totalQualityPoints = 0;
  let totalCredits = 0;
  
  // For each course, use only the best attempt (or most recent if tied)
  for (const attempts of courseAttempts.values()) {
    if (attempts.length === 0) continue;
    
    // Sort by quality points (descending), then by createdAt (most recent first)
    const sorted = [...attempts].sort((a, b) => {
      const qpA = QUALITY_POINTS[a.grade!] ?? 0;
      const qpB = QUALITY_POINTS[b.grade!] ?? 0;
      if (qpA !== qpB) return qpB - qpA; // Higher quality points first
      return b.createdAt.getTime() - a.createdAt.getTime(); // Most recent first if tied
    });
    
    const bestAttempt = sorted[0]!;
    const qualityPoints = QUALITY_POINTS[bestAttempt.grade!] ?? 0;
    
    totalQualityPoints += qualityPoints * bestAttempt.credits;
    totalCredits += bestAttempt.credits;
  }
  
  if (totalCredits === 0) {
    return null; // No graded hours
  }
  
  return Math.round((totalQualityPoints / totalCredits) * 100) / 100;
}

/**
 * Compute graduation honors per NC A&T policy.
 * 
 * Honors use an ADJUSTED GPA distinct from cumulative GPA:
 * - All NC A&T attempted letter-graded hours EXCLUDING only W
 * - Repeated courses count BOTH attempts (no replacement)
 * - Transfer/TR, P, I, IN_PROGRESS excluded (no grade points)
 * - Requires at least 48 semester hours of NC A&T resident (non-transfer) credit
 * 
 * Thresholds:
 * - Cum Laude: 3.25-3.49
 * - Magna Cum Laude: 3.50-3.74
 * - Summa Cum Laude: 3.75-4.00
 * 
 * @param transcript All transcript entries for the student
 * @returns { adjustedGpa, residentHours, honor, eligible }
 */
export function computeHonors(transcript: TranscriptEntry[]): {
  adjustedGpa: number | null;
  residentHours: number;
  honor: "Summa Cum Laude" | "Magna Cum Laude" | "Cum Laude" | null;
  eligible: boolean;
} {
  let totalQualityPoints = 0;
  let totalCredits = 0;
  let residentHours = 0;

  for (const entry of transcript) {
    // Skip non-completed courses (in-progress, failed, withdrawn)
    if (entry.status !== "COMPLETED") continue;
    
    // Skip entries with no grade
    if (!entry.grade) continue;
    
    // Skip non-GPA grades (P, TR, I, W)
    if (QUALITY_POINTS[entry.grade] === null) continue;
    
    // Count all NC A&T letter-graded attempts (including repeats)
    const qualityPoints = QUALITY_POINTS[entry.grade] ?? 0;
    totalQualityPoints += qualityPoints * entry.credits;
    totalCredits += entry.credits;
    
    // Count resident (non-transfer) hours for eligibility
    if (entry.source !== "TRANSFER") {
      residentHours += entry.credits;
    }
  }

  const adjustedGpa = totalCredits > 0 
    ? Math.round((totalQualityPoints / totalCredits) * 100) / 100 
    : null;
  
  // Determine honor based on adjusted GPA
  let honor: "Summa Cum Laude" | "Magna Cum Laude" | "Cum Laude" | null = null;
  if (adjustedGpa !== null) {
    if (adjustedGpa >= 3.75) {
      honor = "Summa Cum Laude";
    } else if (adjustedGpa >= 3.50) {
      honor = "Magna Cum Laude";
    } else if (adjustedGpa >= 3.25) {
      honor = "Cum Laude";
    }
  }
  
  // Eligible if at least 48 resident hours
  const eligible = residentHours >= 48;
  
  return { adjustedGpa, residentHours, honor, eligible };
}
