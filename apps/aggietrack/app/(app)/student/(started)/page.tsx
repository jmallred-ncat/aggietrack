import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { academicTermLabel, semesterInSession } from "@/lib/academic-term";
import { computeDegreeProgress } from "@/lib/degree-progress";
import { computeGpa } from "@/lib/gpa";
import { plannedTermStatusLabel, plannedTermStatusVariant, studentNextStep } from "@/lib/plan-status";
import { prisma } from "@/lib/prisma";
import { getTranscript } from "@/lib/transcript";
import { formatProgramName } from "@/lib/program";
import { getSessionUser, requireStudentProfile } from "@/lib/student";
import { CheckSquareIcon, FlaskIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

export default async function Dashboard() {
    const user = await getSessionUser();
    const profile = await requireStudentProfile();

    const now = new Date();
    const [terms, plans, progress, transcript, graduation] = await Promise.all([
        prisma.academicTerm.findMany({ orderBy: { startsOn: "asc" } }),
        prisma.plannedTerm.findMany({
            where: { studentId: profile.id },
            include: {
                term: true,
                courses: {
                    include: {
                        course: {
                            select: {
                                subject: true,
                                number: true,
                                title: true,
                                credits: true,
                                description: true,
                                isLab: true,
                            },
                        },
                    },
                    orderBy: [{ course: { subject: "asc" } }, { course: { number: "asc" } }],
                },
            },
        }),
        computeDegreeProgress(profile.id),
        getTranscript(),
        prisma.studentProfile.findUnique({
            where: { id: profile.id },
            select: { expectedGradTerm: { select: { season: true, year: true } } },
        }),
    ]);
    const gpa = computeGpa(transcript);
    const semester = semesterInSession(terms, now);
    const semesterPlan = plans
        .filter((plan) =>
            (plan.status === "SUBMITTED" || plan.status === "APPROVED" || plan.status === "RETURNED")
            && plan.term.startsOn <= now
            && plan.term.endsOn >= now,
        )
        .sort((a, b) =>
            (a.term.endsOn.getTime() - a.term.startsOn.getTime())
            - (b.term.endsOn.getTime() - b.term.startsOn.getTime()),
        )[0] ?? null;
    const draft = plans
        .filter((plan) => plan.status === "DRAFT" && plan.term.endsOn >= now)
        .sort((a, b) => a.term.startsOn.getTime() - b.term.startsOn.getTime())[0] ?? null;
    const otherPlan = plans
        .filter((plan) =>
            (plan.status === "SUBMITTED" || plan.status === "APPROVED" || plan.status === "RETURNED") && plan.term.startsOn > now,
        )
        .sort((a, b) => a.term.startsOn.getTime() - b.term.startsOn.getTime())[0] ?? null;
    const featured = semesterPlan && !(semesterPlan.status === "APPROVED" && semesterPlan.registeredAt)
        ? semesterPlan
        : draft ?? semesterPlan ?? otherPlan;
    const nextStep = studentNextStep(featured
        ? {
            termLabel: academicTermLabel(featured.term),
            status: featured.status,
            registered: featured.registeredAt != null,
            href: `/student/planner?term=${featured.termId}`,
        }
        : null);
    const target = graduation?.expectedGradTerm;

    return <div className="flex flex-col gap-6 py-6">
        <header className="not-typeset">
            <h1 className="text-3xl font-bold sm:text-4xl">Dashboard</h1>
            <p className="mt-2 text-base">Welcome back, {user.firstName}.</p>
            <p className="mt-1 text-sm text-muted-foreground">
                {formatProgramName(profile.catalogYear.program)} · {profile.catalogYear.year} catalog
            </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
            <Card>
                <CardHeader>
                    <CardTitle>Degree Completion</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-start gap-2">
                    <p className="text-2xl font-semibold tabular-nums">
                        {progress.earnedCredits} of {progress.totalCredits} Credits ({progress.percentage}%)
                    </p>
                    <Badge>Completed requirements</Badge>
                    <Badge variant="outline">{target ? `Target: ${academicTermLabel(target)}` : "Target not set"}</Badge>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Cumulative GPA</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-start gap-2">
                    <p className="text-2xl font-semibold tabular-nums">{gpa !== null ? gpa.toFixed(2) : "—"}</p>
                    <Badge variant="outline">{gpa !== null ? "Recorded grades" : "No grades yet"}</Badge>
                </CardContent>
            </Card>
        </section>

        <Card>
            <CardHeader>
                <CardTitle>{nextStep.title}</CardTitle>
                <CardDescription>{nextStep.body}</CardDescription>
            </CardHeader>
            <CardContent>
                <Button nativeButton={false} render={<Link href={nextStep.href}>{nextStep.action}</Link>} />
            </CardContent>
        </Card>

        <section className="not-typeset flex flex-col gap-6">
            <header className="flex items-center justify-between gap-3">
                <h2 className="text-2xl font-bold">{semester ? academicTermLabel(semester) : "No semester in session"}</h2>
                {semesterPlan ? (
                    <Badge variant={plannedTermStatusVariant(semesterPlan.status)}>
                        {plannedTermStatusLabel(semesterPlan.status)}
                    </Badge>
                ) : null}
            </header>

            {semesterPlan && semesterPlan.courses.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {semesterPlan.courses.map((row) => (
                        <div key={row.id} className="flex w-full flex-col items-start space-y-3 rounded-lg border border-border bg-muted p-4 not-typeset">
                            <div className="flex w-full items-center justify-between gap-2">
                                <Badge variant="default">{row.course.subject} {row.course.number}</Badge>
                                {row.course.isLab && <FlaskIcon size={20} weight="fill" />}
                            </div>
                            <h3 className="text-lg font-bold">{row.course.title}</h3>
                            <span className="text-sm text-muted-foreground">{row.course.credits} credits</span>
                            <p className="line-clamp-3 text-sm text-muted-foreground">{row.course.description}</p>
                        </div>
                    ))}
                </div>
            ) : (
                <Empty className="border border-dashed">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <CheckSquareIcon />
                        </EmptyMedia>
                        <EmptyTitle>{semesterPlan ? "No courses on this plan" : "No courses this semester"}</EmptyTitle>
                        <EmptyDescription>
                            {semesterPlan
                                ? `Your ${academicTermLabel(semesterPlan.term)} plan is ${plannedTermStatusLabel(semesterPlan.status)} and has no courses on it, so there is nothing in progress this semester.`
                                : draft
                                    ? `Your ${academicTermLabel(draft.term)} plan is ${plannedTermStatusLabel(draft.status)}. Open the planner, add the courses you want to take, and submit the plan so your advisor can review it. Those courses show here during that semester once the plan is waiting for review or approved.`
                                    : otherPlan
                                        ? `Your ${academicTermLabel(otherPlan.term)} plan is ${plannedTermStatusLabel(otherPlan.status)}. Its courses show here when that semester is in session.`
                                        : semester
                                            ? `${academicTermLabel(semester)} does not have a plan that is waiting for review or approved. Open the planner, add the courses for the term you are registering for, and submit that plan so your advisor can review it.`
                                            : "No semester is in session. Open the planner, add the courses for your next term, and submit that plan so your advisor can review it. Those courses show here once that semester begins."}
                        </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                        <Button nativeButton={false} render={<Link href="/student/planner">Open the planner</Link>} />
                    </EmptyContent>
                </Empty>
            )}
        </section>

        <Card>
            <CardHeader>
                <CardTitle>Advising notes</CardTitle>
            </CardHeader>
            <CardContent>
                <Empty className="border-0">
                    <EmptyHeader>
                        <EmptyTitle>No advising notes to show</EmptyTitle>
                        <EmptyDescription>Notes shared by your advisor will appear here.</EmptyDescription>
                    </EmptyHeader>
                </Empty>
            </CardContent>
        </Card>
    </div>;
}
