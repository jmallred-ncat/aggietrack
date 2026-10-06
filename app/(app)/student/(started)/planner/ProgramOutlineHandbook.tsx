import { Badge } from "@/components/ui/badge";
import { getCurriculumRecommendations, planPosition, requirementSlotBadge, requirementSlotCredits, requirementSlotTitle } from "@/lib/planner";
import pluralize from "pluralize";

function outlineRowCredits(
    recommendations: Awaited<ReturnType<typeof getCurriculumRecommendations>>,
    row: Awaited<ReturnType<typeof getCurriculumRecommendations>>[number]["courses"][number],
) {
    if (row.course) {
        return row.course.credits;
    }
    if (row.requirementGroup) {
        if (row.credits != null) {
            return row.credits;
        }
        return requirementSlotCredits(recommendations, row.requirementGroup);
    }
    return 0;
}

function creditLabel(credits: number) {
    return `${credits} ${pluralize("credit", credits)}`;
}

export default async function ProgramOutlineHandbook() {
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

    return (
        <div className="not-typeset space-y-8 px-4 pb-6">
            {years.map((year) => (
                <div key={year.label}>
                    <h2 className="text-lg font-semibold">{year.label}</h2>
                    <div className="mt-3 flex flex-col gap-6">
                        {year.terms.map((term) => {
                            const total = term.courses.reduce((sum, course) => sum + outlineRowCredits(recommendations, course), 0);
                            return (
                                <div key={term.id}>
                                    <h3 className="mt-0 flex items-center justify-between gap-3 rounded-lg bg-muted px-4 py-2 text-sm font-medium">
                                        <span>{term.label}</span>
                                        <span className="shrink-0 text-xs font-normal text-muted-foreground tabular-nums">{creditLabel(total)}</span>
                                    </h3>
                                    <div className="space-y-4 rounded-lg border border-dashed border-border px-4 pt-3 pb-3">
                                        {term.courses.map((course) => {
                                            const credits = outlineRowCredits(recommendations, course);
                                            if (course.course === null && course.requirementGroup !== null) {
                                                const group = course.requirementGroup;
                                                const badge = requirementSlotBadge(group);
                                                return (
                                                    <div key={course.id} className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-muted px-4 py-2 not-typeset">
                                                        <h4 className="inline-flex min-w-0 items-center text-sm font-bold text-balance text-muted-foreground">
                                                            {badge ? (
                                                                <Badge variant="outline" className="mr-3 shrink-0 font-mono">
                                                                    {badge}
                                                                </Badge>
                                                            ) : null}
                                                            {course.label ?? requirementSlotTitle(group.name)}
                                                        </h4>
                                                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{creditLabel(credits)}</span>
                                                    </div>
                                                );
                                            }
                                            if (course.course === null) {
                                                return null;
                                            }
                                            const courseRec = course.course;
                                            return (
                                                <div key={course.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-2 not-typeset">
                                                    <h4 className="inline-flex min-w-0 items-center text-balance text-base font-bold not-typeset">
                                                        <Badge className="mr-3 shrink-0 font-mono">
                                                            {courseRec.subject}{" "}{courseRec.number}
                                                        </Badge>
                                                        <span className="line-clamp-1 text-balance text-sm">
                                                            {courseRec.title}
                                                        </span>
                                                    </h4>
                                                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{creditLabel(credits)}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}
