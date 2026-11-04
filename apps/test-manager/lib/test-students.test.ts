import assert from "node:assert/strict";
import { test } from "node:test";
import { aggietrackRequest, assignedToSarah, notAssignedToTestStudent, resetAfterUse, testAdvisorCards, testStudentByEmail, testStudentCards } from "./test-students";

test("the testing site shows the Information Technology students and the reset instruction", () => {
  assert.deepEqual(testStudentCards.map(student => student.email), [
    "it.start@example.test",
    "it.mid@example.test",
    "it.late@example.test",
    "it.retake-f-to-pass@example.test",
    "it.retake-c-to-a@example.test",
    "it.diverse-grades@example.test",
    "it.over-credits@example.test",
  ]);
  assert.match(resetAfterUse, /after every use/);
  assert.equal(testStudentByEmail("it.late@example.test")?.name, "Riley Brooks");
  assert.equal(testStudentByEmail("someone@example.test"), null);
});

test("advisor cards name Sarah's students and leave Michael unassigned", () => {
  assert.equal(testAdvisorCards.find(card => card.email === "advisor.1@example.test")?.assignment, assignedToSarah);
  assert.equal(assignedToSarah, "Assigned to Avery, Jordan, Riley");
  assert.equal(testAdvisorCards.find(card => card.email === "advisor.2@example.test")?.assignment, notAssignedToTestStudent);
  assert.equal(notAssignedToTestStudent, "Not assigned to any test student");
});

test("reset calls AggieTrack with the secret and only the student email", async () => {
  const request = aggietrackRequest("/api/test-students/reset", { origin: "http://127.0.0.1:3000", secret: "shared-secret" }, "it.mid@example.test");
  assert.equal(request.url, "http://127.0.0.1:3000/api/test-students/reset");
  assert.equal(request.headers.get("authorization"), "Bearer shared-secret");
  assert.deepEqual(await request.json(), { email: "it.mid@example.test" });
});
