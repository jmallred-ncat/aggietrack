import { StudentStanding } from "./generated/prisma/client";
import { timingSafeEqual } from "node:crypto";
import { info2025 } from "../prisma/seed/info-2025";
import type { PlaceholderSeed } from "../prisma/seed/curriculum";

export type TestStudent = {
  email: string;
  firstName: string;
  lastName: string;
  standing: StudentStanding;
  /** Handbook terms that are already complete. Zero means the student has no prior coursework. */
  through: number;
};

export type FrozenCourse = {
  subject: string;
  number: string;
  sequence: number;
  slot: string | null;
  requiresLab: boolean;
};

const fillers: Record<string, { subject: string; number: string }> = {
  "1|Global Awareness|false": { subject: "HIST", number: "207" },
  "3|Social/Behavioral Sciences|false": { subject: "PSYC", number: "101" },
  "3|Scientific Reasoning|true": { subject: "BIOL", number: "100" },
  "4|Scientific Reasoning|false": { subject: "ASME", number: "234" },
  "4|African American Studies|false": { subject: "LIBS", number: "202" },
  "5|Technical Electives|false": { subject: "CST", number: "250" },
  "6|Technical Electives|false": { subject: "CST", number: "355" },
};

export const testStudents: TestStudent[] = [
  { email: "it.start@example.test", firstName: "Avery", lastName: "Cole", standing: StudentStanding.FRESHMAN, through: 0 },
  { email: "it.mid@example.test", firstName: "Jordan", lastName: "Hale", standing: StudentStanding.JUNIOR, through: 4 },
  { email: "it.late@example.test", firstName: "Riley", lastName: "Brooks", standing: StudentStanding.SENIOR, through: 6 },
];

export function testStudentByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  return testStudents.find(student => student.email === normalized) ?? null;
}

function slotKey(sequence: number, group: string, requiresLab: boolean) {
  return `${sequence}|${group}|${requiresLab}`;
}

function placeholderOf(value: string | PlaceholderSeed): PlaceholderSeed {
  return typeof value === "string" ? { group: value } : value;
}

/** Named handbook courses, plus one eligible course for each open slot, through the frozen term. */
export function frozenCourses(student: TestStudent): FrozenCourse[] {
  const rows: FrozenCourse[] = [];
  for (const term of info2025.recommended) {
    if (term.sequence > student.through) continue;
    for (const course of term.courses) {
      rows.push({ subject: course.subject, number: course.number, sequence: term.sequence, slot: null, requiresLab: false });
    }
    for (const value of term.placeholders ?? []) {
      const placeholder = placeholderOf(value);
      const requiresLab = placeholder.requiresLab ?? false;
      const filler = fillers[slotKey(term.sequence, placeholder.group, requiresLab)];
      if (!filler) throw new Error(`No frozen course for ${placeholder.group} on term ${term.sequence}.`);
      rows.push({ ...filler, sequence: term.sequence, slot: placeholder.group, requiresLab });
    }
  }
  return rows;
}

/** Reset replaces the transcript with the frozen courses and leaves no registration plan. */
export function stateAfterReset(student: TestStudent) {
  return { transcript: frozenCourses(student), planned: [] as const };
}

export type TestStudentAccess =
  | { ok: true }
  | { ok: false; status: number; error: string };

export function authorizeTestStudents(input: {
  vercelEnv?: string;
  password?: string;
  expectedSecret?: string;
  providedSecret?: string;
  email?: string;
  requireEmail?: boolean;
}): TestStudentAccess {
  if (input.vercelEnv === "production") {
    return { ok: false, status: 403, error: "Test students are not available on the live site." };
  }
  if (!input.password) {
    return { ok: false, status: 403, error: "Set TEST_STUDENT_PASSWORD before using test students." };
  }
  if (input.password.length < 8) {
    return { ok: false, status: 403, error: "TEST_STUDENT_PASSWORD must be at least 8 characters." };
  }
  if (!input.expectedSecret) {
    return { ok: false, status: 403, error: "Set TEST_STUDENT_RESET_SECRET before using test students." };
  }
  const provided = input.providedSecret ?? "";
  const expected = Buffer.from(input.expectedSecret);
  const actual = Buffer.from(provided);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return { ok: false, status: 401, error: "The reset secret does not match." };
  }
  if (input.requireEmail && !testStudentByEmail(input.email ?? "")) {
    return { ok: false, status: 400, error: "That is not a test student." };
  }
  return { ok: true };
}

export function bearerSecret(header: string | null) {
  const match = header?.match(/^Bearer\s+(\S+)\s*$/i);
  return match?.[1] ?? "";
}
