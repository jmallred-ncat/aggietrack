import { TermSeason } from "../../lib/generated/prisma/client";
import type { CurriculumSeed } from "./curriculum";
import { courseKey, type CourseSeed } from "./courses";

/** Odd handbook sequences are fall. Even sequences are spring. */
export function guideSeason(sequence: number): TermSeason {
  return sequence % 2 === 1 ? TermSeason.FALL : TermSeason.SPRING;
}

/**
 * The published guide schedules a named course in a semester.
 * That season is an offering, along with the catalog's typically-offered list.
 */
export function withGuideOfferings(
  courses: CourseSeed[],
  curricula: readonly CurriculumSeed[],
): CourseSeed[] {
  const extra = new Map<string, TermSeason[]>();
  for (const curriculum of curricula) {
    for (const term of curriculum.recommended) {
      const season = guideSeason(term.sequence);
      for (const course of term.courses) {
        const key = courseKey(course);
        const seasons = extra.get(key) ?? [];
        if (!seasons.includes(season)) {
          seasons.push(season);
        }
        extra.set(key, seasons);
      }
    }
  }

  return courses.map((course) => {
    const seasons = extra.get(courseKey(course));
    if (!seasons) {
      return course;
    }
    const offeredIn = [...(course.offeredIn ?? [])];
    for (const season of seasons) {
      if (!offeredIn.includes(season)) {
        offeredIn.push(season);
      }
    }
    if (offeredIn.length === (course.offeredIn?.length ?? 0)) {
      return course;
    }
    return { ...course, offeredIn };
  });
}
