import { academicTermLabel, getPlannerWindow, getPlannableCourses, getStudentPlannedTerm } from "@/lib/planned-term";
import { prisma } from "@/lib/prisma";
import { requireStudentProfile } from "@/lib/student";
import CurrentSemesterPrompt, { PlanCurrentSemesterButton } from "./CurrentSemesterPrompt";
import PlanEditor from "./PlanEditor";

export default async function PlannerPage({
    searchParams,
}: {
    searchParams: Promise<{ term?: string }>;
}) {
    const params = await searchParams;
    const profile = await requireStudentProfile();
    const planner = await getPlannerWindow();
    if (planner.ask) {
        return (
            <CurrentSemesterPrompt
                termId={planner.ask.termId}
                termLabel={planner.ask.termLabel}
                nextLabel={planner.ask.nextLabel}
            />
        );
    }
    const advisor = profile.advisorId
        ? await prisma.user.findUnique({
            where: { id: profile.advisorId },
            select: { firstName: true, lastName: true },
        })
        : null;
    const terms = planner.terms;
    const selected = terms.find((term) => term.id === params.term) ?? terms[0] ?? null;
    const [plan, courses] = selected
        ? await Promise.all([
            getStudentPlannedTerm(selected.id),
            getPlannableCourses(selected),
        ])
        : [null, []];

    return (
        <div>
            {planner.declined ? (
                <p className="mb-4 max-w-prose text-sm text-balance text-muted-foreground">
                    You are planning the next term.{" "}
                    <PlanCurrentSemesterButton termId={planner.declined.termId} termLabel={planner.declined.termLabel} />
                    {" "}if you are taking courses this semester.
                </p>
            ) : null}
            {terms.length > 0 && selected ? (
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
            ) : (
                <p className="text-sm text-muted-foreground">No terms are open for planning this semester.</p>
            )}
        </div>
    );
}
