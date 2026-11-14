import assert from "node:assert/strict";
import { test } from "node:test";
import { accountsBusy, aggietrackRequest, assignedToSarah, faultChoice, faultRequest, fixtureConfirmAction, fixtureForward, fixtureLoadedSummary, fixtureLoadingAction, fixtureLoadResult, fixtureReplaceDetail, fixtureReplaceTitle, jordanPlanReset, nextSaveAfterFixture, nextSaveFails, nextSaveWaits, nextSaveWorks, noTestStudentsDetail, noTestStudentsTitle, notAssignedToTestStudent, planNotesResetDetail, planNotesResetTitle, plannerFaultMap, resetAfterUse, testAdvisorCards, testStudentByEmail, testStudentCards, transcriptFixtureChoices, tryBegin } from "./test-students";

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
  assert.match(jordanPlanReset, /Reset leaves planner empty and restores Jordan Hale.s advising session with Sarah Martinez/);
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

test("plan note reset calls AggieTrack with no account ids", async () => {
  const request = aggietrackRequest("/api/test-students/reset-plan-notes", { origin: "http://127.0.0.1:3000", secret: "shared-secret" });
  assert.equal(request.url, "http://127.0.0.1:3000/api/test-students/reset-plan-notes");
  assert.equal(request.headers.get("authorization"), "Bearer shared-secret");
  assert.deepEqual(await request.json(), {});
  assert.equal(planNotesResetTitle, "Reset plan notes?");
  assert.match(planNotesResetDetail, /test advisor wrote on those plans/);
  assert.match(planNotesResetDetail, /transcripts/);
  assert.match(planNotesResetDetail, /If there are no notes, nothing changes/);
  assert.doesNotMatch(planNotesResetDetail, /\b(NOTE|RETURN|SUBMISSION|APPROVAL|SUBMITTED|DRAFT|RETURNED)\b/);
});

test("a fixture load sends the id only and keeps the six names", async () => {
  assert.deepEqual(transcriptFixtureChoices.map(choice => choice.label), [
    "No credits yet",
    "3 credits",
    "6 credits",
    "120 credits",
    "Failed grade",
    "Repeat",
  ]);
  const request = aggietrackRequest("/api/test-students/load-fixture", { origin: "http://127.0.0.1:3000", secret: "shared-secret" }, "it.start@example.test", fixtureForward({ fixture: "repeat", courses: ["CST 999"] }));
  assert.equal(request.url, "http://127.0.0.1:3000/api/test-students/load-fixture");
  assert.deepEqual(await request.json(), { email: "it.start@example.test", fixture: "repeat" });
  assert.deepEqual(fixtureForward({ fixture: "credits-3", courses: ["CST 999"], email: "advisor.1@example.test" }), { fixture: "credits-3" });
  assert.equal(fixtureReplaceTitle, "Replace this transcript?");
  assert.equal(fixtureConfirmAction, "Replace transcript");
  assert.equal(fixtureLoadingAction, "Loading fixture…");
  assert.equal(fixtureReplaceDetail("Avery Cole", "Repeat"), "Avery Cole's courses and grades will be replaced with the Repeat fixture. Their plans and notes will be deleted, and they'll be signed out. You can reset the account afterward.");
  assert.equal(fixtureReplaceDetail("Jordan Hale", "3 credits"), "Jordan Hale's courses and grades will be replaced with the 3 credits fixture. Their plans and notes will be deleted, and they'll be signed out. You can reset the account afterward.");
  assert.equal(fixtureLoadedSummary({ name: "Avery Cole", fixture: "3 credits", attempts: 1, courses: 1, completedCourses: 1, earnedCredits: 3 }), "Loaded 3 credits for Avery Cole. 1 completed course · 3 earned credits.");
  assert.equal(fixtureLoadedSummary({ name: "Avery Cole", fixture: "Repeat", attempts: 2, courses: 1, completedCourses: 1, earnedCredits: 3 }), "Loaded Repeat for Avery Cole. 2 attempts on 1 course · 3 earned credits.");
  assert.equal(fixtureLoadedSummary({ name: "Avery Cole", fixture: "Failed grade", attempts: 2, courses: 2, completedCourses: 1, earnedCredits: 3 }), "Loaded Failed grade for Avery Cole. 2 attempts on 2 courses · 1 completed course · 3 earned credits.");
  assert.notEqual(fixtureLoadedSummary({ name: "Avery Cole", fixture: "Failed grade", attempts: 2, courses: 2, completedCourses: 1, earnedCredits: 3 }), "Loaded Failed grade for Avery Cole. 2 attempts on 1 course · 3 earned credits.");
  assert.equal(fixtureLoadedSummary({ name: "Jordan Hale", fixture: "No credits yet", attempts: 0, courses: 0, completedCourses: 0, earnedCredits: 0 }), "Loaded No credits yet for Jordan Hale. 0 completed courses · 0 earned credits.");
  assert.equal(nextSaveAfterFixture(nextSaveFails, { ok: true, accountChanged: true }), nextSaveWorks);
  assert.equal(nextSaveAfterFixture(nextSaveFails, { ok: false, accountChanged: true }), nextSaveWorks);
  assert.equal(nextSaveAfterFixture(nextSaveFails, { ok: false, accountChanged: false }), nextSaveFails);
  assert.deepEqual(fixtureLoadResult({ name: "Avery Cole", fixture: "Failed grade", attempts: 2, courses: 2, completedCourses: 1, earnedCredits: 3, courseList: ["CST 120"] }), {
    email: "",
    name: "Avery Cole",
    fixture: "Failed grade",
    attempts: 2,
    courses: 2,
    completedCourses: 1,
    earnedCredits: 3,
  });
  assert.throws(() => fixtureLoadResult({ name: "Avery Cole", fixture: "Made up", attempts: 1, completedCourses: 1, earnedCredits: 3 }));
  assert.equal(noTestStudentsTitle, "No test students");
  assert.equal(noTestStudentsDetail, "Fictional test students will appear here when this preview app is configured.");
});

test("one test-account action blocks the next until it finishes", () => {
  const lock = { current: false };
  assert.equal(tryBegin(lock), true);
  assert.equal(tryBegin(lock), false);
  assert.equal(accountsBusy({ pending: "", pendingAll: false, pendingNotes: false, arming: "", loading: "it.start@example.test" }), true);
  assert.equal(accountsBusy({ pending: "", pendingAll: false, pendingNotes: false, arming: "", loading: "" }), false);
  lock.current = false;
  assert.equal(tryBegin(lock), true);
});
