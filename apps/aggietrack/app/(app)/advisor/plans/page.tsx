import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { academicTermLabel } from "@/lib/academic-term";
import { advisorPlanUpdatedLabel, advisorPlansSummary, sortAdvisorPlans } from "@/lib/advisor-plans";
import { personName, plannedTermStatusLabel, plannedTermStatusVariant } from "@/lib/plan-status";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/student";
import Link from "next/link";

const plansReturn = "/advisor/plans";

export default async function AdvisorPlansPage() {
    const user = await getSessionUser();
    const plans = sortAdvisorPlans(await prisma.plannedTerm.findMany({
        where: { student: { advisorId: user.id } },
        include: {
            student: { include: { user: { select: { firstName: true, lastName: true } } } },
            term: true,
        },
    }));
    const waiting = plans.filter((plan) => plan.status === "SUBMITTED").length;

    return (
        <div className="not-typeset flex flex-col gap-6 py-6">
            <header className="space-y-2">
                <h1 className="text-3xl font-bold text-balance sm:text-4xl">Plans</h1>
                <p className="max-w-prose text-balance text-sm text-muted-foreground">
                    Term plans for the students assigned to you. Open a plan to review it or leave a note.
                </p>
            </header>
            <p className="text-sm text-muted-foreground">{advisorPlansSummary(plans.length, waiting)}</p>
            {plans.length === 0 ? (
                <Empty className="border">
                    <EmptyHeader>
                        <EmptyTitle>No term plans yet</EmptyTitle>
                        <EmptyDescription>Plans appear here after a student adds a course.</EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : (
                <>
                    <div className="hidden xl:block">
                        <Card className="overflow-hidden py-0">
                            <Table className="table-fixed">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[26%]">Student</TableHead>
                                        <TableHead className="w-[16%]">Term</TableHead>
                                        <TableHead className="w-[22%]">Status</TableHead>
                                        <TableHead className="w-[20%]">Updated</TableHead>
                                        <TableHead className="w-[16%]">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {plans.map((plan) => {
                                        const name = personName(plan.student.user);
                                        const term = academicTermLabel(plan.term);
                                        return (
                                            <TableRow key={plan.id}>
                                                <TableCell className="align-top">
                                                    <p className="text-pretty text-base font-medium">{name}</p>
                                                </TableCell>
                                                <TableCell className="align-top whitespace-nowrap">{term}</TableCell>
                                                <TableCell className="align-top">
                                                    <Badge variant={plannedTermStatusVariant(plan.status)}>{plannedTermStatusLabel(plan.status)}</Badge>
                                                </TableCell>
                                                <TableCell className="align-top whitespace-nowrap text-sm text-muted-foreground">
                                                    {advisorPlanUpdatedLabel(plan)}
                                                </TableCell>
                                                <TableCell className="align-top whitespace-nowrap">{planAction(plan.id, name, term, plan.status === "SUBMITTED")}</TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </Card>
                    </div>
                    <div className="space-y-4 xl:hidden">
                        {plans.map((plan) => {
                            const name = personName(plan.student.user);
                            const term = academicTermLabel(plan.term);
                            return (
                                <Card key={plan.id}>
                                    <CardHeader>
                                        <p className="text-base font-medium">{name}</p>
                                        <p className="text-sm text-muted-foreground">{term}</p>
                                        <Badge variant={plannedTermStatusVariant(plan.status)}>{plannedTermStatusLabel(plan.status)}</Badge>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-muted-foreground">{advisorPlanUpdatedLabel(plan)}</p>
                                    </CardContent>
                                    <CardFooter>{planAction(plan.id, name, term, plan.status === "SUBMITTED", true)}</CardFooter>
                                </Card>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}

function planAction(planId: string, name: string, term: string, review: boolean, wide = false) {
    const label = review ? "Review plan" : "View plan";
    return (
        <Button
            className={wide ? "h-11 w-full" : undefined}
            variant={review ? "default" : "outline"}
            nativeButton={false}
            render={(
                <Link
                    href={`/advisor/plans/${planId}?from=${encodeURIComponent(plansReturn)}`}
                    aria-label={`${label} for ${name}, ${term}`}
                >
                    {label}
                </Link>
            )}
        />
    );
}
