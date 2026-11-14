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

// Get standing from the static description
function getStanding(place: string): string {
  const match = place.match(/\.\s+(Freshman|Sophomore|Junior|Senior):/);
  return match?.[1] || "Freshman";
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
        const stats = statsResponse.stats as Record<string, { credits: number; percentage: number; gpa: number | null }> | undefined;
        if (stats) {
          students = testAccountCards.map((card) => {
            const stat = stats[card.email];
            if (stat && card.role === "student") {
              const scenarioNotes = getScenarioNotes(card.place);
              const standing = getStanding(card.place);
              const gpaStr = stat.gpa !== null ? `GPA ${stat.gpa.toFixed(2)}` : "no GPA yet";
              const statsStr = `${standing}: ${stat.credits} credits, ${stat.percentage}%, ${gpaStr}`;
              const place = scenarioNotes 
                ? `Information Technology 2025. ${statsStr}. ${scenarioNotes}`
                : `Information Technology 2025. ${statsStr}.`;
              return { ...card, place };
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
