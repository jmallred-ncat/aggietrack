export type ResetTarget = { email: string; name: string };

export type ResetAllResult = {
  succeeded: ResetTarget[];
  failed: Array<ResetTarget & { error: string }>;
  total: number;
};

/** Reset each account with the existing per-student reset. One failure does not stop the rest. */
export async function resetTestAccounts(students: ResetTarget[], resetOne: (email: string) => Promise<void>): Promise<ResetAllResult> {
  const succeeded: ResetTarget[] = [];
  const failed: Array<ResetTarget & { error: string }> = [];
  for (const student of students) {
    try {
      await resetOne(student.email);
      succeeded.push(student);
    } catch (error) {
      failed.push({ ...student, error: error instanceof Error ? error.message : "That account could not be reset." });
    }
  }
  return { succeeded, failed, total: students.length };
}

export function resetAllSummary(result: ResetAllResult) {
  const advisorNote = result.failed.length === 0 ? " and advisor availability" : "";
  if (result.failed.length === 0) return `Reset ${result.succeeded.length} of ${result.total} students${advisorNote}`;
  return `Reset ${result.succeeded.length} of ${result.total} students${advisorNote}. Failed: ${result.failed.map(student => student.name).join(", ")}`;
}

export function planNotesResetSummary(deleted: number) {
  if (deleted === 0) return "No plan notes were on the test accounts.";
  if (deleted === 1) return "Removed 1 plan note from the test accounts.";
  return `Removed ${deleted} plan notes from the test accounts.`;
}
