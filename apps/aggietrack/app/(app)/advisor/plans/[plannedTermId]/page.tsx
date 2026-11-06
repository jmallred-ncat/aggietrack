import { PlanNotes } from "@/components/plan-notes";
import { RuleViolationAlert } from "@/components/rule-violation-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { academicTermLabel } from "@/lib/academic-term";
import { advisorReturnTarget, type AdvisorReturnTarget } from "@/lib/advisor-roster";
import { NOTE_PAGE_SIZE, pagePlanNotes, presentPlanNote } from "@/lib/plan-notes";
import { violationsForTerm } from "@/lib/plan-rule-check";
import { reviewNotesForCourse, toRuleCourse } from "@/lib/plan-rules";
import { catalogYearLabel, countNoun, personName, planTimestamp, plannedTermStatusLabel, plannedTermStatusVariant } from "@/lib/plan-status";
import { courseStandingBefore } from "@/lib/planned-term";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/student";
import type { Prisma } from "@/lib/generated/prisma/client";
import Link from "next/link";
import { SetPlanCrumb } from "../../../plan-crumb";
import { ReviewPanel } from "./ReviewPanel";

function Unavailable({ back }: { back: AdvisorReturnTarget }) {
    return (
        <div className="py-6">
            <SetPlanCrumb label="Unavailable" />
            <h1 className="text-4xl font-bold">Plan unavailable</h1>
            <p className="mt-2 max-w-prose text-sm text-muted-foreground">This plan does not exist or you do not have access to it.</p>
            <Button className="mt-4" nativeButton={false} render={<Link href={back.href}>{back.label}</Link>} />
        </div>
    );
}

