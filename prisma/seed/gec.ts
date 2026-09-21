import { GenEdTag, TermSeason } from "../../lib/generated/prisma/client";
import { type CourseRef, type CourseSeed, courseKey } from "./courses";
import { type AttributeSeed } from "./curriculum";
import ncatGenEdCourses from "./ncat_gen_ed_courses_detailed.json";

/**
 * NCAT General Education list + catalog details.
 * Source: prisma/seed/ncat_gen_ed_courses_detailed.json
 * (GEC list + catalog enrichment)
 *
 * Maps onto Course:
 *   course_code       → subject + number
 *   course_name       → title
 *   total_credits     → credits
 *   description       → description
 *   offered_in_codes  → offeredIn (F→FALL, S→SPRING, SS→SUMMER)
 *   isLab             ← inferred from title
 *
 * Maps onto CourseAttribute via gen_ed_categories:
 *   WC → WRITTEN_COMMUNICATION
 *   HFA → HUMANITIES_FINE_ARTS
 *   SBS → SOCIAL_BEHAVIORAL
 *   GL → GLOBAL_AWARENESS
 *   AA → AFRICAN_AMERICAN
 *   SR → SCIENTIFIC_REASONING
 *        labs also get SCIENTIFIC_REASONING_LAB (qualifier, not a separate pool)
 *
 * Skipped for attributes (no GenEdTag / not CST pool blockers):
 *   SS (Student Success), MLAR (math/logic)
 *
 * Skipped rows: catalog_match_status !== "matched" or missing credits.
 *
 * Courses may carry multiple tags; progress must still count each course
 * toward only one gen-ed requirement.
 */

type NcatGenEdCourse = {
  course_code: string;
  gen_ed_listed_titles: string[];
  gen_ed_categories: string[];
  course_name: string | null;
  total_credits: number | null;
  description: string | null;
  prerequisites: string | null;
  corequisites: string | null;
  offered_in_codes: string[] | null;
  source_url: string | null;
  catalog_match_status: string;
  catalog_note?: string;
};

export type CourseRelationSeed = {
  course: CourseRef;
  requires: CourseRef;
  isConcurrent: boolean;
};

const COURSE_CODE = /^([A-Z]{2,8})\s+(\d{3}[A-Z]?)$/;
const COURSE_TOKEN = /\b([A-Z]{2,8})\s+(\d{3}[A-Z]?)\b/g;

const OFFERED_CODE_TO_SEASON: Record<string, TermSeason> = {
  F: TermSeason.FALL,
  S: TermSeason.SPRING,
  SS: TermSeason.SUMMER,
};

const CATEGORY_TO_TAG: Record<string, GenEdTag> = {
  WC: GenEdTag.WRITTEN_COMMUNICATION,
  HFA: GenEdTag.HUMANITIES_FINE_ARTS,
  SBS: GenEdTag.SOCIAL_BEHAVIORAL,
  GL: GenEdTag.GLOBAL_AWARENESS,
  AA: GenEdTag.AFRICAN_AMERICAN,
  SR: GenEdTag.SCIENTIFIC_REASONING,
};

function isLabCourse(name: string) {
  return /\bLaborator(y|ies)\b/i.test(name) || /\bLab\b/i.test(name);
}

function parseCourseCode(code: string): CourseRef {
  const match = code.trim().match(COURSE_CODE);
  if (!match) {
    throw new Error(`Unrecognized course_code: ${code}`);
  }
  return { subject: match[1], number: match[2] };
}

function parseOfferedIn(codes: string[] | null | undefined): TermSeason[] {
  if (!codes?.length) {
    return [];
  }

  const seasons: TermSeason[] = [];
  const seen = new Set<TermSeason>();

  for (const code of codes) {
    const season = OFFERED_CODE_TO_SEASON[code.trim().toUpperCase()];
    if (!season) {
      throw new Error(`Unrecognized offered_in_code: ${code}`);
    }
    if (seen.has(season)) {
      continue;
    }
    seen.add(season);
    seasons.push(season);
  }

  return seasons;
}

function tagsForRow(categories: string[], isLab: boolean): GenEdTag[] {
  const tags = new Set<GenEdTag>();

  for (const category of categories) {
    const code = category.trim().toUpperCase();
    if (code === "SS" || code === "MLAR") {
      continue;
    }

    if (code === "SR") {
      tags.add(GenEdTag.SCIENTIFIC_REASONING);
      if (isLab) {
        tags.add(GenEdTag.SCIENTIFIC_REASONING_LAB);
      }
      continue;
    }

    const tag = CATEGORY_TO_TAG[code];
    if (!tag) {
      throw new Error(`Unrecognized gen_ed_category: ${category}`);
    }
    tags.add(tag);
  }

  return [...tags];
}

