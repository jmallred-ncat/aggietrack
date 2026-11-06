import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { academicTermLabel } from "@/lib/academic-term";
import { personName, plannedTermStatusLabel, plannedTermStatusVariant } from "@/lib/plan-status";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/student";
import Link from "next/link";

export default async function AdvisorPlansPage() {
    const user = await getSessionUser();
    const plans = await prisma.plannedTerm.findMany({
        where: { student: { advisorId: user.id } },
        include: {
            student: { include: { user: { select: { firstName: true, lastName: true } } } },
            term: true,
        },
        orderBy: [{ submittedAt: "desc" }, { updatedAt: "desc" }],
    });

    return (
        <div className="py-6">
            <header>
                <h1 className="text-4xl font-bold">Plans</h1>
                <p className="mt-2 max-w-prose text-sm text-muted-foreground">
                    Term plans for the students assigned to you. Open a plan to review it or leave a note.
                </p>
            </header>
            {plans.length === 0 ? (
                <Empty className="mt-6 border">
                    <EmptyHeader>
                        <EmptyTitle>No term plans yet</EmptyTitle>
                        <EmptyDescription>Plans appear here after a student adds a course.</EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : (
                <ul className="mt-6 space-y-3">
                    {plans.map((plan) => {
                        const name = personName(plan.student.user);
                        const term = academicTermLabel(plan.term);
                        const review = plan.status === "SUBMITTED";
                        const label = review ? "Review plan" : "View plan";
                        return (
                            <li key={plan.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
                                <div>
                                    <p className="font-medium">{name}</p>
                                    <p className="text-sm text-muted-foreground">{term}</p>
                                </div>
                                <Badge variant={plannedTermStatusVariant(plan.status)}>{plannedTermStatusLabel(plan.status)}</Badge>
                                <Button
                                    variant={review ? "default" : "outline"}
                                    nativeButton={false}
                                    render={<Link href={`/advisor/plans/${plan.id}`} aria-label={`${label} for ${name}, ${term}`}>{label}</Link>}
                                />
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
