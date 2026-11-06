import assert from "node:assert/strict";
import { test } from "node:test";
import { aggietrackRequest, assignedToSarah, faultChoice, faultRequest, jordanPlanReset, nextSaveFails, nextSaveWaits, nextSaveWorks, notAssignedToTestStudent, plannerFaultMap, resetAfterUse, testAdvisorCards, testStudentByEmail, testStudentCards } from "./test-students";

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
  assert.match(jordanPlanReset, /Reset Jordan Hale puts his Spring 2027 plan back to Waiting for review/);
  assert.equal(testStudentByEmail("it.late@example.test")?.name, "Riley Brooks");
  assert.equal(testStudentByEmail("someone@example.test"), null);
});

test("advisor cards name Sarah's students and leave Michael unassigned", () => {
  assert.equal(testAdvisorCards.find(card => card.email === "advisor.1@example.test")?.assignment, assignedToSarah);
  assert.equal(assignedToSarah, "Assigned to Avery, Jordan, Riley");
  assert.equal(testAdvisorCards.find(card => card.email === "advisor.2@example.test")?.assignment, notAssignedToTestStudent);
  assert.equal(notAssignedToTestStudent, "Not assigned to any test student");
});

test("the next-save choices map to one planner write", () => {
  assert.equal(faultChoice(null), nextSaveWorks);
  assert.equal(faultChoice("fail"), nextSaveFails);
  assert.equal(faultChoice("delay:16"), nextSaveWaits);
  assert.deepEqual(faultRequest(nextSaveFails), { fault: "fail" });
  assert.deepEqual(faultRequest(nextSaveWaits), { fault: "delay", seconds: 16 });
  assert.deepEqual(faultRequest(nextSaveWorks), { fault: "off" });
  assert.deepEqual(plannerFaultMap({ faults: { "it.start@example.test": "fail" } }), { "it.start@example.test": "fail" });
});

test("a failed or delayed save calls AggieTrack with that student's email", async () => {
  const request = aggietrackRequest("/api/test-students/write-fault", { origin: "http://127.0.0.1:3000", secret: "shared-secret" }, "it.start@example.test", faultRequest(nextSaveWaits) ?? {});
  assert.equal(request.url, "http://127.0.0.1:3000/api/test-students/write-fault");
  assert.deepEqual(await request.json(), { email: "it.start@example.test", fault: "delay", seconds: 16 });
});

test("reset calls AggieTrack with the secret and only the student email", async () => {
  const request = aggietrackRequest("/api/test-students/reset", { origin: "http://127.0.0.1:3000", secret: "shared-secret" }, "it.mid@example.test");
  assert.equal(request.url, "http://127.0.0.1:3000/api/test-students/reset");
  assert.equal(request.headers.get("authorization"), "Bearer shared-secret");
  assert.deepEqual(await request.json(), { email: "it.mid@example.test" });
});
