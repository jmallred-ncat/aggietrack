import { TermSeason } from "../../lib/generated/prisma/client";
import { type CourseRef, type CourseSeed, courseKey } from "./courses";
import ncatMgmtCourses from "./ncat_mgmt_courses_detailed.json";
import { type PrerequisiteGroupSeed, prerequisiteGroupsFor } from "./prerequisite-text";

/**
 * NCAT catalog search export for MGMT.
 * Source: prisma/seed/ncat_mgmt_courses_detailed.json
 *
 * MGMT 110 is required for CST (Business Environment), so it is seeded but
 * excluded from the Management Electives pool.
 */
type NcatMgmtCourse = {
  course_code: string;
  course_name: string;
  total_credits: number;
  description: string;
  prerequisites: string | null;
  corequisites: string | null;
  offered_in_codes: string[];
  source_url: string;
  catalog_note?: string;
};

const COURSE_CODE = /^([A-Z]{2,8})\s+(\d{3}[A-Z]?)$/;

const OFFERED_CODE_TO_SEASON: Record<string, TermSeason> = {
  F: TermSeason.FALL,
  S: TermSeason.SPRING,
  SS: TermSeason.SUMMER,
};

function parseCourseCode(code: string): CourseRef {
  const match = code.trim().match(COURSE_CODE);
  if (!match) {
    throw new Error(`Unrecognized MGMT course_code: ${code}`);
  }
  if (match[1] !== "MGMT") {
    throw new Error(`Expected an MGMT course, received ${code}`);
  }
  return { subject: match[1], number: match[2] };
}

function parseOfferedIn(codes: string[]): TermSeason[] {
  const seasons = new Set<TermSeason>();

  for (const rawCode of codes) {
    const code = rawCode.trim().toUpperCase();
    const season = OFFERED_CODE_TO_SEASON[code];
    if (!season) {
      throw new Error(`Unrecognized MGMT offered_in_code: ${rawCode}`);
    }
    seasons.add(season);
  }

  return [...seasons];
}

const catalogRows = (ncatMgmtCourses as NcatMgmtCourse[]).map((row) => {
  const course = parseCourseCode(row.course_code);
  const title = row.course_name.trim();

  if (!title || !Number.isInteger(row.total_credits) || row.total_credits <= 0) {
    throw new Error(`Invalid MGMT catalog row: ${row.course_code}`);
  }

  return {
    row,
    course: {
      ...course,
      title,
      credits: row.total_credits,
      description: row.description.trim() || undefined,
      isLab: false,
      offeredIn: parseOfferedIn(row.offered_in_codes ?? []),
    } satisfies CourseSeed,
  };
});

const courseKeys = new Set<string>();
for (const { course } of catalogRows) {
  const key = courseKey(course);
  if (courseKeys.has(key)) {
    throw new Error(`Duplicate MGMT catalog course: ${key}`);
  }
  courseKeys.add(key);
}

export const mgmtCourses: CourseSeed[] = catalogRows.map(({ course }) => course);

/** MGMT courses eligible for CST Management Electives (excludes required MGMT 110). */
export const mgmtElectives: CourseRef[] = mgmtCourses
  .filter((course) => course.number !== "110")
  .map(({ subject, number }) => ({ subject, number }));

export const mgmtCatalogGroups: PrerequisiteGroupSeed[] = catalogRows.flatMap(
  ({ row, course }) => [
    ...prerequisiteGroupsFor(course, row.corequisites, true),
    ...prerequisiteGroupsFor(course, row.prerequisites, false),
  ],
);

export function mergeMgmtCourses(existing: CourseSeed[]): CourseSeed[] {
  const byKey = new Map(existing.map((course) => [courseKey(course), course]));

  for (const course of mgmtCourses) {
    const key = courseKey(course);
    const prior = byKey.get(key);
    byKey.set(key, prior ? { ...prior, ...course } : course);
  }

  return [...byKey.values()];
}

export function mergeMgmtConcurrentPairs(
  existing: [CourseRef, CourseRef][],
): [CourseRef, CourseRef][] {
  const pairs = [...existing];
  const seen = new Set(
    pairs.map(([a, b]) => [courseKey(a), courseKey(b)].sort().join("|")),
  );

  for (const group of mgmtCatalogGroups) {
    if (!group.isConcurrent || group.options.length !== 1) {
      continue;
    }
    const key = [courseKey(group.course), courseKey(group.options[0])]
      .sort()
      .join("|");
    if (!seen.has(key)) {
      seen.add(key);
      pairs.push([group.course, group.options[0]]);
    }
  }

  return pairs;
}