export default async function AdvisorPlanPage({
    params,
    searchParams,
}: {
    params: Promise<{ plannedTermId: string }>;
    searchParams: Promise<{ from?: string }>;
}) {
    const [{ plannedTermId }, query, user] = await Promise.all([params, searchParams, getSessionUser()]);
    const back = advisorReturnTarget(query.from);
    const plan = await prisma.plannedTerm.findUnique({
        where: { id: plannedTermId },
        include: {
            term: true,
            student: {
                include: {
                    user: { select: { firstName: true, lastName: true } },
                    advisor: { select: { firstName: true, lastName: true } },
                    catalogYear: { select: { year: true } },
                },
            },
            courses: {
                include: {
                    course: {
                        select: {
                            id: true,
                            subject: true,
                            number: true,
                            title: true,
                            credits: true,
                            isLab: true,
                            offeredIn: true,
                            prerequisiteGroups: {
                                orderBy: { sortOrder: "asc" },
                                select: {
                                    isConcurrent: true,
                                    fromCatalog: true,
                                    note: true,
                                    options: {
                                        select: {
                                            requires: { select: { id: true, subject: true, number: true, isLab: true } },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    });
    if (!plan || plan.student.advisorId !== user.id) return <Unavailable back={back} />;

    const [standing, noteRows, violations] = await Promise.all([
        courseStandingBefore(plan.studentId, plan.term.startsOn),
        prisma.planNote.findMany({
            where: { plannedTermId: plan.id },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: NOTE_PAGE_SIZE + 1,
        }),
        plan.status === "SUBMITTED"
            ? violationsForTerm(prisma as unknown as Prisma.TransactionClient, plan.studentId, plan.id)
            : Promise.resolve([]),
    ]);
    const thread = pagePlanNotes(noteRows);
    const notes = thread.notes.map(presentPlanNote);
    const latestReturn = noteRows.find((note) => note.kind === "RETURN");
    const courses = [...plan.courses].sort((left, right) =>
        left.course.subject.localeCompare(right.course.subject)
        || left.course.number.localeCompare(right.course.number, undefined, { numeric: true })
        || left.course.id.localeCompare(right.course.id));
    const sameTerm = new Set(courses.map((row) => row.course.id));
    const credits = courses.reduce((total, row) => total + row.course.credits, 0);
    const studentName = personName(plan.student.user);
    const termLabel = academicTermLabel(plan.term);

    return (
        <div className="py-6">
            <Button variant="ghost" className="mb-4 px-0" nativeButton={false} render={<Link href={back.href}>{back.label}</Link>} />
            <SetPlanCrumb label={termLabel} />
            <header className="not-typeset mb-6">
                <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-3xl font-bold text-balance sm:text-4xl">{termLabel} plan</h1>
                    <Badge variant={plannedTermStatusVariant(plan.status)}>{plannedTermStatusLabel(plan.status)}</Badge>
                </div>
                <p className="mt-2 text-base font-medium text-foreground">
                    {studentName}
                    {plan.student.bannerId ? (
                        <span className="font-normal text-muted-foreground"> · Student ID: {plan.student.bannerId}</span>
                    ) : null}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                    {plan.submittedAt ? `Submitted ${planTimestamp(plan.submittedAt)}` : "Not submitted yet"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">Catalog year: {catalogYearLabel(plan.student.catalogYear.year)}</p>
                <p className="mt-1 text-sm text-muted-foreground">Advisor: {personName(plan.student.advisor)}</p>
                <p className="mt-1 text-sm text-muted-foreground">Last updated: {planTimestamp(plan.updatedAt)}</p>
            </header>
            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
                <div className="min-w-0 space-y-6 xl:col-start-1 xl:row-start-1">
                    <Card>
                        <CardHeader>
                            <CardTitle>Courses</CardTitle>
                            <CardDescription>{countNoun(courses.length, "course")} · {countNoun(credits, "credit")}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {courses.length === 0 ? (
                                <Empty className="border">
                                    <EmptyHeader>
                                        <EmptyTitle>No courses in this plan</EmptyTitle>
                                        <EmptyDescription>The student needs to add courses before this plan can be approved.</EmptyDescription>
                                    </EmptyHeader>
                                </Empty>
                            ) : (
                                <>
                                    <div className="hidden md:block">
                                        <Table className="table-fixed">
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-[8rem]">Course</TableHead>
                                                    <TableHead>Title</TableHead>
                                                    <TableHead className="w-[5rem] text-right">Credits</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {courses.map((row) => {
                                                    const notesForCourse = reviewNotesForCourse(toRuleCourse(row.course), sameTerm, standing.completedSources);
                                                    return (
                                                        <TableRow key={row.id}>
                                                            <TableCell>
                                                                <Badge className="font-mono whitespace-nowrap">{row.course.subject} {row.course.number}</Badge>
                                                            </TableCell>
                                                            <TableCell>
                                                                {row.course.title}
                                                                {notesForCourse.map((note) => (
                                                                    <span key={note} className="mt-1 block text-xs text-muted-foreground">{note}</span>
                                                                ))}
                                                            </TableCell>
                                                            <TableCell className="text-right tabular-nums">{row.course.credits}</TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    <ul className="m-0 list-none space-y-4 p-0 md:hidden">
                                        {courses.map((row) => {
                                            const notesForCourse = reviewNotesForCourse(toRuleCourse(row.course), sameTerm, standing.completedSources);
                                            return (
                                                <li key={row.id}>
                                                    <p className="flex items-center justify-between gap-3 text-sm">
                                                        <Badge className="font-mono whitespace-nowrap">{row.course.subject} {row.course.number}</Badge>
                                                        <span className="tabular-nums">{row.course.credits}</span>
                                                    </p>
                                                    <p className="mt-1 text-sm">{row.course.title}</p>
                                                    {notesForCourse.map((note) => (
                                                        <p key={note} className="mt-1 text-xs text-muted-foreground">{note}</p>
                                                    ))}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </>
                            )}
                            <RuleViolationAlert title="This plan cannot be approved" violations={violations} />
                        </CardContent>
                    </Card>
                </div>
                <div className="xl:col-start-2 xl:row-start-1">
                    <ReviewPanel
                        plannedTermId={plan.id}
                        status={plan.status}
                        revision={plan.revision}
                        studentName={studentName}
                        termLabel={termLabel}
                        registrationPin={plan.registrationPin}
                        reviewedAt={plan.reviewedAt?.toISOString() ?? null}
                        registeredAt={plan.registeredAt?.toISOString() ?? null}
                        canDecide={plan.student.advisorId === user.id}
                        courseCount={courses.length}
                    />
                </div>
                <div className="min-w-0 xl:col-start-1">
                    <PlanNotes
                        plannedTermId={plan.id}
                        audience="advisor"
                        advisorAssigned
                        notes={notes}
                        earlierCursor={thread.earlierCursor}
                        highlightId={latestReturn?.id ?? null}
                    />
                </div>
            </div>
        </div>
    );
}
