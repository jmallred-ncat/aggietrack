import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { academicTermLabel } from "@/lib/academic-term";
import { catalogYearLabel, personName, plannedTermStatusLabel, plannedTermStatusVariant } from "@/lib/plan-status";
import { formatProgramName } from "@/lib/program";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/student";
import Link from "next/link";

export default async function AdvisorHomePage() {
    const user = await getSessionUser();
    const students = await prisma.studentProfile.findMany({
        where: { advisorId: user.id },
        include: {
            user: { select: { firstName: true, lastName: true } },
            catalogYear: { include: { program: { include: { degree: true } } } },
            plannedTerms: {
                include: { term: true },
                orderBy: { updatedAt: "desc" },
                take: 1,
            },
        },
        orderBy: [{ user: { lastName: "asc" } }, { user: { firstName: "asc" } }],
    });

    return (
        <div className="py-6">
            <header>
                <h1 className="text-4xl font-bold">Advisor</h1>
                <p className="mt-2 max-w-prose text-sm text-muted-foreground">
                    The students assigned to you, and the latest term plan for each one.
                </p>
            </header>
            {students.length === 0 ? (
                <Empty className="mt-6 border">
                    <EmptyHeader>
                        <EmptyTitle>No students assigned yet</EmptyTitle>
                        <EmptyDescription>Students assigned to you will appear here.</EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : (
                <ul className="mt-6 space-y-3">
                    {students.map((student) => {
                        const plan = student.plannedTerms[0];
                        const name = personName(student.user);
                        return (
                            <li key={student.id} className="rounded-lg border bg-muted p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <p className="text-base font-medium">{name}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {formatProgramName(student.catalogYear.program)} · Catalog year {catalogYearLabel(student.catalogYear.year)}
                                        </p>
                                    </div>
                                    {plan ? (
                                        <Badge variant={plannedTermStatusVariant(plan.status)}>{plannedTermStatusLabel(plan.status)}</Badge>
                                    ) : (
                                        <Badge variant="outline">No plan yet</Badge>
                                    )}
                                </div>
                                <p className="mt-2 text-sm text-muted-foreground">
                                    {plan ? `Latest plan: ${academicTermLabel(plan.term)}` : "No term plan yet"}
                                </p>
                                {plan ? (
                                    <Button
                                        className="mt-3"
                                        variant={plan.status === "SUBMITTED" ? "default" : "outline"}
                                        nativeButton={false}
                                        render={<Link href={`/advisor/plans/${plan.id}`}>{plan.status === "SUBMITTED" ? "Review plan" : "View plan"}</Link>}
                                    />
                                ) : (
                                    <Button className="mt-3" variant="outline" nativeButton={false} render={<Link href="/advisor/students">View students</Link>} />
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
