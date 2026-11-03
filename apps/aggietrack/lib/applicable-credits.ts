import { GenEdTag, Grade, RequirementSlot } from "./generated/prisma/client";

/**
 * Grade ordering for minimum grade comparisons.
 * Higher index = better grade. Pass and transfer are treated as C.
 */
const GRADE_ORDER: Record<Grade, number> = {
  [Grade.F]: 0,
  [Grade.D]: 1,
  [Grade.D_PLUS]: 2,
  [Grade.C_MINUS]: 3,
  [Grade.C]: 4,
  [Grade.C_PLUS]: 5,
  [Grade.B_MINUS]: 6,
  [Grade.B]: 7,
  [Grade.B_PLUS]: 8,
  [Grade.A_MINUS]: 9,
  [Grade.A]: 10,
  [Grade.P]: 4,
  [Grade.TR]: 4,
  [Grade.W]: 0,
  [Grade.I]: 0,
};

const NON_CREDIT_GRADES = new Set<Grade>([Grade.F, Grade.W, Grade.I]);

/**
 * A grade earns degree credit when it is a recorded result other than F, W, or I.
 * A null minimum still does not make a failure, withdrawal, or incomplete count.
 */
export function earnsDegreeCredit(grade: Grade | null): boolean {
  return grade != null && !NON_CREDIT_GRADES.has(grade);
}

/**
 * Check if a grade meets the minimum requirement.
 * Returns true if actualGrade >= minGrade, or if minGrade is null (no requirement).
 * Callers that award credit must also reject F, W, and I via earnsDegreeCredit.
 */
export function meetsMinimumGrade(actualGrade: Grade | null, minGrade: Grade | null): boolean {
  if (!minGrade) return true;
  if (!actualGrade) return false;
  return GRADE_ORDER[actualGrade] >= GRADE_ORDER[minGrade];
}

export type ApplicableCourse = {
  id: string;
  subject: string;
  number: string;
  tags: readonly GenEdTag[];
};

export type ApplicableGroup = {
  id: string;
  slot: RequirementSlot;
  minCredits: number;
  minGrade: Grade | null;
  subject: string | null;
  minNumber: number | null;
  genEdCategory: GenEdTag | null;
  requiredGenEdTag: GenEdTag | null;
  courseIds: readonly string[];
  sortOrder: number;
};

export type ApplicableAttempt = {
  courseId: string | null;
  subject: string | null;
  number: string | null;
  credits: number;
  grade: Grade | null;
  status: "COMPLETED" | "IN_PROGRESS" | "WITHDRAWN" | "FAILED";
  /** Requirement group of the handbook slot this attempt fills. Null for a named course. */
  groupId: string | null;
  requiresLab: boolean;
  /** Lower values fill a capped group first. */
  order: number;
};

export type ApplicableCredits = {
  percentage: number;
  earnedCredits: number;
  totalCredits: number;
  mappedCourses: number;
};

function courseKey(attempt: Pick<ApplicableAttempt, "courseId" | "subject" | "number">) {
  if (attempt.courseId) return `id:${attempt.courseId}`;
  if (attempt.subject && attempt.number) return `code:${attempt.subject} ${attempt.number}`;
  return null;
}

function meetsMinNumber(number: string, minNumber: number | null) {
  if (minNumber == null) return true;
  const value = Number.parseInt(number, 10);
  return Number.isFinite(value) && value >= minNumber;
}

function courseFitsGroup(
  course: ApplicableCourse,
  group: ApplicableGroup,
  requiresLab: boolean,
  explicitlyRequired: ReadonlySet<string>,
) {
  switch (group.slot) {
    case RequirementSlot.PROGRAM_CORE:
    case RequirementSlot.SUPPORTING_REQUIRED:
      return group.courseIds.includes(course.id);
    case RequirementSlot.GEN_ED_POOL: {
      if (!group.genEdCategory || !course.tags.includes(group.genEdCategory)) return false;
      if (requiresLab) {
        const labTag = group.requiredGenEdTag ?? GenEdTag.SCIENTIFIC_REASONING_LAB;
        if (!course.tags.includes(labTag)) return false;
      }
      return true;
    }
    case RequirementSlot.RELATED_POOL:
      if (group.courseIds.length > 0) return group.courseIds.includes(course.id);
      if (!group.subject || course.subject !== group.subject) return false;
      if (explicitlyRequired.has(course.id)) return false;
      return meetsMinNumber(course.number, group.minNumber);
    case RequirementSlot.TECHNICAL_ELECTIVE:
      if (!group.subject || course.subject !== group.subject) return false;
      if (explicitlyRequired.has(course.id)) return false;
      return meetsMinNumber(course.number, group.minNumber);
    case RequirementSlot.FREE_ELECTIVE:
      if (explicitlyRequired.has(course.id)) return false;
      return meetsMinNumber(course.number, group.minNumber);
    default:
      return false;
  }
}

