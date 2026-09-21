import { Badge } from "@/components/ui/badge";
import { requireStudentProfile } from "@/lib/student";

export default async function PlannerPage() {
    const profile = await requireStudentProfile();
    const program = profile.catalogYear.program;

    return <div>
        <header className="not-typeset py-6">
            <Badge>{program.department.name}</Badge>
            <h1 className="text-4xl font-bold not-typeset text-balance max-w-prose w-full">Your {program.degree.abbreviation} in {program.name} Planner</h1>
            <span>{profile.catalogYear.year} Catalog Year</span>
            <p className="text-sm text-muted-foreground mt-2 max-w-prose w-full text-balance">
                Your personalized course planner for your {program.degree.name} degree. Add courses to your planner to track your progress and ensure you meet all degree requirements.
            </p>
        </header>
    </div>;
}