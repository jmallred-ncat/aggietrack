import {
  applicableCredits,
  earnsDegreeCredit,
  meetsMinimumGrade,
  type ApplicableAttempt,
  type ApplicableCourse,
  type ApplicableGroup,
} from "./applicable-credits";
import { prisma } from "./prisma";

export { earnsDegreeCredit, meetsMinimumGrade };

/**
 * Degree progress for a student.
 *
 * Progress % = applicable credits ÷ program total (120 for Information Technology).
 * Applicable credits are completed courses that fill a requirement: a named
 * required course, or a course the student placed in a gen-ed or elective slot.
 * Each course counts once. Each requirement stops at its required credits.
 * Failures, withdrawals, incompletes, grades below a minimum, and courses
 * that do not fill a requirement are left out. In-progress work is left out.
 */
export async function computeDegreeProgress(studentId: string) {
  const profile = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    include: {
      catalogYear: {
        include: {
          program: { select: { totalCredits: true } },
          groups: {
            include: {
              items: { select: { courseId: true } },
            },
          },
        },
      },
    },
  });

  if (!profile) {
    return { percentage: 0, earnedCredits: 0, totalCredits: 120, mappedCourses: 0 };
  }

  const [entries, attributes] = await Promise.all([
    prisma.transcriptEntry.findMany({
      where: { studentId },
      orderBy: { createdAt: "asc" },
      select: {
        courseId: true,
        subject: true,
        number: true,
        credits: true,
        grade: true,
        status: true,
        course: { select: { subject: true, number: true } },
        recommendedTermCourse: {
          select: {
            requiresLab: true,
            requirementGroupId: true,
            term: { select: { sequence: true } },
          },
        },
      },
    }),
    prisma.courseAttribute.findMany({
      where: { catalogYearId: profile.catalogYearId },
      select: { courseId: true, tag: true },
    }),
  ]);

  const tagsByCourse = new Map<string, ApplicableCourse["tags"][number][]>();
  for (const attribute of attributes) {
    const tags = tagsByCourse.get(attribute.courseId) ?? [];
    tags.push(attribute.tag);
    tagsByCourse.set(attribute.courseId, tags);
  }

  const groups: ApplicableGroup[] = profile.catalogYear.groups.map(group => ({
    id: group.id,
    slot: group.slot,
    minCredits: group.minCredits,
    minGrade: group.minGrade,
    subject: group.subject,
    minNumber: group.minNumber,
    genEdCategory: group.genEdCategory,
    requiredGenEdTag: group.requiredGenEdTag,
    courseIds: group.items.map(item => item.courseId),
    sortOrder: group.sortOrder,
  }));

  const courses = new Map<string, ApplicableCourse>();
  const attempts: ApplicableAttempt[] = entries.map((entry, index) => {
    if (entry.courseId && entry.course) {
      courses.set(entry.courseId, {
        id: entry.courseId,
        subject: entry.course.subject,
        number: entry.course.number,
        tags: tagsByCourse.get(entry.courseId) ?? [],
      });
    }
    const sequence = entry.recommendedTermCourse?.term.sequence ?? 99;
    return {
      courseId: entry.courseId,
      subject: entry.course?.subject ?? entry.subject,
      number: entry.course?.number ?? entry.number,
      credits: entry.credits,
      grade: entry.grade,
      status: entry.status,
      groupId: entry.recommendedTermCourse?.requirementGroupId ?? null,
      requiresLab: entry.recommendedTermCourse?.requiresLab ?? false,
      order: sequence * 1000 + index,
    };
  });

  return applicableCredits({
    groups,
    courses: [...courses.values()],
    attempts,
    totalCredits: profile.catalogYear.program.totalCredits,
  });
}
