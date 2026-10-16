import { TestStudents } from "@/components/test-students";
import { callAggieTrack, testStudentCards, testStudentConfig } from "@/lib/test-students";

export default async function Page() {
  const config = testStudentConfig();
  let notice = "";
  if (!config.ready) {
    notice = "Set TEST_STUDENT_PASSWORD and TEST_STUDENT_RESET_SECRET on this site and on AggieTrack. Leave them unset on the live site.";
  } else {
    try {
      await callAggieTrack("/api/test-students/ensure");
    } catch (error) {
      notice = error instanceof Error ? error.message : "AggieTrack could not prepare the test students.";
    }
  }
  return <TestStudents students={testStudentCards} password={config.password} notice={notice}/>;
}
