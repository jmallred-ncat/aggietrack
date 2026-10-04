import { Badge } from "@/components/ui/badge";
import { academicTermLabel, getPlanningTerms } from "@/lib/planned-term";
import { requireStudentProfile } from "@/lib/student";
import { Suspense } from "react";
import PlannerNavigation from "./PlannerNavigation";

export default async function PlannerLayout({ children }: { children: React.ReactNode }) {
    const [profile, terms] = await Promise.all([
        requireStudentProfile(),
        getPlanningTerms(),
    ]);
    const program = profile.catalogYear.program;
    return <div>
        <section>
            <header className="not-typeset py-6 space-y-2">
                <Badge>{program.department.name}</Badge>
                <h1 className="text-4xl font-bold not-typeset text-balance max-w-xl w-full">{program.degree.abbreviation} in {program.name} Degree Plan</h1>
                <span>{profile.catalogYear.year} Catalog Year</span>
                <p className="text-sm text-muted-foreground mt-2 max-w-prose w-full text-balance">
                    Your personalized course planner for your degree program. Add courses to your planner to track your progress and ensure you meet all degree requirements.
                </p>

                <Suspense>
                    <PlannerNavigation terms={terms.map((term) => ({
                        id: term.id,
                        label: academicTermLabel(term),
                    }))} />
                </Suspense>
            </header>
        </section>

        <div>
            {children}
        </div>

    </div>;
}