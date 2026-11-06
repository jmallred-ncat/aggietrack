import { DismissibleAlert } from "@/components/dismissible-alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { academicTermLabel } from "@/lib/academic-term";
import { advisorTermChoices } from "@/lib/advisor-roster";
import { presentPlanNote } from "@/lib/plan-notes";
import { countNoun, personInitials, personName, planDate, planTimestamp } from "@/lib/plan-status";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/student";
import Link from "next/link";

const QUEUE_LIMIT = 8;

type Tile = {
    title: string;
    value: number;
    badge: string;
    variant: "default" | "secondary" | "outline";
};

function tileBadge(count: number, filled: string, empty: string, variant: Tile["variant"]): Pick<Tile, "badge" | "variant"> {
    if (count > 0) return { badge: filled, variant };
    return { badge: empty, variant: "outline" };
}

async function loadAdvisorDashboard(advisorId: string) {
    const academicTerms = await prisma.academicTerm.findMany({ orderBy: { startsOn: "asc" } });
    const choices = advisorTermChoices(academicTerms);
    const term = choices.terms.find((item) => item.id === choices.defaultTermId) ?? null;
    const [students, notes] = await Promise.all([
        prisma.studentProfile.findMany({
            where: { advisorId },
            include: {
                user: { select: { firstName: true, lastName: true } },
                plannedTerms: {
                    where: { termId: term?.id ?? "__none__" },
                    include: {
                        courses: { select: { course: { select: { credits: true } } } },
                        notes: {
                            where: { kind: "RETURN" },
                            orderBy: { createdAt: "desc" },
                            take: 1,
                            select: { body: true },
                        },
                    },
                },
            },
            orderBy: [{ user: { lastName: "asc" } }, { user: { firstName: "asc" } }],
        }),
        prisma.planNote.findMany({
            where: { plannedTerm: { student: { advisorId } } },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 5,
            include: {
                plannedTerm: {
                    select: {
                        id: true,
                        term: { select: { season: true, year: true } },
                        student: { select: { user: { select: { firstName: true, lastName: true } } } },
                    },
                },
            },
        }),
    ]);
    return { term, students, notes };
}

function DashboardHeader({ firstName }: { firstName: string }) {
    return (
        <header className="not-typeset">
            <h1 className="text-3xl font-bold sm:text-4xl">Dashboard</h1>
            <p className="mt-2 text-base">Welcome back, {firstName}.</p>
            <p className="mt-1 text-sm text-muted-foreground">Advisor</p>
        </header>
    );
}

