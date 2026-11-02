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

  // Group entries by courseId to find the best attempt for each course
  const entriesByCourse = new Map<string, typeof completedEntries>();
  for (const entry of completedEntries) {
    if (!entry.courseId) continue;
    const existing = entriesByCourse.get(entry.courseId) || [];
    existing.push(entry);
    entriesByCourse.set(entry.courseId, existing);
  }

  let earnedCredits = 0;
  let mappedCourses = 0;

  // Process each course (taking best attempt)
  for (const [courseId, attempts] of entriesByCourse.entries()) {
    // Check if this course maps to any requirement
    const requirementGroups = courseToGroups.get(courseId);
    if (!requirementGroups || requirementGroups.length === 0) continue;

    // Find the best attempt that meets any requirement's minimum grade
    // Best = highest grade in GRADE_ORDER
    let bestAttempt: typeof attempts[0] | null = null;
    let bestGradeOrder = -1;
    let matchingGroup: { groupId: string; minGrade: Grade | null } | null = null;

    for (const attempt of attempts) {
      // Find if this attempt's grade meets any requirement's minimum
      const group = requirementGroups.find(g => 
        meetsMinimumGrade(attempt.grade, g.minGrade)
      );

      if (group && attempt.grade) {
        const gradeOrder = GRADE_ORDER[attempt.grade];
        if (gradeOrder > bestGradeOrder) {
          bestGradeOrder = gradeOrder;
          bestAttempt = attempt;
          matchingGroup = group;
        }
      }
    }

    // Count the best attempt if one passed the minimum grade
    if (bestAttempt && matchingGroup) {
      earnedCredits += bestAttempt.credits;
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