/**
 * Credits that apply to the degree.
 *
 * A completed course counts once, toward one requirement:
 * - a named program or supporting course counts toward that requirement
 * - a course placed in a handbook slot counts toward that slot's pool
 *   (gen-ed, technical elective, management elective, or free elective)
 * - anything else is unmapped and does not count
 *
 * F, W, and I never count. A grade below the group's minimum does not count.
 * Retakes use the best attempt that still meets the minimum.
 * Each group stops at its required credits, and the percentage stops at 100.
 */
export function applicableCredits(input: {
  groups: readonly ApplicableGroup[];
  courses: readonly ApplicableCourse[];
  attempts: readonly ApplicableAttempt[];
  totalCredits: number;
}): ApplicableCredits {
  const groupsById = new Map(input.groups.map(group => [group.id, group]));
  const coursesById = new Map(input.courses.map(course => [course.id, course]));
  const requiredByCourse = new Map<string, ApplicableGroup>();

  for (const group of [...input.groups].sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (group.slot !== RequirementSlot.PROGRAM_CORE && group.slot !== RequirementSlot.SUPPORTING_REQUIRED) {
      continue;
    }
    for (const courseId of group.courseIds) {
      if (!requiredByCourse.has(courseId)) requiredByCourse.set(courseId, group);
    }
  }
  const explicitlyRequired = new Set(requiredByCourse.keys());

  const attemptsByCourse = new Map<string, ApplicableAttempt[]>();
  for (const attempt of input.attempts) {
    const key = courseKey(attempt);
    if (!key) continue;
    const existing = attemptsByCourse.get(key) ?? [];
    existing.push(attempt);
    attemptsByCourse.set(key, existing);
  }

  const contributions: Array<{ groupId: string; credits: number; order: number; courseKey: string }> = [];

  for (const [key, attempts] of attemptsByCourse) {
    const completed = attempts.filter(attempt => attempt.status === "COMPLETED");
    if (completed.length === 0) continue;

    const sample = completed.find(attempt => attempt.courseId) ?? completed[0]!;
    const courseId = sample.courseId;
    const requiredGroup = courseId ? requiredByCourse.get(courseId) : undefined;
    const slotAttempt = completed.find(attempt => attempt.groupId && groupsById.has(attempt.groupId));
    const slotGroup = slotAttempt?.groupId ? groupsById.get(slotAttempt.groupId) : undefined;

    let group: ApplicableGroup | undefined;
    if (requiredGroup) {
      group = requiredGroup;
    } else if (slotGroup && slotAttempt) {
      const course = courseId ? coursesById.get(courseId) : undefined;
      const described: ApplicableCourse | null = course ?? (
        sample.subject && sample.number
          ? { id: courseId ?? "", subject: sample.subject, number: sample.number, tags: [] }
          : null
      );
      if (described && courseFitsGroup(described, slotGroup, slotAttempt.requiresLab, explicitlyRequired)) {
        group = slotGroup;
      }
    }
    if (!group) continue;

    let best: ApplicableAttempt | null = null;
    let bestOrder = -1;
    for (const attempt of completed) {
      if (!earnsDegreeCredit(attempt.grade) || !meetsMinimumGrade(attempt.grade, group.minGrade)) continue;
      const rank = GRADE_ORDER[attempt.grade!];
      if (rank > bestOrder) {
        bestOrder = rank;
        best = attempt;
      }
    }
    if (!best) continue;
    contributions.push({
      groupId: group.id,
      credits: best.credits,
      order: best.order,
      courseKey: key,
    });
  }

  const byGroup = new Map<string, typeof contributions>();
  for (const contribution of contributions) {
    const existing = byGroup.get(contribution.groupId) ?? [];
    existing.push(contribution);
    byGroup.set(contribution.groupId, existing);
  }

  let earnedCredits = 0;
  const mapped = new Set<string>();
  for (const [groupId, rows] of byGroup) {
    const group = groupsById.get(groupId);
    if (!group) continue;
    let used = 0;
    for (const row of [...rows].sort((a, b) => a.order - b.order || a.courseKey.localeCompare(b.courseKey))) {
      const room = group.minCredits - used;
      if (room <= 0) break;
      const applied = Math.min(room, row.credits);
      if (applied <= 0) continue;
      used += applied;
      earnedCredits += applied;
      mapped.add(row.courseKey);
    }
  }

  const totalCredits = input.totalCredits;
  const percentage = totalCredits > 0
    ? Math.round(Math.min(100, Math.max(0, (earnedCredits / totalCredits) * 100)) * 10) / 10
    : 0;

  return {
    percentage,
    earnedCredits,
    totalCredits,
    mappedCourses: mapped.size,
  };
}