function CountTiles({ tiles }: { tiles: Tile[] }) {
    return (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {tiles.map((tile) => (
                <Card key={tile.title}>
                    <CardHeader>
                        <CardTitle>{tile.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-start gap-2">
                        <p className="text-2xl font-semibold tabular-nums">{tile.value}</p>
                        <Badge variant={tile.variant}>{tile.badge}</Badge>
                    </CardContent>
                </Card>
            ))}
        </section>
    );
}

export default async function AdvisorHomePage() {
    const user = await getSessionUser();
    let failed = false;
    let data: Awaited<ReturnType<typeof loadAdvisorDashboard>> | null = null;
    try {
        data = await loadAdvisorDashboard(user.id);
    } catch {
        failed = true;
    }

    if (failed || !data) {
        return (
            <div className="flex flex-col gap-6 py-6">
                <DashboardHeader firstName={user.firstName} />
                <DismissibleAlert
                    title="Dashboard could not be loaded"
                    description="Try again in a moment."
                    action={<Button nativeButton={false} size="sm" render={<Link href="/advisor">Try again</Link>} />}
                />
            </div>
        );
    }

    const termLabel = data.term ? academicTermLabel(data.term) : null;
    const waiting = data.students
        .flatMap((student) => {
            const plan = student.plannedTerms[0];
            if (!plan || plan.status !== "SUBMITTED") return [];
            return [{ student, plan }];
        })
        .sort((left, right) => (left.plan.submittedAt?.getTime() ?? 0) - (right.plan.submittedAt?.getTime() ?? 0));
    const returned = data.students
        .flatMap((student) => {
            const plan = student.plannedTerms[0];
            if (!plan || plan.status !== "RETURNED") return [];
            return [{ student, plan }];
        })
        .sort((left, right) => {
            const leftTime = left.plan.reviewedAt?.getTime() ?? left.plan.updatedAt.getTime();
            const rightTime = right.plan.reviewedAt?.getTime() ?? right.plan.updatedAt.getTime();
            return rightTime - leftTime;
        });
    const approved = data.students.filter((student) => student.plannedTerms[0]?.status === "APPROVED").length;
    const tiles: Tile[] = [
        {
            title: "Waiting for review",
            value: waiting.length,
            ...tileBadge(waiting.length, "Needs your review", "None waiting", "secondary"),
        },
        {
            title: "Changes requested",
            value: returned.length,
            ...tileBadge(returned.length, "Waiting on students", "None returned", "outline"),
        },
        {
            title: "Approved",
            value: approved,
            ...tileBadge(approved, "This term", "None approved", "default"),
        },
        {
            title: "Students",
            value: data.students.length,
            badge: "Assigned to you",
            variant: "outline",
        },
    ];
    const queue = waiting.slice(0, QUEUE_LIMIT);
    const recentNotes = data.notes.map((note) => ({
        note,
        shown: presentPlanNote(note),
        studentName: personName(note.plannedTerm.student.user),
        termLabel: academicTermLabel(note.plannedTerm.term),
    }));

    return (
        <div className="flex flex-col gap-6 py-6">
            <DashboardHeader firstName={user.firstName} />
            <CountTiles tiles={tiles} />
            {data.students.length === 0 ? (
                <Empty className="border border-dashed">
                    <EmptyHeader>
                        <EmptyTitle>No students assigned yet</EmptyTitle>
                        <EmptyDescription>Students assigned to you will appear here.</EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : (
                <>
                    <section className="not-typeset flex flex-col gap-3">
                        <header>
                            <h2 className="text-2xl font-bold">Waiting for review</h2>
                            <p className="text-sm text-muted-foreground">Oldest submissions first.</p>
                        </header>
                        {queue.length === 0 ? (
                            <Empty className="border border-dashed">
                                <EmptyHeader>
                                    <EmptyTitle>No plans waiting for review</EmptyTitle>
                                    <EmptyDescription>When a student submits a term plan, it shows up here, oldest first.</EmptyDescription>
                                </EmptyHeader>
                            </Empty>
                        ) : (
                            <>
                                <div className="hidden xl:block">
                                    <Card className="overflow-hidden py-0">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Student</TableHead>
                                                    <TableHead>Submitted</TableHead>
                                                    <TableHead>Plan</TableHead>
                                                    <TableHead>Action</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {queue.map(({ student, plan }) => {
                                                    const name = personName(student.user);
                                                    const credits = plan.courses.reduce((total, row) => total + row.course.credits, 0);
                                                    const submitted = plan.submittedAt ? planDate(plan.submittedAt) : null;
                                                    return (
                                                        <TableRow key={plan.id}>
                                                            <TableCell className="align-top">
                                                                <p className="text-base font-medium">{name}</p>
                                                                {termLabel ? <p className="mt-1 text-sm text-muted-foreground">{termLabel}</p> : null}
                                                            </TableCell>
                                                            <TableCell className="align-top whitespace-nowrap">
                                                                {submitted ? `Submitted ${submitted}` : "Submitted"}
                                                            </TableCell>
                                                            <TableCell className="align-top text-sm text-muted-foreground">
                                                                {countNoun(plan.courses.length, "course")} · {countNoun(credits, "credit")}
                                                            </TableCell>
                                                            <TableCell className="align-top whitespace-nowrap">
                                                                <ReviewPlanLink planId={plan.id} name={name} termLabel={termLabel} />
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </Card>
                                </div>
                                <div className="space-y-4 xl:hidden">
                                    {queue.map(({ student, plan }) => {
                                        const name = personName(student.user);
                                        const credits = plan.courses.reduce((total, row) => total + row.course.credits, 0);
                                        const submitted = plan.submittedAt ? planDate(plan.submittedAt) : null;
                                        return (
                                            <Card key={plan.id}>
                                                <CardHeader>
                                                    <p className="text-base font-medium">{name}</p>
                                                    {termLabel ? <p className="text-sm text-muted-foreground">{termLabel}</p> : null}
                                                </CardHeader>
                                                <CardContent>
                                                    <p className="text-sm text-muted-foreground">{submitted ? `Submitted ${submitted}` : "Submitted"}</p>
                                                    <p className="mt-1 text-sm text-muted-foreground">
                                                        {countNoun(plan.courses.length, "course")} · {countNoun(credits, "credit")}
                                                    </p>
                                                </CardContent>
                                                <CardFooter>
                                                    <ReviewPlanLink planId={plan.id} name={name} termLabel={termLabel} wide />
                                                </CardFooter>
                                            </Card>
                                        );
                                    })}
                                </div>
                                {waiting.length > QUEUE_LIMIT ? (
                                    <Link href="/advisor/students?status=waiting" className="text-sm font-medium underline underline-offset-4">
                                        See all waiting plans
                                    </Link>
                                ) : null}
                            </>
                        )}
                    </section>
                    <div className={returned.length > 0 ? "grid items-start gap-6 xl:grid-cols-2" : undefined}>
                        {returned.length > 0 ? (
                            <section className="not-typeset flex flex-col gap-3">
                                <header>
                                    <h2 className="text-2xl font-bold">Waiting on students</h2>
                                    <p className="text-sm text-muted-foreground">These students have a returned plan to update.</p>
                                </header>
                                <ul className="m-0 list-none space-y-3 p-0">
                                    {returned.map(({ student, plan }) => {
                                        const name = personName(student.user);
                                        const when = planDate(plan.reviewedAt ?? plan.updatedAt);
                                        const comment = plan.notes[0]?.body.trim();
                                        return (
                                            <li key={plan.id} className="rounded-lg border border-border bg-muted p-4">
                                                <div className="flex flex-wrap items-start justify-between gap-3">
                                                    <div>
                                                        <p className="text-base font-medium">{name}</p>
                                                        {termLabel ? <p className="mt-1 text-sm text-muted-foreground">{termLabel}</p> : null}
                                                        <p className="mt-1 text-sm text-muted-foreground">{when ? `Returned ${when}` : "Returned"}</p>
                                                    </div>
                                                    <Button
                                                        variant="outline"
                                                        nativeButton={false}
                                                        render={(
                                                            <Link href={`/advisor/plans/${plan.id}`} aria-label={`View plan for ${name}${termLabel ? `, ${termLabel}` : ""}`}>
                                                                View plan
                                                            </Link>
                                                        )}
                                                    />
                                                </div>
                                                {comment ? (
                                                    <p className="mt-2 line-clamp-1 text-sm [overflow-wrap:anywhere]">{comment}</p>
                                                ) : null}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </section>
                        ) : null}
                        {recentNotes.length === 0 ? (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Recent notes</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Empty className="border-0">
                                        <EmptyHeader>
                                            <EmptyTitle>No notes yet</EmptyTitle>
                                            <EmptyDescription>Notes you and your students post on a plan appear here.</EmptyDescription>
                                        </EmptyHeader>
                                    </Empty>
                                </CardContent>
                            </Card>
                        ) : (
                            <section className="not-typeset flex flex-col gap-3">
                                <h2 className="text-2xl font-bold">Recent notes</h2>
                                <ol className="m-0 list-none space-y-3 p-0">
                                    {recentNotes.map(({ note, shown, studentName, termLabel: noteTerm }) => (
                                        <li key={note.id}>
                                            <Link href={`/advisor/plans/${note.plannedTerm.id}`} className="flex gap-3 rounded-lg p-3 hover:bg-muted">
                                                <Avatar aria-hidden="true">
                                                    <AvatarFallback>{personInitials(shown.authorName)}</AvatarFallback>
                                                </Avatar>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block text-sm">
                                                        <span className="font-medium">{shown.authorName}</span>
                                                        <span className="text-muted-foreground"> · {shown.roleLabel}</span>
                                                        <span className="text-muted-foreground"> · {planTimestamp(shown.createdAt)}</span>
                                                    </span>
                                                    {shown.badge ? <Badge variant="outline" className="mt-2">{shown.badge}</Badge> : null}
                                                    <span className="mt-1 block line-clamp-3 text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">
                                                        {shown.eventLabel ?? shown.body}
                                                    </span>
                                                    <span className="mt-1 block text-sm text-muted-foreground">
                                                        On {studentName}&apos;s {noteTerm} plan
                                                    </span>
                                                </span>
                                            </Link>
                                        </li>
                                    ))}
                                </ol>
                            </section>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

function ReviewPlanLink({
    planId,
    name,
    termLabel,
    wide = false,
}: {
    planId: string;
    name: string;
    termLabel: string | null;
    wide?: boolean;
}) {
    return (
        <Button
            className={wide ? "h-11 w-full" : undefined}
            nativeButton={false}
            render={(
                <Link href={`/advisor/plans/${planId}`} aria-label={`Review plan for ${name}${termLabel ? `, ${termLabel}` : ""}`}>
                    Review plan
                </Link>
            )}
        />
    );
}
