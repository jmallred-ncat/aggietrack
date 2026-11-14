import { Grade, TranscriptSource, TranscriptStatus } from "./generated/prisma/client";
import { frozenCourses, type FrozenCourse, type TestStudent } from "./test-students";

export type PlannedAttempt = FrozenCourse & {
  grade: Grade | null;
  status: TranscriptStatus;
  source: TranscriptSource;
  /** On the transcript, but not a handbook requirement or elective slot. */
  outsidePlan: boolean;
  /**
   * A course the student typed into a free-elective slot. It is not a catalog row:
   * the transcript stores the subject, number, title, and credits.
   */
  entered: { title: string; credits: number } | null;
};

function attempt(
  course: FrozenCourse,
  grade: Grade | null,
  status?: TranscriptStatus,
): PlannedAttempt {
  // Determine status from grade if not explicitly provided
  const finalStatus = status ?? (
    grade === Grade.F ? TranscriptStatus.FAILED 
    : grade === Grade.W ? TranscriptStatus.WITHDRAWN 
    : grade === Grade.I ? TranscriptStatus.IN_PROGRESS 
    : TranscriptStatus.COMPLETED
  );
  
  return {
    ...course,
    grade, // Keep the grade visible (including I for in-progress)
    status: finalStatus,
    source: grade === Grade.TR ? TranscriptSource.TRANSFER : TranscriptSource.NCAT,
    outsidePlan: false,
    entered: null,
  };
}

function requireGrade(table: Record<string, Grade>, code: string) {
  const grade = table[code];
  if (!grade) throw new Error(`No frozen grade for ${code}.`);
  return grade;
}

function codeOf(course: FrozenCourse) {
  return `${course.subject} ${course.number}`;
}

/**
 * Jordan Hale, terms 1–3. Term 4 is in progress and is not in this table.
 * Credit-weighted quality points are 163.6 / 48 = 3.41.
 */
const JORDAN: Record<string, Grade> = {
  "CST 120": Grade.B_PLUS,
  "CST 130": Grade.B,
  "ENGL 100": Grade.A,
  "FRST 101": Grade.B,
  "MATH 110": Grade.B_PLUS,
  "HIST 207": Grade.A_MINUS,
  "CST 112": Grade.B,
  "CST 122": Grade.B,
  "CST 140": Grade.A_MINUS,
  "CST 150": Grade.B,
  "ENGL 101": Grade.A_MINUS,
  "MATH 131": Grade.A,
  "CST 231": Grade.B,
  "CST 240": Grade.B,
  "MGMT 110": Grade.B_PLUS,
  "PSYC 101": Grade.A_MINUS,
  "BIOL 100": Grade.B_PLUS,
};

/**
 * Riley Brooks. ENGL 100 and MATH 224 are transfer (6 credits, no quality points).
 * The remaining 86 letter-graded hours are 312.9 quality points, GPA 3.64.
 */
const RILEY: Record<string, Grade> = {
  "CST 120": Grade.A_MINUS,
  "CST 130": Grade.A_MINUS,
  "ENGL 100": Grade.TR,
  "FRST 101": Grade.B_PLUS,
  "MATH 110": Grade.B_PLUS,
  "HIST 207": Grade.B_PLUS,
  "CST 112": Grade.B_PLUS,
  "CST 122": Grade.B_PLUS,
  "CST 140": Grade.B_PLUS,
  "CST 150": Grade.B_PLUS,
  "ENGL 101": Grade.B,
  "MATH 131": Grade.B,
  "CST 231": Grade.B,
  "CST 240": Grade.B,
  "MGMT 110": Grade.A_MINUS,
  "PSYC 101": Grade.A_MINUS,
  "BIOL 100": Grade.A_MINUS,
  "CST 225": Grade.A_MINUS,
  "CST 235": Grade.A_MINUS,
  "CST 285": Grade.A_MINUS,
  "SPCH 250": Grade.A,
  "ASME 234": Grade.A,
  "LIBS 202": Grade.A,
  "CST 325": Grade.A,
  "CST 329": Grade.A,
  "CST 339": Grade.A,
  "MATH 224": Grade.TR,
  "CST 250": Grade.A,
  "CST 300": Grade.A,
  "CST 315": Grade.A,
  "CST 317": Grade.A,
  "CST 430": Grade.A,
  "CST 355": Grade.A,
};

/** Taylor Morgan. CST 112 is appended as F then B. Cumulative 96.7 / 32 = 3.02; adjusted 96.7 / 35 = 2.76. */
const TAYLOR: Record<string, Grade> = {
  "CST 130": Grade.A,
  "ENGL 100": Grade.A_MINUS,
  "FRST 101": Grade.B_PLUS,
  "MATH 110": Grade.B,
  "HIST 207": Grade.B_MINUS,
  "CST 122": Grade.A,
  "CST 140": Grade.A_MINUS,
  "CST 150": Grade.B_PLUS,
  "ENGL 101": Grade.B,
  "MATH 131": Grade.B_MINUS,
  "CST 120": Grade.D,
};

