export type TestStudentCard = {
  email: string;
  name: string;
  place: string;
  role?: "student" | "advisor";
  assignment?: string;
};

export const assignedToSarah = "Assigned to Avery, Jordan, Riley";
export const notAssignedToTestStudent = "Not assigned to any test student";

export const testStudentCards: TestStudentCard[] = [
  { email: "it.start@example.test", name: "Avery Cole", place: "Information Technology 2025. Just started, with no prior coursework (0 credits).", role: "student" },
  { email: "it.mid@example.test", name: "Jordan Hale", place: "Information Technology 2025. Junior: 48 credits, 40%, GPA 3.41. Varied A/A-/B+/B, term 4 in progress.", role: "student" },
  { email: "it.late@example.test", name: "Riley Brooks", place: "Information Technology 2025. Senior: 92 credits, 76.7%, GPA 3.64. Strong A/A-/B+/B, ENGL 100 and MATH 224 transfer.", role: "student" },
  { email: "it.retake-f-to-pass@example.test", name: "Taylor Morgan", place: "Information Technology 2025. Sophomore: 29 credits, 24.2%, GPA 3.02. F then B on CST 112, and a D in CST 120 that is not retaken.", role: "student" },
  { email: "it.retake-c-to-a@example.test", name: "Casey Parker", place: "Information Technology 2025. Sophomore: 32 credits, 26.7%, GPA 3.61. W then A on CST 130.", role: "student" },
  { email: "it.diverse-grades@example.test", name: "Alex Rivera", place: "Information Technology 2025. Junior: 44 credits, 36.7%, GPA 2.83. P, TR, W, I, and F, plus JOUR 101 typed into a free elective.", role: "student" },
  { email: "it.over-credits@example.test", name: "Morgan Lee", place: "Information Technology 2025. Senior: 120 credits, 100%, GPA 3.98. Mostly A, with A- in ENGL 101 and ECON 200. ENGL 100 and MATH 224 transfer.", role: "student" },
];

export const testAdvisorCards: TestStudentCard[] = [
  { email: "advisor.1@example.test", name: "Sarah Martinez", place: "Academic advisor. Test account for reviewing student plans and providing guidance.", role: "advisor", assignment: assignedToSarah },
  { email: "advisor.2@example.test", name: "Michael Chen", place: "Academic advisor. Test account for advisor workflow and plan approval testing.", role: "advisor", assignment: notAssignedToTestStudent },
];

export const testAccountCards = [...testStudentCards, ...testAdvisorCards];

export const resetAfterUse = "Reset this student after every use.";
export const jordanPlanReset = "Resetting clears Jordan Hale’s planner and restores the advising session with Sarah Martinez.";
export const transcriptFixtureChoices = [
  { id: "none", label: "No credits yet" },
  { id: "credits-3", label: "3 credits" },
  { id: "credits-6", label: "6 credits" },
  { id: "credits-120", label: "120 credits" },
  { id: "failed", label: "Failed grade" },
  { id: "repeat", label: "Repeat" },
] as const;

export const transcriptFixturePlaceholder = "Choose a fixture";
export const fixtureReplaceTitle = "Replace this transcript?";
export const fixtureLoadAction = "Load fixture";
export const fixtureLoadingAction = "Loading fixture…";
export const fixtureConfirmAction = "Replace transcript";
export const noTestStudentsTitle = "No test students";
export const noTestStudentsDetail = "Fictional test students will appear here when this preview app is configured.";

export function fixtureForward(extra?: Record<string, unknown>) {
  return { fixture: typeof extra?.fixture === "string" ? extra.fixture : "" };
}

export function fixtureChoiceById(id: string) {
  return transcriptFixtureChoices.find((choice) => choice.id === id) ?? null;
}

export function fixtureReplaceDetail(name: string, fixture: string) {
  return `${name}'s courses and grades will be replaced with the ${fixture} fixture. Their plans and notes will be deleted, and they'll be signed out. You can reset the account afterward.`;
}

export function fixtureLoadedSummary(result: { name: string; fixture: string; attempts: number; courses: number; completedCourses: number; earnedCredits: number }) {
  const credits = `${result.earnedCredits} earned credits`;
  if (result.attempts === result.courses && result.courses === result.completedCourses) {
    const completed = result.completedCourses === 1 ? "1 completed course" : `${result.completedCourses} completed courses`;
    return `Loaded ${result.fixture} for ${result.name}. ${completed} · ${credits}.`;
  }
  const courses = result.courses === 1 ? "1 course" : `${result.courses} courses`;
  if (result.completedCourses === result.courses) {
    return `Loaded ${result.fixture} for ${result.name}. ${result.attempts} attempts on ${courses} · ${credits}.`;
  }
  const completed = result.completedCourses === 1 ? "1 completed course" : `${result.completedCourses} completed courses`;
  return `Loaded ${result.fixture} for ${result.name}. ${result.attempts} attempts on ${courses} · ${completed} · ${credits}.`;
}