function extractCourseRefs(text: string): CourseRef[] {
  const refs: CourseRef[] = [];
  for (const match of text.matchAll(COURSE_TOKEN)) {
    refs.push({ subject: match[1], number: match[2] });
  }
  return refs;
}

function parseAndPrerequisiteRefs(text: string): CourseRef[] | null {
  const cleaned = text.trim().replace(/\.$/, "");
  if (!cleaned || /\bor\b/i.test(cleaned)) {
    return null;
  }

  const withoutConsent = cleaned.replace(
    /\s*(?:,?\s*)?(?:or\s+)?consent(?:\s+of|\s+from)?\s+instructor\.?/gi,
    "",
  );
  if (/\bor\b/i.test(withoutConsent)) {
    return null;
  }

  const refs = extractCourseRefs(withoutConsent);
  return refs.length > 0 ? refs : null;
}

function parseCorequisiteRefs(text: string): CourseRef[] | null {
  const cleaned = text.trim().replace(/\.$/, "");
  if (!cleaned || /\bor\b/i.test(cleaned)) {
    return null;
  }
  const refs = extractCourseRefs(cleaned);
  return refs.length > 0 ? refs : null;
}

function isSeedableRow(row: NcatGenEdCourse): boolean {
  return (
    row.catalog_match_status === "matched" &&
    typeof row.total_credits === "number" &&
    Boolean(row.course_name?.trim())
  );
}

type ParsedGenEd = {
  course: CourseSeed;
  tags: GenEdTag[];
  row: NcatGenEdCourse;
};

const parsedRows: ParsedGenEd[] = (ncatGenEdCourses as NcatGenEdCourse[])
  .filter(isSeedableRow)
  .map((row) => {
    const { subject, number } = parseCourseCode(row.course_code);
    const title = row.course_name!.trim();
    const isLab = isLabCourse(title);

    return {
      row,
      tags: tagsForRow(row.gen_ed_categories ?? [], isLab),
      course: {
        subject,
        number,
        title,
        credits: row.total_credits!,
        description: row.description?.trim() || undefined,
        isLab,
        offeredIn: parseOfferedIn(row.offered_in_codes),
      },
    };
  });

export const gecCourses: CourseSeed[] = parsedRows.map(({ course }) => course);

export const gecAttributes: AttributeSeed[] = parsedRows.flatMap(
  ({ course, tags }) =>
    tags.map((tag) => ({
      course: { subject: course.subject, number: course.number },
      tag,
    })),
);

const gecCourseKeys = new Set(gecCourses.map(courseKey));

/** Same-subject coreqs (lecture/lab). Cross-subject coreqs stay description-only. */
export const gecCatalogRelations: CourseRelationSeed[] = parsedRows.flatMap(
  ({ course, row }) => {
    const courseRef = { subject: course.subject, number: course.number };
    const relations: CourseRelationSeed[] = [];

    if (row.corequisites) {
      for (const requires of parseCorequisiteRefs(row.corequisites) ?? []) {
        if (requires.subject !== course.subject) {
          continue;
        }
        if (!gecCourseKeys.has(courseKey(requires))) {
          continue;
        }
        relations.push({ course: courseRef, requires, isConcurrent: true });
        relations.push({
          course: requires,
          requires: courseRef,
          isConcurrent: true,
        });
      }
    }

    if (row.prerequisites) {
      for (const requires of parseAndPrerequisiteRefs(row.prerequisites) ?? []) {
        relations.push({ course: courseRef, requires, isConcurrent: false });
      }
    }

    return relations;
  },
);

export function mergeGecCourses(existing: CourseSeed[]): CourseSeed[] {
  const byKey = new Map(existing.map((course) => [courseKey(course), course]));

  for (const course of gecCourses) {
    const key = courseKey(course);
    const prior = byKey.get(key);
    if (!prior) {
      byKey.set(key, course);
      continue;
    }

    byKey.set(key, {
      ...prior,
      title: course.title,
      credits: course.credits,
      description: course.description ?? prior.description,
      isLab: course.isLab || prior.isLab,
      offeredIn:
        course.offeredIn && course.offeredIn.length > 0
          ? course.offeredIn
          : prior.offeredIn,
    });
  }

  return [...byKey.values()];
}

export function mergeGecConcurrentPairs(
  existing: [CourseRef, CourseRef][],
): [CourseRef, CourseRef][] {
  const seen = new Set(
    existing.map(([a, b]) => [courseKey(a), courseKey(b)].sort().join("|")),
  );
  const pairs = [...existing];

  for (const relation of gecCatalogRelations) {
    if (!relation.isConcurrent) {
      continue;
    }
    const key = [courseKey(relation.course), courseKey(relation.requires)]
      .sort()
      .join("|");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    pairs.push([relation.course, relation.requires]);
  }

  return pairs;
}
