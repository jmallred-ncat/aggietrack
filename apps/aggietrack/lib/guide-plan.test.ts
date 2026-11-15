import assert from "node:assert/strict";
import { test } from "node:test";
import { catalogCorequisiteEdge, catalogCorequisiteEdges } from "../prisma/seed/catalog-corequisites";
import {
  concurrentPairs as handbookPairs,
  courseKey,
  courses as handbookCourses,
  type CourseRef,
} from "../prisma/seed/courses";
import { cstCatalogGroups, mergeCstCatalogConcurrentPairs, mergeCstCatalogCourses } from "../prisma/seed/cst-catalog";
import type { CurriculumSeed } from "../prisma/seed/curriculum";
import { elet2025 } from "../prisma/seed/elet-2025";
import { gecCatalogGroups, mergeGecConcurrentPairs, mergeGecCourses } from "../prisma/seed/gec";
import { guideSeason, withGuideOfferings } from "../prisma/seed/guide-offerings";
import { info2025 } from "../prisma/seed/info-2025";
import { mergeMgmtConcurrentPairs, mergeMgmtCourses, mgmtCatalogGroups } from "../prisma/seed/mgmt";
import type { PrerequisiteGroupSeed } from "../prisma/seed/prerequisite-text";
import { TermSeason } from "./generated/prisma/client";
import { selectPlannableCourses, type PlannableCourse } from "./plannable-courses";
import { planRuleViolations, type RuleCourse } from "./plan-rules";
import { coursePrerequisitesNeedAdvisorReview, placementAlternativeSatisfies } from "./prerequisites";

const courses = withGuideOfferings(
  mergeCstCatalogCourses(mergeMgmtCourses(mergeGecCourses(handbookCourses))),
  [info2025, elet2025],
);
const pairs = mergeMgmtConcurrentPairs(
  mergeCstCatalogConcurrentPairs(mergeGecConcurrentPairs(handbookPairs)),
);
const seeds: PrerequisiteGroupSeed[] = [...cstCatalogGroups, ...gecCatalogGroups, ...mgmtCatalogGroups];
const edges = catalogCorequisiteEdges(seeds);

type StoredGroup = {
  isConcurrent: boolean;
  fromCatalog: boolean;
  optionIds: string[];
  note: string | null;
};

const byKey = new Map(courses.map((course) => [courseKey(course), course]));
const stored = new Map<string, StoredGroup[]>();

function addGroup(course: CourseRef, group: StoredGroup) {
  const id = courseKey(course);
  if (!byKey.has(id)) return;
  const list = stored.get(id) ?? [];
  const signature = `${group.isConcurrent}|${group.fromCatalog}|${[...group.optionIds].sort().join(",")}|${group.note ?? ""}`;
  if (list.some((item) => `${item.isConcurrent}|${item.fromCatalog}|${[...item.optionIds].sort().join(",")}|${item.note ?? ""}` === signature)) {
    return;
  }
  if (group.optionIds.length === 0 && !group.note) return;
  list.push(group);
  stored.set(id, list);
}

for (const [lecture, lab] of pairs) {
  if (!byKey.has(courseKey(lecture)) || !byKey.has(courseKey(lab))) continue;
  addGroup(lecture, {
    isConcurrent: true,
    fromCatalog: edges.has(catalogCorequisiteEdge(lecture, lab)),
    optionIds: [courseKey(lab)],
    note: null,
  });
  addGroup(lab, {
    isConcurrent: true,
    fromCatalog: edges.has(catalogCorequisiteEdge(lab, lecture)),
    optionIds: [courseKey(lecture)],
    note: null,
  });
}

for (const group of seeds) {
  if (group.isConcurrent && group.options.length === 1) continue;
  const optionIds = group.options.flatMap((option) => byKey.has(courseKey(option)) ? [courseKey(option)] : []);
  addGroup(group.course, {
    isConcurrent: group.isConcurrent,
    fromCatalog: group.isConcurrent,
    optionIds,
    note: group.note,
  });
}