/** Success clears the armed planner save. A failed load clears it only when the account actually changed. */
export function nextSaveAfterFixture(previous: string, outcome: { ok: boolean; accountChanged: boolean }) {
  if (outcome.ok || outcome.accountChanged) return nextSaveWorks;
  return previous;
}

export function fixtureLoadResult(body: unknown) {
  if (!body || typeof body !== "object") throw new Error("That transcript could not be loaded.");
  const row = body as Record<string, unknown>;
  const attempts = row.attempts;
  const courses = row.courses;
  const completedCourses = row.completedCourses;
  const earnedCredits = row.earnedCredits;
  const count = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0;
  if (typeof row.name !== "string" || typeof row.fixture !== "string" || !count(attempts) || !count(courses) || !count(completedCourses) || !count(earnedCredits)) {
    throw new Error("That transcript could not be loaded.");
  }
  if (!transcriptFixtureChoices.some((choice) => choice.label === row.fixture)) {
    throw new Error("That transcript could not be loaded.");
  }
  return {
    email: typeof row.email === "string" ? row.email : "",
    name: row.name,
    fixture: row.fixture,
    attempts,
    courses,
    completedCourses,
    earnedCredits,
  };
}

export function accountsBusy(flags: { pending: string; pendingAll: boolean; pendingNotes: boolean; arming: string; loading: string }) {
  return flags.pending !== "" || flags.pendingAll || flags.pendingNotes || flags.arming !== "" || flags.loading !== "";
}

export function tryBegin(lock: { current: boolean }) {
  if (lock.current) return false;
  lock.current = true;
  return true;
}

export const planNotesResetTitle = "Reset plan notes?";
export const planNotesResetAction = "Reset plan notes";
export const planNotesResetDetail = "This removes the shared notes on plans that belong to the test students on this page, including notes a test advisor wrote on those plans. Plans, courses, statuses, transcripts, and accounts stay as they are. Notes for anyone else stay. If there are no notes, nothing changes.";

export const nextSaveWorks = "Next save works";
export const nextSaveFails = "Next save fails";
export const nextSaveWaits = "Next save waits 16 seconds";
export const nextSaveChoices = [nextSaveWorks, nextSaveFails, nextSaveWaits];

export function faultChoice(raw: string | null | undefined) {
  if (raw === "fail") return nextSaveFails;
  if (typeof raw === "string" && raw.startsWith("delay:")) return nextSaveWaits;
  return nextSaveWorks;
}

export function faultRequest(choice: string): { fault: "off" | "fail" | "delay"; seconds?: number } | null {
  if (choice === nextSaveWorks) return { fault: "off" };
  if (choice === nextSaveFails) return { fault: "fail" };
  if (choice === nextSaveWaits) return { fault: "delay", seconds: 16 };
  return null;
}

export function plannerFaultMap(body: unknown) {
  const faults: Record<string, string | null> = {};
  if (!body || typeof body !== "object" || !("faults" in body)) return faults;
  const value = (body as { faults?: unknown }).faults;
  if (!value || typeof value !== "object") return faults;
  for (const [email, fault] of Object.entries(value)) faults[email] = typeof fault === "string" ? fault : null;
  return faults;
}

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

export function aggietrackRequest(path: "/api/test-students/ensure" | "/api/test-students/reset" | "/api/test-students/reset-plan-notes" | "/api/test-students/load-fixture" | "/api/test-students/write-fault", config: { origin: string; secret: string }, email?: string, extra?: Record<string, unknown>) {
  return new Request(new URL(path, config.origin), {
    method: "POST",
    headers: { Authorization: `Bearer ${config.secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...(email ? { email } : {}), ...extra }),
    cache: "no-store",
  });
}

export async function callAggieTrack(path: "/api/test-students/ensure" | "/api/test-students/reset" | "/api/test-students/reset-plan-notes" | "/api/test-students/load-fixture" | "/api/test-students/write-fault", email?: string, extra?: Record<string, unknown>) {
  const config = testStudentConfig();
  if (!config.ready) throw new Error("Set TEST_STUDENT_PASSWORD and TEST_STUDENT_RESET_SECRET on this site and on AggieTrack. Leave them unset on the live site.");
  const student = email ? testStudentByEmail(email) : null;
  if (email && !student) throw new Error("That is not a test student.");
  if (path === "/api/test-students/load-fixture" && student?.role !== "student") throw new Error("That is not a test student.");
  const forwarded = path === "/api/test-students/load-fixture" ? fixtureForward(extra) : extra;
  const response = await fetch(aggietrackRequest(path, config, student?.email, forwarded));
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "AggieTrack could not update the test student.");
  return body;
}