/** Casey Parker. CST 130 is appended as W then A. 115.4 / 32 = 3.61. */
const CASEY: Record<string, Grade> = {
  "CST 120": Grade.A,
  "ENGL 100": Grade.A_MINUS,
  "FRST 101": Grade.B_PLUS,
  "MATH 110": Grade.B,
  "HIST 207": Grade.A,
  "CST 112": Grade.A_MINUS,
  "CST 122": Grade.A_MINUS,
  "CST 140": Grade.B_PLUS,
  "CST 150": Grade.A,
  "ENGL 101": Grade.A_MINUS,
  "MATH 131": Grade.B_PLUS,
};

/**
 * Alex Rivera. P, TR, W, I, and F sit on handbook courses so each row is visible.
 * JOUR 101 is a course he typed into the first free-elective slot (term 7).
 * It is not in the catalog. Its B is 9 quality points.
 * Letter grades are 113.2 quality points / 40 hours = 2.83.
 * Progress is 44: terms 1–3 are 48, minus W 3, I 1, and F 3, plus this 3-credit elective.
 */
const ALEX: Record<string, Grade> = {
  "CST 120": Grade.B_PLUS,
  "CST 130": Grade.W,
  "ENGL 100": Grade.P,
  "FRST 101": Grade.B,
  "MATH 110": Grade.TR,
  "HIST 207": Grade.F,
  "CST 112": Grade.B_MINUS,
  "CST 122": Grade.I,
  "CST 140": Grade.B,
  "CST 150": Grade.B_PLUS,
  "ENGL 101": Grade.B_MINUS,
  "MATH 131": Grade.B,
  "CST 231": Grade.C_PLUS,
  "CST 240": Grade.B,
  "MGMT 110": Grade.B_MINUS,
  "PSYC 101": Grade.A,
  "BIOL 100": Grade.A_MINUS,
};

function fromTable(courses: FrozenCourse[], table: Record<string, Grade>, inProgressFrom?: number) {
  return courses.map(course => {
    const isInProgress = inProgressFrom != null && course.sequence >= inProgressFrom;
    const grade = isInProgress ? null : requireGrade(table, codeOf(course));
    // Pass explicit IN_PROGRESS status for in-progress courses
    // For completed courses, omit status to use automatic mapping (F→FAILED, W→WITHDRAWN, etc.)
    return attempt(course, grade, isInProgress ? TranscriptStatus.IN_PROGRESS : undefined);
  });
}

function withRetake(courses: FrozenCourse[], table: Record<string, Grade>, code: string, first: Grade, second: Grade) {
  const attempts: PlannedAttempt[] = [];
  for (const course of courses) {
    if (codeOf(course) === code) {
      attempts.push(attempt(course, first));
      attempts.push(attempt(course, second));
      continue;
    }
    attempts.push(attempt(course, requireGrade(table, codeOf(course))));
  }
  return attempts;
}

function morganGrade(code: string) {
  if (code === "ENGL 100" || code === "MATH 224") return Grade.TR;
  if (code === "ENGL 101" || code === "ECON 200") return Grade.A_MINUS;
  return Grade.A;
}

/**
 * The transcript a reset writes. Grades are explicit so credits and GPA can be
 * recalculated from catalog hours without replaying a hash.
 */
export function plannedAttempts(student: TestStudent): PlannedAttempt[] {
  const courses = frozenCourses(student);
  switch (student.email) {
    case "it.start@example.test":
      return [];
    case "it.mid@example.test":
      return fromTable(courses, JORDAN, 4);
    case "it.late@example.test":
      return fromTable(courses, RILEY);
    case "it.retake-f-to-pass@example.test":
      return withRetake(courses, TAYLOR, "CST 112", Grade.F, Grade.B);
    case "it.retake-c-to-a@example.test":
      return withRetake(courses, CASEY, "CST 130", Grade.W, Grade.A);
    case "it.diverse-grades@example.test":
      return [
        ...fromTable(courses, ALEX),
        {
          subject: "JOUR",
          number: "101",
          sequence: 7,
          slot: "Free Electives",
          requiresLab: false,
          grade: Grade.B,
          status: TranscriptStatus.COMPLETED,
          source: TranscriptSource.NCAT,
          outsidePlan: false,
          entered: { title: "Introduction to Journalism", credits: 3 },
        },
      ];
    case "it.over-credits@example.test":
      return courses.map(course => attempt(course, morganGrade(codeOf(course))));
    default:
      throw new Error(`No frozen grade plan for ${student.email}.`);
  }
}
