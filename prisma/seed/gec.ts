import { GenEdTag } from "../../lib/generated/prisma/client";
import { type CourseRef, type CourseSeed, courseKey } from "./courses";
import { type AttributeSeed } from "./curriculum";

/**
 * NCAT General Education Course List (revised 11/25/2025).
 * https://www.ncat.edu/provost/general-education-resources/gec-list.php
 *
 * Credits are typical catalog values (GEC page does not list hours).
 * Courses may appear under multiple outcomes; progress must still count
 * each course toward only one gen-ed requirement.
 */

const c = (
  subject: string,
  number: string,
  title: string,
  credits: number,
  isLab = false,
): CourseSeed => ({ subject, number, title, credits, isLab });

/** All GEC courses needed for CST gen-ed pool pickers (WC/HFA/GL/AA/SBS/SR). */
export const gecCourses: CourseSeed[] = [
  // Written Communication
  c("ENGL", "100", "Ideas and their Expressions I", 3),
  c("ENGL", "101", "Ideas and their Expressions II", 3),

  // Scientific Reasoning
  c("BIOL", "100", "Biological Science", 3),
  c("BIOL", "101", "Concepts of Biology I", 3),
  c("BIOL", "102", "Concepts of Biology II", 3),
  c("CHEM", "100", "Physical Science", 3),
  c("CHEM", "104", "General Chemistry IV", 3),
  c("CHEM", "106", "General Chemistry VI", 3),
  c("CHEM", "107", "General Chemistry VII", 3),
  c("CHEM", "110", "Physical Science Lab", 1, true),
  c("CHEM", "114", "General Chemistry IV Lab", 1, true),
  c("CHEM", "116", "General Chemistry VI Lab", 1, true),
  c("CHEM", "117", "General Chemistry VII Lab", 1, true),
  c("ASME", "234", "Weather and Climate Studies", 3),
  c("ENVS", "201", "The Earth's Environment", 3),
  c("PHYS", "101", "Introduction to Astronomy", 3),
  c("PHYS", "104", "Introduction to Cosmology", 3),
  c("PHYS", "105", "Physics for Non-Scientists", 3),
  c("PHYS", "110", "Survey of Physics", 3),
  c("PHYS", "111", "Survey of Physics Lab", 1, true),
  c("PHYS", "214", "Astronomy I", 3),
  c("PHYS", "215", "Astronomy II", 3),
  c("PHYS", "224", "Astronomy I Lab", 1, true),
  c("PHYS", "225", "College Physics I", 3),
  c("PHYS", "226", "College Physics II", 3),
  c("PHYS", "235", "College Physics I Lab", 1, true),
  c("PHYS", "236", "College Physics II Lab", 1, true),
  c("PHYS", "241", "General Physics I", 3),
  c("PHYS", "242", "General Physics II", 3),
  c("PHYS", "251", "General Physics I Lab", 1, true),
  c("PHYS", "252", "General Physics II Lab", 1, true),

  // Global Awareness
  c("HIST", "130", "The Contemporary Global Experience", 3),
  c("HIST", "206", "Pre-Modern World History", 3),
  c("HIST", "207", "Modern World History", 3),
  c("HIST", "216", "African History Since 1800", 3),
  c("HIST", "231", "Genocide", 3),
  c("MGMT", "221", "Global Business Environment", 3),
  c("PHIL", "103", "World Religions", 3),
  c("PHIL", "201", "Business Ethics", 3),

  // Humanities and Fine Arts
  c("ENGL", "200", "Survey of Humanities I", 3),
  c("ENGL", "201", "Survey of Humanities II", 3),
  c("ENGL", "230", "World Literature I", 3),
  c("ENGL", "231", "World Literature II", 3),
  c("ENGL", "211", "Survey of African American Literature I", 3),
  c("ENGL", "212", "Survey of African American Literature II", 3),
  c("LIBS", "202", "Introduction to African American Studies", 3),
  c("MUSI", "216", "Music Appreciation", 3),
  c("MUSI", "220", "History of Black Music in America", 3),
  c("PHIL", "101", "Introduction to Philosophy", 3),
  c("PHIL", "104", "Introduction to Ethics", 3),
  c("PHIL", "266", "Contemporary Moral Problems", 3),
  c("PHIL", "267", "Philosophy of Love and Friendship", 3),
  c("SPCH", "250", "Fundamentals of Speech Communication", 3),
  c("SPCH", "251", "Public Speaking", 3),

  // African American Culture and History
  c("HIST", "103", "NC A&T State University History", 3),
  c("HIST", "106", "African American History to 1877", 3),
  c("HIST", "107", "African American History 1877 to Present", 3),

  // Social and Behavioral Sciences
  c("FIN", "279", "Personal Finance", 3),
  c("ECON", "200", "Introductory Microeconomics", 3),
  c("ECON", "201", "Introductory Macroeconomics", 3),
  c("FCS", "135", "Food and Man's Survival", 3),
  c("FCS", "181", "Social-Psychological Aspects of Dress", 3),
  c("FCS", "260", "Introduction to Human Development", 3),
  c("HIST", "104", "U.S. History from 1492-1877", 3),
  c("HIST", "105", "U.S. History from 1877-Present", 3),
  c("JOMC", "240", "Media History", 3),
  c("POLI", "110", "American Government and Politics", 3),
  c("PSYC", "101", "General Psychology for Non-Majors", 3),
  c("SOCI", "100", "Principles of Sociology", 3),
  c("SOCI", "200", "Introduction to Anthropology", 3),
  c("SSFM", "226", "A Personal Approach to Health", 3),
];

