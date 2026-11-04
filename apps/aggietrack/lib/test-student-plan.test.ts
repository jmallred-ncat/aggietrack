import assert from "node:assert/strict";
import { test } from "node:test";
import { courseOfferedInSeason } from "./academic-term";
import { plannedAttempts } from "./frozen-transcript";
import { TermSeason, TranscriptStatus } from "./generated/prisma/client";
import { courseKey, type CourseSeed } from "../prisma/seed/courses";
import { cstCatalogCourses, cstCatalogGroups } from "../prisma/seed/cst-catalog";
import { gecCatalogGroups, gecCourses } from "../prisma/seed/gec";
import { info2025 } from "../prisma/seed/info-2025";
import { mgmtCatalogGroups, mgmtCourses } from "../prisma/seed/mgmt";
import {
  assignedAdvisorEmail,
  jordanSubmittedPlan,
  michaelChenEmail,
  nextRegistrationTerm,
  sarahMartinezEmail,
  studentsAssignedToSarah,
  testStudents,
  type FixtureCourse,
} from "./test-students";

const catalog = new Map<string, CourseSeed>();
for (const course of [...cstCatalogCourses, ...gecCourses, ...mgmtCourses]) {
  catalog.set(courseKey(course), course);
}

const groups = [...cstCatalogGroups, ...gecCatalogGroups, ...mgmtCatalogGroups];

const laterHandbook = new Set<string>();
for (const term of info2025.recommended) {
  if (term.sequence <= 4) continue;
  for (const course of term.courses) laterHandbook.add(courseKey(course));
}
laterHandbook.add(courseKey({ subject: "CST", number: "250" }));
laterHandbook.add(courseKey({ subject: "CST", number: "305" }));

const jordan = testStudents.find((student) => student.email === "it.mid@example.test");
assert.ok(jordan);

const attempts = plannedAttempts(jordan);
const satisfied = new Set(
  attempts
    .filter((row) => row.status === TranscriptStatus.COMPLETED || row.status === TranscriptStatus.IN_PROGRESS)
    .map((row) => courseKey(row)),
);
const onTranscript = new Set(attempts.map((row) => courseKey(row)));

function assertValidPlan(courses: FixtureCourse[], season: TermSeason) {
  const onPlan = new Set(courses.map((course) => courseKey(course)));
  assert.equal(onPlan.size, courses.length);
  let credits = 0;
  for (const course of courses) {
    const key = courseKey(course);
    assert.equal(onTranscript.has(key), false, `${key} is already on Jordan Hale's transcript`);
    assert.equal(laterHandbook.has(key), true, `${key} is not a later Information Technology 2025 course`);
    const seeded = catalog.get(key);
    assert.ok(seeded, `${key} is not in the catalog`);
    assert.ok(seeded.offeredIn && seeded.offeredIn.length > 0, `${key} does not say when it is offered`);
    assert.equal(courseOfferedInSeason(seeded.offeredIn, season), true, `${key} is not offered in ${season}`);
    assert.ok(seeded.credits >= 1 && seeded.credits <= 4, `${key} is ${seeded.credits} credits`);
    credits += seeded.credits;

    for (const group of groups.filter((item) => courseKey(item.course) === key)) {
      if (group.options.length === 0) {
        const note = group.note ?? "";
        assert.match(note, /junior|senior|sophomore/i, `${key} has a prerequisite the transcript cannot prove: ${note}`);
        if (/\bsenior\b/i.test(note) && !/junior/i.test(note)) {
          assert.fail(`${key} requires senior standing`);
        }
        continue;
      }
      const options = group.options.map((option) => courseKey(option));
      if (group.isConcurrent) {
        assert.ok(
          options.some((option) => satisfied.has(option) || onPlan.has(option)),
          `${key} is missing its corequisite`,
        );
        continue;
      }
      assert.ok(
        options.some((option) => satisfied.has(option)),
        `${key} still needs ${options.join(" or ")}`,
      );
    }
  }
  assert.ok(credits >= 12 && credits <= 16, `the plan is ${credits} credits`);
}

test("Sarah advises Avery, Jordan, and Riley, and Michael advises nobody", () => {
  assert.deepEqual([...studentsAssignedToSarah], [
    "it.start@example.test",
    "it.mid@example.test",
    "it.late@example.test",
  ]);
  for (const student of testStudents) {
    const advisor = assignedAdvisorEmail(student.email);
    if ((studentsAssignedToSarah as readonly string[]).includes(student.email)) {
      assert.equal(advisor, sarahMartinezEmail);
    } else {
      assert.equal(advisor, null);
    }
  }
  const advisees = (advisorEmail: string) => testStudents.filter((student) => assignedAdvisorEmail(student.email) === advisorEmail);
  assert.equal(advisees(sarahMartinezEmail).length, studentsAssignedToSarah.length);
  assert.equal(advisees(michaelChenEmail).length, 0);
});

test("the next term follows the loaded fall and spring calendar", () => {
  assert.deepEqual(nextRegistrationTerm(new Date("2026-11-04T15:00:00.000Z")), { season: "SPRING", year: 2027 });
  assert.deepEqual(nextRegistrationTerm(new Date("2026-12-20T15:00:00.000Z")), { season: "SPRING", year: 2027 });
  assert.deepEqual(nextRegistrationTerm(new Date("2026-03-15T15:00:00.000Z")), { season: "FALL", year: 2026 });
  assert.deepEqual(nextRegistrationTerm(new Date("2026-05-20T15:00:00.000Z")), { season: "FALL", year: 2026 });
});

test("Jordan's spring plan is a valid junior load that misses his transcript", () => {
  const plan = jordanSubmittedPlan(new Date("2026-11-04T15:00:00.000Z"));
  assert.deepEqual(plan.term, { season: "SPRING", year: 2027 });
  assert.deepEqual(plan.courses, [
    { subject: "MATH", number: "224" },
    { subject: "CST", number: "250" },
    { subject: "CST", number: "315" },
    { subject: "CST", number: "317" },
  ]);
  assertValidPlan(plan.courses, TermSeason.SPRING);
});

test("Jordan's fall plan is a valid junior load that misses his transcript", () => {
  const plan = jordanSubmittedPlan(new Date("2026-03-15T15:00:00.000Z"));
  assert.deepEqual(plan.term, { season: "FALL", year: 2026 });
  assert.deepEqual(plan.courses, [
    { subject: "CST", number: "325" },
    { subject: "CST", number: "329" },
    { subject: "CST", number: "339" },
    { subject: "MATH", number: "224" },
    { subject: "CST", number: "305" },
  ]);
  assertValidPlan(plan.courses, TermSeason.FALL);
});
