import { redirect } from "next/navigation";
import { TestStudents } from "@/components/test-students";
import { loadWorkspace } from "@/lib/load-workspace";
import { callAggieTrack, plannerFaultMap, testAccountCards, testStudentConfig } from "@/lib/test-students";

// Extract scenario notes from the static description (everything after the standing/stats)
function getScenarioNotes(place: string): string {
  // Match pattern: "Program Year. Standing: credits, %, GPA. [Scenario notes]"
  const match = place.match(/\.\s+(?:Freshman|Sophomore|Junior|Senior):\s+\d+\s+credits?,\s+[\d.]+%,\s+(?:GPA\s+[\d.]+|no GPA yet)\.\s*(.*)/);
  return match?.[1] || "";
}

export default async function Page() {
  // The page renders alongside the layout, so the password is read only after the session check.
  if (!await loadWorkspace()) redirect("/sign-in");
  const config = testStudentConfig();
  let notice = "";
  let faults: Record<string, string | null> = {};
  let students = testAccountCards;
  
  if (!config.ready) {
    notice = "Set TEST_STUDENT_PASSWORD and TEST_STUDENT_RESET_SECRET on this site and on AggieTrack. Leave them unset on the live site.";
  } else {
    try {
      faults = plannerFaultMap(await callAggieTrack("/api/test-students/ensure"));
      
      // Fetch live stats and merge into cards
      try {
        const statsResponse = await callAggieTrack("/api/test-students/stats");
        const stats = statsResponse.stats as Record<string, { credits: number; percentage: number; gpa: number | null; standing: string | null; place: string }> | undefined;
        if (stats) {
          students = testAccountCards.map((card) => {
            const stat = stats[card.email];
            if (stat && card.role === "student") {
              // Determine if this is reset state by comparing credits, GPA, and percentage to expected values
              const resetState: Record<string, { credits: number; gpa: number | null; percentage: number }> = {
                "it.start@example.test": { credits: 0, gpa: null, percentage: 0 },
                "it.mid@example.test": { credits: 48, gpa: 3.41, percentage: 40 },
                "it.late@example.test": { credits: 92, gpa: 3.64, percentage: 76.7 },
                "it.retake-f-to-pass@example.test": { credits: 29, gpa: 3.02, percentage: 24.2 },
                "it.retake-c-to-a@example.test": { credits: 32, gpa: 3.61, percentage: 26.7 },
                "it.diverse-grades@example.test": { credits: 44, gpa: 2.83, percentage: 36.7 },
                "it.over-credits@example.test": { credits: 120, gpa: 3.98, percentage: 100 },
              };
              
              const expected = resetState[card.email];
              const isResetState = expected && 
                expected.credits === stat.credits && 
                expected.gpa === stat.gpa && 
                expected.percentage === stat.percentage;
              
              if (isResetState) {
                // Avery special case: preserve original wording for reset state
                if (card.email === "it.start@example.test") {
                  return card; // Keep original "Just started, with no prior coursework (0 credits)."
                }
                
                // Other students: append scenario notes to stats
                const scenarioNotes = getScenarioNotes(card.place);
                const place = scenarioNotes
                  ? `${stat.place}. ${scenarioNotes}`
                  : `${stat.place}.`;
                return { ...card, place };
              } else {
                // Non-reset: use place from API which includes standing
                return { ...card, place: `${stat.place}.` };
              }
            }
            return card;
          });
        }
      } catch (error) {
        // Silently fall back to static descriptions if stats fetch fails
        console.error("Failed to fetch student stats:", error);
      }
    } catch (error) {
      notice = error instanceof Error ? error.message : "AggieTrack could not prepare the test accounts.";
    }
  }
  return <TestStudents students={students} password={config.password} notice={notice} faults={faults}/>;
}
