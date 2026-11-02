import { redirect } from "next/navigation";
import { TestStudents } from "@/components/test-students";
import { loadWorkspace } from "@/lib/load-workspace";
import { callAggieTrack, testAccountCards, testStudentConfig } from "@/lib/test-students";

export default async function Page() {
  // The page renders alongside the layout, so the password is read only after the session check.
  if (!await loadWorkspace()) redirect("/sign-in");
  const config = testStudentConfig();
  let notice = "";
  if (!config.ready) {
    notice = "Set TEST_STUDENT_PASSWORD and TEST_STUDENT_RESET_SECRET on this site and on AggieTrack. Leave them unset on the live site.";
  } else {
    try {
      await callAggieTrack("/api/test-students/ensure");
    } catch (error) {
      notice = error instanceof Error ? error.message : "AggieTrack could not prepare the test accounts.";
    }
  }
  return <TestStudents students={testAccountCards} password={config.password} notice={notice}/>;
}
