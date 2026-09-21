import { TermSeason } from "../../lib/generated/prisma/client";
import { type CourseRef, type CourseSeed, courseKey } from "./courses";
import ncatCstSearchCourses from "./ncat_cst_search_courses_detailed.json";

/**
 * NCAT catalog search export for CST.
 * Source: prisma/seed/ncat_cst_search_courses_detailed.json
 *
 * Maps onto Course:
 *   course_code       → subject + number
 *   course_name       → title
 *   total_credits     → credits
 *   description       → description
 *   offered_in_codes  → offeredIn (F→FALL, S→SPRING, SS→SUMMER)
 *   isLab             ← inferred from title
 *
 * Maps onto CoursePrerequisite (when both courses exist in the seed):
 *   corequisites      → isConcurrent: true (both directions)
 *   prerequisites     → isConcurrent: false for simple / AND lists only
 *                       (OR groups and class-standing text are left in description)
 *
 * Not stored (no schema field):
 *   source_url
 */

type NcatSearchCourse = {
  course_code: string;
  course_name: string;
  total_credits: number;
  description: string;
  source_url: string;
  prerequisites: string | null;
  corequisites: string | null;
  offered_in_codes: string[];
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

function parseOfferedIn(codes: string[]): TermSeason[] {
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

function parseNcatSearchCourse(row: NcatSearchCourse): CourseSeed {
  const { subject, number } = parseCourseCode(row.course_code);
  const title = row.course_name.trim();

  return {
    subject,
    number,
    title,
    credits: row.total_credits,
    description: row.description.trim() || undefined,
    isLab: isLabCourse(title),
    offeredIn: parseOfferedIn(row.offered_in_codes ?? []),
  };
}

function extractCourseRefs(text: string): CourseRef[] {
  const refs: CourseRef[] = [];
  for (const match of text.matchAll(COURSE_TOKEN)) {
    refs.push({ subject: match[1], number: match[2] });
  }
  return refs;
}

/** Only seed AND / single-course lists. Skip OR alternatives and standing requirements. */
function parseAndPrerequisiteRefs(text: string): CourseRef[] | null {
  const cleaned = text.trim().replace(/\.$/, "");
  if (!cleaned) {
    return null;
  }
  if (/\bor\b/i.test(cleaned)) {
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

const catalogRows = (ncatCstSearchCourses as NcatSearchCourse[]).filter(
  (row) => row.course_code.trim().startsWith("CST "),
);

export const cstCatalogCourses: CourseSeed[] = catalogRows.map(parseNcatSearchCourse);

/** CST ≥ 200 from the catalog (candidates for SUBJECT_ELECTIVE technical electives). */
export const cstTechnicalElectiveCandidates = cstCatalogCourses.filter(
  (course) => Number.parseInt(course.number, 10) >= 200,
);

export const cstCatalogRelations: CourseRelationSeed[] = catalogRows.flatMap(
  (row) => {
    const course = parseCourseCode(row.course_code);
    const relations: CourseRelationSeed[] = [];

    if (row.corequisites) {
      for (const requires of parseCorequisiteRefs(row.corequisites) ?? []) {
        relations.push({ course, requires, isConcurrent: true });
        relations.push({ course: requires, requires: course, isConcurrent: true });
      }
    }

    if (row.prerequisites) {
      for (const requires of parseAndPrerequisiteRefs(row.prerequisites) ?? []) {
        relations.push({ course, requires, isConcurrent: false });
      }
    }

    return relations;
  },
);

export function mergeCstCatalogCourses(existing: CourseSeed[]): CourseSeed[] {
  const byKey = new Map(existing.map((course) => [courseKey(course), course]));

  for (const course of cstCatalogCourses) {
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
      offeredIn: course.offeredIn ?? prior.offeredIn,
    });
  }

  return [...byKey.values()];
}

export function mergeCstCatalogConcurrentPairs(
  existing: [CourseRef, CourseRef][],
): [CourseRef, CourseRef][] {
  const seen = new Set(
    existing.map(([a, b]) => [courseKey(a), courseKey(b)].sort().join("|")),
  );
  const pairs = [...existing];

  for (const relation of cstCatalogRelations) {
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
