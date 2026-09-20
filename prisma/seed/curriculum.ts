import {
  GenEdTag,
  Grade,
  RequirementKind,
  TermSeason,
  type PrismaClient,
} from "../../lib/generated/prisma/client";
import { type CourseRef, courseKey } from "./courses";

export type RequirementSeed = {
  name: string;
  kind: RequirementKind;
  minCredits: number;
  minGrade?: Grade;
  sortOrder: number;
  subject?: string;
  minNumber?: number;
  courses?: CourseRef[];
};

export type RecommendedTermSeed = {
  sequence: number;
  season: TermSeason;
  courses: CourseRef[];
};

export type AttributeSeed = {
  course: CourseRef;
  tag: GenEdTag;
};

export type CurriculumSeed = {
  groups: RequirementSeed[];
  recommended: RecommendedTermSeed[];
  attributes?: AttributeSeed[];
};

export function resolveCourseId(
  courseIds: Map<string, string>,
  course: CourseRef,
) {
  const id = courseIds.get(courseKey(course));
  if (!id) {
    throw new Error(`Course ${course.subject} ${course.number} was not seeded`);
  }
  return id;
}

export async function replaceCurriculum(
  prisma: PrismaClient,
  catalogYearId: string,
  courseIds: Map<string, string>,
  curriculum: CurriculumSeed,
) {
  await prisma.$transaction(async (tx) => {
    await tx.requirementGroup.deleteMany({ where: { catalogYearId } });
    await tx.recommendedTerm.deleteMany({ where: { catalogYearId } });
    await tx.courseAttribute.deleteMany({ where: { catalogYearId } });

    for (const group of curriculum.groups) {
      await tx.requirementGroup.create({
        data: {
          catalogYearId,
          name: group.name,
          kind: group.kind,
          minCredits: group.minCredits,
          minGrade: group.minGrade,
          sortOrder: group.sortOrder,
          subject: group.subject,
          minNumber: group.minNumber,
          items: group.courses
            ? {
                create: group.courses.map((course) => ({
                  courseId: resolveCourseId(courseIds, course),
                })),
              }
            : undefined,
        },
      });
    }

    for (const term of curriculum.recommended) {
      await tx.recommendedTerm.create({
        data: {
          catalogYearId,
          sequence: term.sequence,
          season: term.season,
          courses: {
            create: term.courses.map((course) => ({
              courseId: resolveCourseId(courseIds, course),
            })),
          },
        },
      });
    }

    for (const attribute of curriculum.attributes ?? []) {
      await tx.courseAttribute.create({
        data: {
          catalogYearId,
          courseId: resolveCourseId(courseIds, attribute.course),
          tag: attribute.tag,
        },
      });
    }
  });
}