function plannable(id: string): PlannableCourse {
  const course = byKey.get(id);
  assert.ok(course, `${id} is not in the catalog`);
  const groups = stored.get(id) ?? [];
  return {
    id,
    subject: course.subject,
    number: course.number,
    title: course.title,
    credits: course.credits,
    offeredIn: course.offeredIn ?? [],
    prerequisiteGroups: groups.map((group) => ({
      isConcurrent: group.isConcurrent,
      fromCatalog: group.fromCatalog,
      optionIds: group.optionIds,
      note: group.note,
    })),
    prerequisitesNeedAdvisorReview: coursePrerequisitesNeedAdvisorReview(groups.map((group) => ({
      isConcurrent: group.isConcurrent,
      optionCount: group.optionIds.length,
      note: group.note,
    }))),
  };
}

const catalog = [...byKey.keys()].map((id) => plannable(id));

function rule(id: string): RuleCourse {
  const course = plannable(id);
  return {
    id,
    code: `${course.subject} ${course.number}`,
    isLab: byKey.get(id)?.isLab === true,
    offeredIn: course.offeredIn,
    groups: (stored.get(id) ?? []).map((group) => ({
      isConcurrent: group.isConcurrent,
      fromCatalog: group.fromCatalog,
      note: group.note,
      options: group.optionIds.map((optionId) => ({
        id: optionId,
        code: optionId.replace("-", " "),
        isLab: byKey.get(optionId)?.isLab === true,
      })),
    })),
    prerequisitesNeedAdvisorReview: course.prerequisitesNeedAdvisorReview,
  };
}

const programs: Array<{ name: string; curriculum: CurriculumSeed }> = [
  { name: "Information Technology", curriculum: info2025 },
  { name: "Electronics Technology", curriculum: elet2025 },
];

test("a placement score satisfies the prerequisite it is offered with", () => {
  const math110 = seeds.find((group) => group.course.subject === "MATH" && group.course.number === "110" && !group.isConcurrent);
  assert.ok(math110);
  assert.equal(placementAlternativeSatisfies(math110.note), true);
  assert.equal(placementAlternativeSatisfies("CST 346 or consent of instructor."), false);
});

test("every named guide course can be planned in the semester the guide assigns", () => {
  for (const program of programs) {
    const completed = new Set<string>();
    for (const term of program.curriculum.recommended) {
      const season = guideSeason(term.sequence);
      const selected = new Set(selectPlannableCourses(catalog, season, completed, new Set(), new Set(), new Set()).map((course) => course.id));
      const ids = term.courses.map((course) => courseKey(course));
      for (const id of ids) {
        assert.equal(selected.has(id), true, `${program.name} semester ${term.sequence} leaves out ${id.replace("-", " ")}`);
      }
      const violations = planRuleViolations({
        courses: ids.map((id) => rule(id)),
        season,
        termLabel: `${season === TermSeason.FALL ? "Fall" : "Spring"} term`,
        satisfiedCourseIds: completed,
        completedCourseIds: completed,
        sameTermCourseIds: new Set(ids),
      });
      assert.deepEqual(violations, [], `${program.name} semester ${term.sequence}: ${violations.join(" ")}`);
      for (const id of ids) completed.add(id);
    }
  }
});

test("a new Information Technology student can plan MATH 110 in fall and in spring", () => {
  const math = courseKey({ subject: "MATH", number: "110" });
  for (const season of [TermSeason.FALL, TermSeason.SPRING]) {
    const selected = selectPlannableCourses(catalog, season, new Set(), new Set(), new Set(), new Set());
    assert.equal(selected.some((course) => course.id === math), true, `MATH 110 is missing in ${season}`);
  }
  const first = info2025.recommended[0]?.courses.map((course) => courseKey(course)) ?? [];
  const fall = new Set(selectPlannableCourses(catalog, TermSeason.FALL, new Set(), new Set(), new Set(), new Set()).map((course) => course.id));
  for (const id of first) {
    assert.equal(fall.has(id), true, `${id.replace("-", " ")} is missing from the first semester`);
  }
});

test("a guide course stays out of a season the guide and the catalog both omit", () => {
  const web = courseKey({ subject: "CST", number: "231" });
  const completed = new Set(
    info2025.recommended
      .filter((term) => term.sequence <= 2)
      .flatMap((term) => term.courses.map((course) => courseKey(course))),
  );
  const spring = selectPlannableCourses(catalog, TermSeason.SPRING, completed, new Set(), new Set(), new Set());
  assert.equal(spring.some((course) => course.id === web), false);
  const fall = selectPlannableCourses(catalog, TermSeason.FALL, completed, new Set(), new Set(), new Set());
  assert.equal(fall.some((course) => course.id === web), true);
});
