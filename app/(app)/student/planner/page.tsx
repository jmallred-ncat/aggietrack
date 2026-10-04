import { academicTermLabel, getPlannableCourses, getPlanningTerms, getStudentPlannedTerm } from "@/lib/planned-term";
import { prisma } from "@/lib/prisma";
import { requireStudentProfile } from "@/lib/student";
import { cn } from "@/lib/utils";
import Link from "next/link";
import PlanEditor from "./PlanEditor";

export default async function PlannerPage({
    searchParams,
}: {
    searchParams: Promise<{ term?: string }>;
}) {
    const params = await searchParams;
    const profile = await requireStudentProfile();
    const [terms, advisor] = await Promise.all([
        getPlanningTerms(),
        profile.advisorId
            ? prisma.user.findUnique({
                where: { id: profile.advisorId },
                select: { firstName: true, lastName: true },
            })
            : null,
    ]);
    const selected = terms.find((term) => term.id === params.term) ?? terms[0] ?? null;
    const [plan, courses] = selected
        ? await Promise.all([
            getStudentPlannedTerm(selected.id),
            getPlannableCourses(selected),
        ])
        : [null, []];

    return (
        <div>
            <header className="not-typeset py-6 space-y-2">
                <h2 className="text-2xl font-bold not-typeset text-balance max-w-xl w-full -mb-1.5">Your Plan</h2>
                <p className="max-w-prose text-sm text-balance text-muted-foreground">
                    Build the courses for one registration term and submit them for your advisor to approve.
                </p>
            </header>

            {terms.length > 0 && selected ? (
                <>
                    <nav className="not-typeset mb-6 flex flex-wrap gap-2">
                        {terms.map((term) => (
                            <Link
                                key={term.id}
                                href={`/student/planner?term=${term.id}`}
                                className={cn(
                                    "rounded-lg px-3 py-1.5 text-sm",
                                    term.id === selected.id ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted",
                                )}
                            >
                                {academicTermLabel(term)}
                            </Link>
                        ))}
                    </nav>
                    <PlanEditor
                        termId={selected.id}
                        termLabel={academicTermLabel(selected)}
                        advisorName={advisor ? `${advisor.firstName} ${advisor.lastName}` : null}
                        courses={courses}
                        plan={plan ? {
                            id: plan.id,
                            status: plan.status,
                            registrationPin: plan.registrationPin,
                            registered: plan.registeredAt !== null,
                            courses: plan.courses.map((row) => ({
                                plannedCourseId: row.id,
                                id: row.course.id,
                                subject: row.course.subject,
                                number: row.course.number,
                                title: row.course.title,
                                credits: row.course.credits,
                            })),
                        } : null}
                    />
                </>
            ) : (
                <p className="text-sm text-muted-foreground">No terms are open for planning this semester.</p>
            )}
        </div>
    );
}
