import assert from "node:assert/strict";
import { test } from "node:test";
import { aggietrackRequest, resetAfterUse, testStudentByEmail, testStudentCards } from "./test-students";

test("the testing site shows the three Information Technology students and the reset instruction", () => {
  assert.deepEqual(testStudentCards.map(student => student.email), ["it.start@example.test", "it.mid@example.test", "it.late@example.test"]);
  assert.match(resetAfterUse, /after every use/);
  assert.equal(testStudentByEmail("it.late@example.test")?.name, "Riley Brooks");
  assert.equal(testStudentByEmail("someone@example.test"), null);
});

test("reset calls AggieTrack with the secret and only the student email", async () => {
  const request = aggietrackRequest("/api/test-students/reset", { origin: "http://127.0.0.1:3000", secret: "shared-secret" }, "it.mid@example.test");
  assert.equal(request.url, "http://127.0.0.1:3000/api/test-students/reset");
  assert.equal(request.headers.get("authorization"), "Bearer shared-secret");
  assert.deepEqual(await request.json(), { email: "it.mid@example.test" });
});
