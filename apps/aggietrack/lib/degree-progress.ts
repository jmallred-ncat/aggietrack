import { Grade } from "./generated/prisma/client";
import { prisma } from "./prisma";

/**
 * Grade ordering for minimum grade comparisons.
 * Higher index = better grade.
 */
const GRADE_ORDER: Record<Grade, number> = {
  [Grade.F]: 0,
  [Grade.D]: 1,
  [Grade.D_PLUS]: 2,
  [Grade.C_MINUS]: 3,
  [Grade.C]: 4,
  [Grade.C_PLUS]: 5,
  [Grade.B_MINUS]: 6,
  [Grade.B]: 7,
  [Grade.B_PLUS]: 8,
  [Grade.A_MINUS]: 9,
  [Grade.A]: 10,
  [Grade.P]: 4, // Pass is equivalent to C
  [Grade.TR]: 4, // Transfer credit is equivalent to C
  [Grade.W]: 0, // Withdrawn
  [Grade.I]: 0, // Incomplete
};

/**
 * Check if a grade meets the minimum requirement.
 * Returns true if actualGrade >= minGrade, or if minGrade is null (no requirement).
 */
export function meetsMinimumGrade(actualGrade: Grade | null, minGrade: Grade | null): boolean {
  if (!minGrade) return true; // No minimum grade requirement
  if (!actualGrade) return false; // No grade recorded
  return GRADE_ORDER[actualGrade] >= GRADE_ORDER[minGrade];
}

/**
 * Computes the degree progress percentage for a student.
 * 
 * Progress % = earned applicable credits ÷ program total credits (120 for IT)
 * 
 * Earned means a TranscriptEntry with:
 * - status COMPLETED
 * - grade at or above the requirement group's minimum grade
 * - mapped to a requirement item in the student's program
 * 
 * Each course counts once toward one requirement (no double counting).
 * Failed, withdrawn, and unmapped credits are excluded.
 * IN_PROGRESS and APPROVED planned courses are not counted.
 * 
 * Returns percentage clamped between 0-100, and the raw counts.
 */
export async function computeDegreeProgress(studentId: string) {
  // Get student profile to find program and catalog year
  const profile = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    include: {
      catalogYear: {
        include: {
          program: {
            select: {
              totalCredits: true,
            },
          },
          groups: {
            include: {
              items: {
                include: {
                  course: {
                    select: {
                      id: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!profile) {
    return { percentage: 0, earnedCredits: 0, totalCredits: 120, mappedCourses: 0 };
  }

  const totalCredits = profile.catalogYear.program.totalCredits;

  // Get all completed transcript entries for this student
  const completedEntries = await prisma.transcriptEntry.findMany({
    where: {
      studentId,
      status: "COMPLETED",
    },
    select: {
      id: true,
      courseId: true,
      credits: true,
      grade: true,
      updatedAt: true,
    },
    orderBy: {
      updatedAt: "asc", // Process earliest attempts first
    },
  });

  // Build a map of courseId -> requirement groups that accept it
  // A course can satisfy multiple requirement groups, but we only count it once
  const courseToGroups = new Map<string, Array<{ groupId: string; minGrade: Grade | null }>>();
  
  for (const group of profile.catalogYear.groups) {
    for (const item of group.items) {
      const courseId = item.course.id;
      const existing = courseToGroups.get(courseId) || [];
      existing.push({ groupId: group.id, minGrade: group.minGrade });
      courseToGroups.set(courseId, existing);
    }
  }

  // Track which courses have been counted (to avoid double counting)
  const countedCourses = new Set<string>();
  let earnedCredits = 0;
  let mappedCourses = 0;

  // Process each completed entry
  for (const entry of completedEntries) {
    if (!entry.courseId) continue;
    
    // Skip if this course was already counted
    if (countedCourses.has(entry.courseId)) continue;

    // Check if this course maps to any requirement
    const requirementGroups = courseToGroups.get(entry.courseId);
    if (!requirementGroups || requirementGroups.length === 0) continue;

    // Find the first requirement group where the grade meets the minimum
    // (We only count the course once, toward the first matching requirement)
    const matchingGroup = requirementGroups.find(group => 
      meetsMinimumGrade(entry.grade, group.minGrade)
    );

    if (matchingGroup) {
      // Count this course's credits
      earnedCredits += entry.credits;
      countedCourses.add(entry.courseId);
      mappedCourses++;
    }
  }

  // Calculate percentage and clamp between 0-100
  const percentage = totalCredits > 0 
    ? Math.min(100, Math.max(0, (earnedCredits / totalCredits) * 100))
    : 0;

  return {
    percentage: Math.round(percentage * 10) / 10, // Round to 1 decimal place
    earnedCredits,
    totalCredits,
    mappedCourses,
  };
}
