import { Badge } from "@/components/ui/badge";
import { getCurriculumRecommendations, planPosition, requirementSlotCredits, requirementSlotTitle } from "@/lib/planner";



export default async function PlannerPage() {
    const recommendations = await getCurriculumRecommendations();
    const years: {
        label: string;
        terms: { id: string; label: string; courses: (typeof recommendations)[number]["courses"] }[];
    }[] = [];

    for (const recommendation of recommendations) {
        const position = planPosition(recommendation.sequence);
        const term = {
            id: recommendation.id,
            label: position.season,
            courses: recommendation.courses,
        };
        const year = years.find((item) => item.label === position.yearLabel);
        if (year) {
            year.terms.push(term);
            continue;
        }
        years.push({ label: position.yearLabel, terms: [term] });
    }

    return <div>

        <section className="@container/outline">
            <header className="not-typeset py-6 space-y-2">
                <h2 className="text-2xl font-bold not-typeset text-balance max-w-xl w-full -mb-1.5">Program Outline</h2>
            </header>

            <div className="space-y-8 pb-6">
                {years.map((year) => (
                    <div key={year.label}>
                        <h2 className="px-4 text-lg font-semibold">{year.label}</h2>
                        <div className="grid grid-cols-1 gap-6 @4xl/outline:grid-cols-2">
                            {year.terms.map((term) => (
                                <div key={term.id}>
                                    <h3 className="mt-0 rounded-lg bg-muted px-4 py-2 text-sm font-medium">{term.label}</h3>
                                    <div className="min-h-[300px] space-y-4 rounded-lg border border-dashed border-border px-4 pt-3 pb-3">
                                        {term.courses.map((course) => {
                                            if (course.course === null && course.requirementGroup !== null) {
                                                const credits = requirementSlotCredits(recommendations, course.requirementGroup);
                                                return (
                                                    <div key={course.id} className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-muted px-4 py-2 not-typeset">
                                                        <h4 className="text-sm font-bold text-balance text-muted-foreground">{requirementSlotTitle(course.requirementGroup.name)}</h4>
                                                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{credits} credits</span>
                                                    </div>
                                                );
                                            }
                                            if (course.course === null) {
                                                return null;
                                            }
                                            const courseRec = course.course;
                                            return (
                                                <div key={course.id} className="rounded-lg border border-border px-4 py-2">
                                                    <h4 className="inline-flex w-full max-w-xl items-center text-balance text-base font-bold not-typeset line-clamp-1">
                                                        <Badge className="mr-3 font-meidum font-mono">
                                                            {courseRec.subject}{" "}{courseRec.number}
                                                        </Badge>
                                                        <span className="line-clamp-1 text-balance text-sm">
                                                            {courseRec.title}
                                                        </span>
                                                    </h4>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </section>

    </div>;
}