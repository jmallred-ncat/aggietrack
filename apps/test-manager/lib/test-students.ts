export type TestStudentCard = {
  email: string;
  name: string;
  place: string;
  role?: "student" | "advisor";
};

export const testStudentCards: TestStudentCard[] = [
  { email: "it.start@example.test", name: "Avery Cole", place: "Information Technology 2025. Just started, with no prior coursework.", role: "student" },
  { email: "it.mid@example.test", name: "Jordan Hale", place: "Information Technology 2025. Midway, with the first four handbook terms complete.", role: "student" },
  { email: "it.late@example.test", name: "Riley Brooks", place: "Information Technology 2025. Near the end, with the first six handbook terms complete.", role: "student" },
];

export const testAdvisorCards: TestStudentCard[] = [
  { email: "advisor.1@example.test", name: "Sarah Martinez", place: "Academic advisor. Test account for reviewing student plans and providing guidance.", role: "advisor" },
  { email: "advisor.2@example.test", name: "Michael Chen", place: "Academic advisor. Test account for advisor workflow and plan approval testing.", role: "advisor" },
];

export const testAccountCards = [...testStudentCards, ...testAdvisorCards];

export const resetAfterUse = "Reset this student after every use.";

export function testStudentConfig() {
  const origin = process.env.AGGIETRACK_ORIGIN?.trim() || "http://127.0.0.1:3000";
  const password = process.env.TEST_STUDENT_PASSWORD ?? "";
  const secret = process.env.TEST_STUDENT_RESET_SECRET ?? "";
  return { origin, password, secret, ready: password.length >= 8 && secret.length > 0 };
}

export function testStudentByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  return testAccountCards.find(account => account.email === normalized) ?? null;
}

export function aggietrackRequest(path: "/api/test-students/ensure" | "/api/test-students/reset", config: { origin: string; secret: string }, email?: string) {
  return new Request(new URL(path, config.origin), {
    method: "POST",
    headers: { Authorization: `Bearer ${config.secret}`, "Content-Type": "application/json" },
    body: JSON.stringify(email ? { email } : {}),
    cache: "no-store",
  });
}

export async function callAggieTrack(path: "/api/test-students/ensure" | "/api/test-students/reset", email?: string) {
  const config = testStudentConfig();
  if (!config.ready) throw new Error("Set TEST_STUDENT_PASSWORD and TEST_STUDENT_RESET_SECRET on this site and on AggieTrack. Leave them unset on the live site.");
  const student = email ? testStudentByEmail(email) : null;
  if (email && !student) throw new Error("That is not a test student.");
  const response = await fetch(aggietrackRequest(path, config, student?.email));
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "AggieTrack could not update the test student.");
  return body;
}
