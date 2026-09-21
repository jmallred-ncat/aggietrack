import { TermSeason } from "../../lib/generated/prisma/client";
import { type CourseRef, type CourseSeed, courseKey } from "./courses";
import ncatCstSearchCourses from "./ncat_cst_search_courses_detailed.json";
import { type PrerequisiteGroupSeed, prerequisiteGroupsFor } from "./prerequisite-text";

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
 * Maps onto PrerequisiteGroup (when option courses exist in the seed):
 *   corequisites      → one concurrent group; a single option is also a concurrent pair
 *   prerequisites     → AND across groups, OR inside a group
 *                       (scores, standing, consent, and "or higher" stay on the group note)
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

const COURSE_CODE = /^([A-Z]{2,8})\s+(\d{3}[A-Z]?)$/;

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

const catalogRows = (ncatCstSearchCourses as NcatSearchCourse[]).filter(
  (row) => row.course_code.trim().startsWith("CST "),
);

export const cstCatalogCourses: CourseSeed[] = catalogRows.map(parseNcatSearchCourse);

/** CST ≥ 200 from the catalog (candidates for SUBJECT_ELECTIVE technical electives). */
export const cstTechnicalElectiveCandidates = cstCatalogCourses.filter(
  (course) => Number.parseInt(course.number, 10) >= 200,
);

export const cstCatalogGroups: PrerequisiteGroupSeed[] = catalogRows.flatMap(
  (row) => {
    const course = parseCourseCode(row.course_code);
    return [
      ...prerequisiteGroupsFor(course, row.corequisites, true),
      ...prerequisiteGroupsFor(course, row.prerequisites, false),
    ];
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

  for (const group of cstCatalogGroups) {
    if (!group.isConcurrent || group.options.length !== 1) {
      continue;
    }
    const key = [courseKey(group.course), courseKey(group.options[0])]
      .sort()
      .join("|");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    pairs.push([group.course, group.options[0]]);
  }

  return pairs;
}
