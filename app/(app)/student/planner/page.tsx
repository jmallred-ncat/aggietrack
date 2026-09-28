import { Badge } from "@/components/ui/badge";
import { getCurriculumRecommendations } from "@/lib/planner";
import { requireStudentProfile } from "@/lib/student";

export default async function PlannerPage() {
    const profile = await requireStudentProfile();
    const program = profile.catalogYear.program;
    const recommendations = await getCurriculumRecommendations();

    const currentYear = new Date().getFullYear() + 1;

    function termForSequence(sequence: number) {
        const academicYear = currentYear + Math.floor((sequence - 1) / 2);
        const isFall = sequence % 2 === 1;

        return {
            session: isFall ? "Fall" : "Spring",
            calendarYear: isFall ? academicYear : academicYear + 1,
            academicYear,
        }
    }

    return <div>

        <section>
            <header className="not-typeset py-6 space-y-2">
                <Badge>{program.department.name}</Badge>
                <h1 className="text-4xl font-bold not-typeset text-balance max-w-xl w-full -mb-1.5">Your {program.degree.abbreviation} in {program.name} Course Plan</h1>
                <span>{profile.catalogYear.year} Catalog Year</span>
                <p className="text-sm text-muted-foreground mt-2 max-w-prose w-full text-balance">
                    Your personalized course planner for your degree program. Add courses to your planner to track your progress and ensure you meet all degree requirements.
                </p>
            </header>
        </section>

        <section>
            <header className="not-typeset py-6 space-y-2">
                <h2 className="text-2xl font-bold not-typeset text-balance max-w-xl w-full -mb-1.5">Recommended Program Plan</h2>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 gap-y-16">
                {recommendations.map((recommendation, index) => {
                    const sequence = termForSequence(recommendation.sequence);
                    return (
                        <div key={recommendation.id}>
                            <h3 className="text-lg font-bold not-typeset text-balance max-w-xl w-full -mb-1.5">{sequence.session} {sequence.calendarYear}</h3>

                            <div className="min-h-[300px] border border-dashed border-border rounded-lg px-4 py-3 space-y-2 not-typeset mt-4">
                                {recommendation.courses.map((course) => {
                                    if (course.course === null && course.requirementGroup !== null) {
                                        return (
                                            <div key={course.id} className="p-2 px-4 border border-dashed border-border rounded-lg not-typeset bg-muted">
                                                <h4 className="text-base font-bold text-balance max-w-xl w-full text-muted-foreground">{course.requirementGroup.name}</h4>
                                            </div>
                                        )
                                    } else if (course.course !== null) {
                                        const courseRec = course.course;
                                        return (
                                            <div key={course.id} className="p-2 px-4 border border-border rounded-lg">
                                                <h4 className="text-base font-bold not-typeset text-balance max-w-xl w-full line-clamp-1 inline-flex items-center">
                                                    <Badge className="mr-3 font-meidum">
                                                        {courseRec.subject}{" "}{courseRec.number}
                                                    </Badge>
                                                    <span>
                                                        {courseRec.title}
                                                    </span>
                                                </h4>
                                            </div>
                                        )
                                    }



                                })}
                            </div>
                        </div>
                    )
                })}
            </div>
        </section>

    </div>;
}