/** Lecture/lab pairs implied by the GEC Scientific Reasoning list. */
export const gecConcurrentPairs: [CourseRef, CourseRef][] = [
  [{ subject: "CHEM", number: "100" }, { subject: "CHEM", number: "110" }],
  [{ subject: "CHEM", number: "104" }, { subject: "CHEM", number: "114" }],
  [{ subject: "CHEM", number: "106" }, { subject: "CHEM", number: "116" }],
  [{ subject: "CHEM", number: "107" }, { subject: "CHEM", number: "117" }],
  [{ subject: "PHYS", number: "110" }, { subject: "PHYS", number: "111" }],
  [{ subject: "PHYS", number: "214" }, { subject: "PHYS", number: "224" }],
  [{ subject: "PHYS", number: "241" }, { subject: "PHYS", number: "251" }],
  [{ subject: "PHYS", number: "242" }, { subject: "PHYS", number: "252" }],
];

type Tagged = { course: CourseRef; tags: GenEdTag[] };

const ref = (subject: string, number: string): CourseRef => ({ subject, number });

/**
 * Eligible outcomes per course. Overlaps are intentional (GEC allows HFA *or* AA,
 * etc.); each course may still only satisfy one requirement at progress time.
 */
const tagged: Tagged[] = [
  // WC
  { course: ref("ENGL", "100"), tags: [GenEdTag.WRITTEN_COMMUNICATION] },
  { course: ref("ENGL", "101"), tags: [GenEdTag.WRITTEN_COMMUNICATION] },

  // SR lecture
  {
    course: ref("BIOL", "100"),
    tags: [GenEdTag.SCIENTIFIC_REASONING],
  },
  {
    course: ref("BIOL", "101"),
    tags: [GenEdTag.SCIENTIFIC_REASONING],
  },
  {
    course: ref("BIOL", "102"),
    tags: [GenEdTag.SCIENTIFIC_REASONING],
  },
  {
    course: ref("CHEM", "100"),
    tags: [GenEdTag.SCIENTIFIC_REASONING],
  },
  {
    course: ref("CHEM", "104"),
    tags: [GenEdTag.SCIENTIFIC_REASONING],
  },
  {
    course: ref("CHEM", "106"),
    tags: [GenEdTag.SCIENTIFIC_REASONING],
  },
  {
    course: ref("CHEM", "107"),
    tags: [GenEdTag.SCIENTIFIC_REASONING],
  },
  {
    course: ref("ASME", "234"),
    tags: [GenEdTag.SCIENTIFIC_REASONING],
  },
  {
    course: ref("ENVS", "201"),
    tags: [GenEdTag.SCIENTIFIC_REASONING],
  },
  {
    course: ref("PHYS", "101"),
    tags: [GenEdTag.SCIENTIFIC_REASONING],
  },
  {
    course: ref("PHYS", "104"),
    tags: [GenEdTag.SCIENTIFIC_REASONING],
  },
  {
    course: ref("PHYS", "105"),
    tags: [GenEdTag.SCIENTIFIC_REASONING],
  },
  {
    course: ref("PHYS", "110"),
    tags: [GenEdTag.SCIENTIFIC_REASONING],
  },
  {
    course: ref("PHYS", "214"),
    tags: [GenEdTag.SCIENTIFIC_REASONING],
  },
  {
    course: ref("PHYS", "215"),
    tags: [GenEdTag.SCIENTIFIC_REASONING],
  },
  {
    course: ref("PHYS", "225"),
    tags: [GenEdTag.SCIENTIFIC_REASONING],
  },
  {
    course: ref("PHYS", "226"),
    tags: [GenEdTag.SCIENTIFIC_REASONING],
  },
  {
    course: ref("PHYS", "241"),
    tags: [GenEdTag.SCIENTIFIC_REASONING],
  },
  {
    course: ref("PHYS", "242"),
    tags: [GenEdTag.SCIENTIFIC_REASONING],
  },

  // SR lab
  {
    course: ref("CHEM", "110"),
    tags: [GenEdTag.SCIENTIFIC_REASONING_LAB],
  },
  {
    course: ref("CHEM", "114"),
    tags: [GenEdTag.SCIENTIFIC_REASONING_LAB],
  },
  {
    course: ref("CHEM", "116"),
    tags: [GenEdTag.SCIENTIFIC_REASONING_LAB],
  },
  {
    course: ref("CHEM", "117"),
    tags: [GenEdTag.SCIENTIFIC_REASONING_LAB],
  },
  {
    course: ref("PHYS", "111"),
    tags: [GenEdTag.SCIENTIFIC_REASONING_LAB],
  },
  {
    course: ref("PHYS", "224"),
    tags: [GenEdTag.SCIENTIFIC_REASONING_LAB],
  },
  {
    course: ref("PHYS", "235"),
    tags: [GenEdTag.SCIENTIFIC_REASONING_LAB],
  },
  {
    course: ref("PHYS", "236"),
    tags: [GenEdTag.SCIENTIFIC_REASONING_LAB],
  },
  {
    course: ref("PHYS", "251"),
    tags: [GenEdTag.SCIENTIFIC_REASONING_LAB],
  },
  {
    course: ref("PHYS", "252"),
    tags: [GenEdTag.SCIENTIFIC_REASONING_LAB],
  },

  // Global Awareness
  { course: ref("HIST", "130"), tags: [GenEdTag.GLOBAL_AWARENESS] },
  {
    course: ref("HIST", "206"),
    tags: [GenEdTag.GLOBAL_AWARENESS, GenEdTag.SOCIAL_BEHAVIORAL],
  },
  {
    course: ref("HIST", "207"),
    tags: [GenEdTag.GLOBAL_AWARENESS, GenEdTag.SOCIAL_BEHAVIORAL],
  },
  {
    course: ref("HIST", "216"),
    tags: [GenEdTag.GLOBAL_AWARENESS, GenEdTag.SOCIAL_BEHAVIORAL],
  },
  {
    course: ref("HIST", "231"),
    tags: [GenEdTag.GLOBAL_AWARENESS, GenEdTag.SOCIAL_BEHAVIORAL],
  },
  { course: ref("MGMT", "221"), tags: [GenEdTag.GLOBAL_AWARENESS] },
  {
    course: ref("PHIL", "103"),
    tags: [GenEdTag.GLOBAL_AWARENESS, GenEdTag.HUMANITIES_FINE_ARTS],
  },
  {
    course: ref("PHIL", "201"),
    tags: [GenEdTag.GLOBAL_AWARENESS, GenEdTag.HUMANITIES_FINE_ARTS],
  },

  // Humanities / Fine Arts
  { course: ref("ENGL", "200"), tags: [GenEdTag.HUMANITIES_FINE_ARTS] },
  { course: ref("ENGL", "201"), tags: [GenEdTag.HUMANITIES_FINE_ARTS] },
  { course: ref("ENGL", "230"), tags: [GenEdTag.HUMANITIES_FINE_ARTS] },
  { course: ref("ENGL", "231"), tags: [GenEdTag.HUMANITIES_FINE_ARTS] },
  {
    course: ref("ENGL", "211"),
    tags: [GenEdTag.HUMANITIES_FINE_ARTS, GenEdTag.AFRICAN_AMERICAN],
  },
  {
    course: ref("ENGL", "212"),
    tags: [GenEdTag.HUMANITIES_FINE_ARTS, GenEdTag.AFRICAN_AMERICAN],
  },
  {
    course: ref("LIBS", "202"),
    tags: [GenEdTag.HUMANITIES_FINE_ARTS, GenEdTag.AFRICAN_AMERICAN],
  },
  { course: ref("MUSI", "216"), tags: [GenEdTag.HUMANITIES_FINE_ARTS] },
  {
    course: ref("MUSI", "220"),
    tags: [GenEdTag.HUMANITIES_FINE_ARTS, GenEdTag.AFRICAN_AMERICAN],
  },
  { course: ref("PHIL", "101"), tags: [GenEdTag.HUMANITIES_FINE_ARTS] },
  { course: ref("PHIL", "104"), tags: [GenEdTag.HUMANITIES_FINE_ARTS] },
  { course: ref("PHIL", "266"), tags: [GenEdTag.HUMANITIES_FINE_ARTS] },
  { course: ref("PHIL", "267"), tags: [GenEdTag.HUMANITIES_FINE_ARTS] },
  { course: ref("SPCH", "250"), tags: [GenEdTag.HUMANITIES_FINE_ARTS] },
  { course: ref("SPCH", "251"), tags: [GenEdTag.HUMANITIES_FINE_ARTS] },

  // African American
  {
    course: ref("HIST", "103"),
    tags: [GenEdTag.AFRICAN_AMERICAN, GenEdTag.SOCIAL_BEHAVIORAL],
  },
  {
    course: ref("HIST", "106"),
    tags: [GenEdTag.AFRICAN_AMERICAN, GenEdTag.SOCIAL_BEHAVIORAL],
  },
  {
    course: ref("HIST", "107"),
    tags: [GenEdTag.AFRICAN_AMERICAN, GenEdTag.SOCIAL_BEHAVIORAL],
  },

  // Social / Behavioral (remaining)
  { course: ref("FIN", "279"), tags: [GenEdTag.SOCIAL_BEHAVIORAL] },
  { course: ref("ECON", "200"), tags: [GenEdTag.SOCIAL_BEHAVIORAL] },
  { course: ref("ECON", "201"), tags: [GenEdTag.SOCIAL_BEHAVIORAL] },
  { course: ref("FCS", "135"), tags: [GenEdTag.SOCIAL_BEHAVIORAL] },
  { course: ref("FCS", "181"), tags: [GenEdTag.SOCIAL_BEHAVIORAL] },
  { course: ref("FCS", "260"), tags: [GenEdTag.SOCIAL_BEHAVIORAL] },
  { course: ref("HIST", "104"), tags: [GenEdTag.SOCIAL_BEHAVIORAL] },
  { course: ref("HIST", "105"), tags: [GenEdTag.SOCIAL_BEHAVIORAL] },
  { course: ref("JOMC", "240"), tags: [GenEdTag.SOCIAL_BEHAVIORAL] },
  { course: ref("POLI", "110"), tags: [GenEdTag.SOCIAL_BEHAVIORAL] },
  { course: ref("PSYC", "101"), tags: [GenEdTag.SOCIAL_BEHAVIORAL] },
  { course: ref("SOCI", "100"), tags: [GenEdTag.SOCIAL_BEHAVIORAL] },
  { course: ref("SOCI", "200"), tags: [GenEdTag.SOCIAL_BEHAVIORAL] },
  { course: ref("SSFM", "226"), tags: [GenEdTag.SOCIAL_BEHAVIORAL] },
];

export const gecAttributes: AttributeSeed[] = tagged.flatMap(({ course, tags }) =>
  tags.map((tag) => ({ course, tag })),
);

/** GEC courses not already present in another seed list. */
export function mergeGecCourses(existing: CourseSeed[]): CourseSeed[] {
  const seen = new Set(existing.map(courseKey));
  const additions = gecCourses.filter((course) => !seen.has(courseKey(course)));
  return [...existing, ...additions];
}

export function mergeGecConcurrentPairs(
  existing: [CourseRef, CourseRef][],
): [CourseRef, CourseRef][] {
  const seen = new Set(
    existing.map(([a, b]) => `${courseKey(a)}|${courseKey(b)}`),
  );
  const additions = gecConcurrentPairs.filter(
    ([a, b]) => !seen.has(`${courseKey(a)}|${courseKey(b)}`),
  );
  return [...existing, ...additions];
}
