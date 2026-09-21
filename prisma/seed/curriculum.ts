import {
  GenEdTag,
  Grade,
  RequirementKind,
  RequirementSlot,
  TermSeason,
  type PrismaClient,
} from "../../lib/generated/prisma/client";
import { type CourseRef, courseKey } from "./courses";

export type RequirementSeed = {
  name: string;
  slot: RequirementSlot;
  kind?: RequirementKind;
  minCredits: number;
  minGrade?: Grade;
  sortOrder: number;
  subject?: string;
  minNumber?: number;
  genEdCategory?: GenEdTag;
  requiredGenEdTag?: GenEdTag;
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

const kindBySlot: Record<RequirementSlot, RequirementKind> = {
  [RequirementSlot.PROGRAM_CORE]: RequirementKind.ALL_OF,
  [RequirementSlot.SUPPORTING_REQUIRED]: RequirementKind.ALL_OF,
  [RequirementSlot.RELATED_POOL]: RequirementKind.CREDITS_FROM_POOL,
  [RequirementSlot.GEN_ED_POOL]: RequirementKind.CREDITS_FROM_POOL,
  [RequirementSlot.TECHNICAL_ELECTIVE]: RequirementKind.SUBJECT_ELECTIVE,
  [RequirementSlot.FREE_ELECTIVE]: RequirementKind.FREE_ELECTIVE,
};

const GEN_ED_CATEGORY_NAMES: Partial<Record<GenEdTag, string>> = {
  [GenEdTag.WRITTEN_COMMUNICATION]: "Written Communication",
  [GenEdTag.HUMANITIES_FINE_ARTS]: "Humanities and Fine Arts",
  [GenEdTag.SOCIAL_BEHAVIORAL]: "Social/Behavioral Sciences",
  [GenEdTag.GLOBAL_AWARENESS]: "Global Awareness",
  [GenEdTag.AFRICAN_AMERICAN]: "African American Studies",
  [GenEdTag.SCIENTIFIC_REASONING]: "Scientific Reasoning",
};

function kindFor(group: RequirementSeed) {
  return group.kind ?? kindBySlot[group.slot];
}

function genEdDisplayName(category: GenEdTag) {
  const name = GEN_ED_CATEGORY_NAMES[category];
  if (!name) {
    throw new Error(`${category} is a qualifier tag, not a gen-ed pool category`);
  }
  return name;
}

/** Opt a program into a GEC category. Does not stamp unused university categories. */
export function genEdRequirement(input: {
  category: GenEdTag;
  minCredits: number;
  sortOrder: number;
  requiredTag?: GenEdTag;
  name?: string;
}): RequirementSeed {
  return {
    name: input.name ?? genEdDisplayName(input.category),
    slot: RequirementSlot.GEN_ED_POOL,
    kind: RequirementKind.CREDITS_FROM_POOL,
    genEdCategory: input.category,
    requiredGenEdTag: input.requiredTag,
    minCredits: input.minCredits,
    sortOrder: input.sortOrder,
  };
}

function validateRequirementGroups(groups: RequirementSeed[]) {
  const slotCounts = new Map<RequirementSlot, number>();
  const genEdCategories = new Set<GenEdTag>();

  for (const group of groups) {
    slotCounts.set(group.slot, (slotCounts.get(group.slot) ?? 0) + 1);

    const expectedKind = kindBySlot[group.slot];
    const kind = kindFor(group);
    if (kind !== expectedKind) {
      throw new Error(
        `${group.name} uses ${kind}, but ${group.slot} requires ${expectedKind}`,
      );
    }

    const hasCourses = Boolean(group.courses?.length);
    if (
      (group.slot === RequirementSlot.PROGRAM_CORE ||
        group.slot === RequirementSlot.SUPPORTING_REQUIRED) &&
      !hasCourses
    ) {
      throw new Error(`${group.name} must list at least one required course`);
    }

    if (
      group.slot === RequirementSlot.RELATED_POOL &&
      !hasCourses &&
      !group.subject
    ) {
      throw new Error(`${group.name} must define courses or a subject`);
    }

    if (
      group.slot === RequirementSlot.TECHNICAL_ELECTIVE &&
      !group.subject
    ) {
      throw new Error(`${group.name} must define a subject`);
    }

    if (
      (group.slot === RequirementSlot.GEN_ED_POOL ||
        group.slot === RequirementSlot.TECHNICAL_ELECTIVE ||
        group.slot === RequirementSlot.FREE_ELECTIVE) &&
      hasCourses
    ) {
      throw new Error(`${group.name} cannot contain fixed course items`);
    }

    if (group.slot === RequirementSlot.GEN_ED_POOL) {
      if (!group.genEdCategory) {
        throw new Error(`${group.name} must declare a gen-ed category`);
      }
      if (group.genEdCategory === GenEdTag.SCIENTIFIC_REASONING_LAB) {
        throw new Error(
          `${group.name} should use requiredGenEdTag for lab, not a separate group`,
        );
      }
      if (genEdCategories.has(group.genEdCategory)) {
        throw new Error(
          `Category ${group.genEdCategory} is already used in this curriculum`,
        );
      }
      genEdCategories.add(group.genEdCategory);
      if (
        group.requiredGenEdTag &&
        group.requiredGenEdTag === group.genEdCategory
      ) {
        throw new Error(`${group.name} required tag must differ from its category`);
      }
    } else if (group.genEdCategory || group.requiredGenEdTag) {
      throw new Error(`${group.name} cannot carry gen-ed category fields`);
    }
  }

  if ((slotCounts.get(RequirementSlot.PROGRAM_CORE) ?? 0) !== 1) {
    throw new Error("A curriculum must contain exactly one program core");
  }

  for (const slot of [
    RequirementSlot.TECHNICAL_ELECTIVE,
    RequirementSlot.FREE_ELECTIVE,
  ]) {
    if ((slotCounts.get(slot) ?? 0) > 1) {
      throw new Error(`A curriculum cannot contain more than one ${slot}`);
    }
  }
}

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
  validateRequirementGroups(curriculum.groups);

  await prisma.$transaction(async (tx) => {
    await tx.requirementGroup.deleteMany({ where: { catalogYearId } });
    await tx.recommendedTerm.deleteMany({ where: { catalogYearId } });
    await tx.courseAttribute.deleteMany({ where: { catalogYearId } });

    for (const group of curriculum.groups) {
      await tx.requirementGroup.create({
        data: {
          catalogYearId,
          name: group.name,
          kind: kindFor(group),
          slot: group.slot,
          minCredits: group.minCredits,
          minGrade: group.minGrade,
          sortOrder: group.sortOrder,
          subject: group.subject,
          minNumber: group.minNumber,
          genEdCategory: group.genEdCategory,
          requiredGenEdTag: group.requiredGenEdTag,
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
