import assert from "node:assert/strict";
import { test } from "node:test";
import { GenEdTag, RequirementSlot, StudentStanding } from "./generated/prisma/client";
import { courseKey } from "../prisma/seed/courses";
import { info2025 } from "../prisma/seed/info-2025";
import { gecAttributes, gecCourses } from "../prisma/seed/gec";
import { authorizeTestStudents, frozenCourses, stateAfterReset, testStudentByEmail, testStudents } from "./test-students";

const secret = "test-student-secret";
const password = "test-student-password";

function tags(subject: string, number: string) {
  return gecAttributes.filter(item => item.course.subject === subject && item.course.number === number).map(item => item.tag);
}

function listedCourses() {
  return new Set(info2025.groups.flatMap(group => group.courses ?? []).map(courseKey));
}

test("the three students are Information Technology at the start, the middle, and near the end", () => {
  assert.deepEqual(testStudents.map(student => [student.email, student.standing, student.through]), [
    ["it.start@example.test", StudentStanding.FRESHMAN, 0],
    ["it.mid@example.test", StudentStanding.JUNIOR, 4],
    ["it.late@example.test", StudentStanding.SENIOR, 6],
  ]);
  assert.equal(testStudentByEmail(" IT.Mid@example.test ")?.email, "it.mid@example.test");
  assert.equal(testStudentByEmail("someone@example.test"), null);
});

test("frozen courses stay inside the handbook terms and match each slot", () => {
  const listed = listedCourses();
  const start = testStudents[0]!;
  const mid = testStudents[1]!;
  const late = testStudents[2]!;
  assert.deepEqual(frozenCourses(start), []);

  for (const student of [mid, late]) {
    const rows = frozenCourses(student);
    const codes = rows.map(course => courseKey(course));
    assert.equal(new Set(codes).size, codes.length);
    assert.ok(rows.every(course => course.sequence <= student.through));
    for (const course of rows) {
      if (!course.slot) {
        const term = info2025.recommended.find(item => item.sequence === course.sequence);
        assert.ok(term?.courses.some(item => courseKey(item) === courseKey(course)));
        continue;
      }
      const group = info2025.groups.find(item => item.name === course.slot);
      assert.ok(group, course.slot);
      const courseTags = tags(course.subject, course.number);
      if (group.genEdCategory) assert.ok(courseTags.includes(group.genEdCategory));
      if (course.requiresLab) assert.ok(courseTags.includes(GenEdTag.SCIENTIFIC_REASONING_LAB));
      if (!course.requiresLab && group.genEdCategory === GenEdTag.SCIENTIFIC_REASONING) {
        assert.equal(courseTags.includes(GenEdTag.SCIENTIFIC_REASONING_LAB), false);
      }
      if (group.slot === RequirementSlot.TECHNICAL_ELECTIVE) {
        assert.equal(course.subject, group.subject);
        assert.equal(listed.has(courseKey(course)), false);
      }
      const seeded = gecCourses.find(item => courseKey(item) === courseKey(course));
      if (group.genEdCategory) assert.ok(seeded);
    }
  }

  const midCodes = new Set(frozenCourses(mid).map(courseKey));
  assert.equal(midCodes.has(courseKey({ subject: "CST", number: "285" })), true);
  assert.equal(midCodes.has(courseKey({ subject: "CST", number: "325" })), false);
  const lateCodes = new Set(frozenCourses(late).map(courseKey));
  assert.equal(lateCodes.has(courseKey({ subject: "CST", number: "430" })), true);
  assert.equal(lateCodes.has(courseKey({ subject: "CST", number: "355" })), true);
  assert.equal(lateCodes.has(courseKey({ subject: "CST", number: "499" })), false);
});

test("reset drops planned courses and returns only the frozen transcript", () => {
  const mid = testStudents[1]!;
  const next = stateAfterReset(mid);
  assert.deepEqual(next.planned, []);
  assert.deepEqual(next.transcript, frozenCourses(mid));
  assert.equal(next.transcript.some(course => course.subject === "CST" && course.number === "130" && course.sequence > mid.through), false);
  assert.equal(next.transcript.some(course => course.subject === "CST" && course.number === "499"), false);
});

function refused(access: ReturnType<typeof authorizeTestStudents>, status: number) {
  assert.equal(access.ok, false);
  if (!access.ok) assert.equal(access.status, status);
}

test("the route refuses production, a wrong secret, and an unknown email", () => {
  refused(authorizeTestStudents({ vercelEnv: "production", password, expectedSecret: secret, providedSecret: secret }), 403);
  refused(authorizeTestStudents({ vercelEnv: "preview", password, expectedSecret: secret, providedSecret: "other-secret" }), 401);
  refused(authorizeTestStudents({ vercelEnv: "preview", password: undefined, expectedSecret: secret, providedSecret: secret }), 403);
  refused(authorizeTestStudents({ vercelEnv: "preview", password, expectedSecret: secret, providedSecret: secret, email: "student@example.test", requireEmail: true }), 400);
  assert.equal(authorizeTestStudents({ vercelEnv: "preview", password, expectedSecret: secret, providedSecret: secret, email: "it.late@example.test", requireEmail: true }).ok, true);
});
