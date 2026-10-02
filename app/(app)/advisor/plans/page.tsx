import { Badge } from "@/components/ui/badge";
import { academicTermLabel } from "@/lib/planned-term";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/student";
import PlanReview from "./PlanReview";

export default async function AdvisorPlansPage() {
    const user = await getSessionUser();
    const plans = await prisma.plannedTerm.findMany({
        where: {
            student: { advisorId: user.id },
            status: { in: ["SUBMITTED", "APPROVED"] },
        },
        include: {
            student: {
                include: {
                    user: { select: { firstName: true, lastName: true } },
                },
            },
            term: true,
            courses: {
                include: {
                    course: { select: { subject: true, number: true, title: true, credits: true } },
                },
                orderBy: { createdAt: "asc" },
            },
        },
        orderBy: { submittedAt: "desc" },
    });
    const waiting = plans.filter((plan) => plan.status === "SUBMITTED");
    const approved = plans.filter((plan) => plan.status === "APPROVED");

    return (
        <div>
            <header className="not-typeset py-6">
                <h1 className="text-4xl font-bold">Plans</h1>
                <p className="mt-2 max-w-prose text-sm text-balance text-muted-foreground">
                    Term plans your advisees submitted. Approve a plan by adding the registration pin.
                </p>
            </header>

            <section className="space-y-6 pb-6">
                <h2 className="text-lg font-semibold">Waiting for review</h2>
                {waiting.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No term plans are waiting.</p>
                ) : waiting.map((plan) => (
                    <article key={plan.id} className="rounded-lg border border-border p-4">
                        <header className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-base font-semibold not-typeset">
                                {plan.student.user.firstName} {plan.student.user.lastName}
                            </h3>
                            <span className="text-sm text-muted-foreground">{academicTermLabel(plan.term)}</span>
                        </header>
                        <ul className="mt-3 space-y-2">
                            {plan.courses.map((row) => (
                                <li key={row.id} className="flex items-center gap-2 text-sm not-typeset">
                                    <Badge className="font-mono">{row.course.subject} {row.course.number}</Badge>
                                    <span className="min-w-0 truncate">{row.course.title}</span>
                                    <span className="ml-auto shrink-0 text-muted-foreground tabular-nums">{row.course.credits} credits</span>
                                </li>
                            ))}
                        </ul>
                        <PlanReview plannedTermId={plan.id} />
                    </article>
                ))}
            </section>

            <section className="space-y-6 pb-6">
                <h2 className="text-lg font-semibold">Approved</h2>
                {approved.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No term plans have been approved.</p>
                ) : approved.map((plan) => (
                    <article key={plan.id} className="rounded-lg border border-border p-4">
                        <header className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-base font-semibold not-typeset">
                                {plan.student.user.firstName} {plan.student.user.lastName}
                            </h3>
                            <span className="text-sm text-muted-foreground">{academicTermLabel(plan.term)}</span>
                        </header>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Pin <span className="font-mono text-foreground">{plan.registrationPin}</span>
                            {plan.registeredAt ? ". The student recorded these courses as in progress." : ". Waiting for the student to register."}
                        </p>
                        <ul className="mt-3 space-y-2">
                            {plan.courses.map((row) => (
                                <li key={row.id} className="flex items-center gap-2 text-sm not-typeset">
                                    <Badge className="font-mono">{row.course.subject} {row.course.number}</Badge>
                                    <span className="min-w-0 truncate">{row.course.title}</span>
                                </li>
                            ))}
                        </ul>
                    </article>
                ))}
            </section>
        </div>
    );
}
