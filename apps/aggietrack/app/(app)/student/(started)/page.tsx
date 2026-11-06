

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { academicTermLabel, semesterInSession } from "@/lib/academic-term";
import { computeDegreeProgress } from "@/lib/degree-progress";
import { planStatusBadgeVariant, planStatusLabel } from "@/lib/enum-labels";
import { computeGpa } from "@/lib/gpa";
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
    const [terms, plans, progress, transcript, gradTerm] = await Promise.all([
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
        profile.expectedGradTermId
            ? prisma.academicTerm.findUnique({
                where: { id: profile.expectedGradTermId },
                select: { season: true, year: true },
            })
            : Promise.resolve(null),
    ]);
    const gpa = computeGpa(transcript);
    const semester = semesterInSession(terms, now);
    const semesterPlan = plans
        .filter((plan) =>
            (plan.status === "SUBMITTED" || plan.status === "APPROVED")
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
            (plan.status === "SUBMITTED" || plan.status === "APPROVED") && plan.term.startsOn > now,
        )
        .sort((a, b) => a.term.startsOn.getTime() - b.term.startsOn.getTime())[0] ?? null;

    const featured = semesterPlan ?? draft ?? otherPlan;
    const next = nextStep(featured, semester);

    return <div className="flex flex-col gap-6 py-6">
        <header className="not-typeset">
            <h1 className="text-3xl font-bold sm:text-4xl">Dashboard</h1>
            <p className="mt-2 max-w-prose text-sm text-balance text-muted-foreground sm:text-base">
                Welcome back, {user.firstName}. {formatProgramName(profile.catalogYear.program)} · {profile.catalogYear.year} catalog
            </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
            <Card>
                <CardHeader>
                    <CardTitle>Degree Completion</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-start gap-3">
                    <p className="text-2xl font-bold tabular-nums">{progress.earnedCredits} of {progress.totalCredits} Credits ({progress.percentage}%)</p>
                    <Badge>Completed requirements</Badge>
                    {gradTerm ? <Badge variant="outline">Target: {academicTermLabel(gradTerm)}</Badge> : null}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Cumulative GPA</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-start gap-3">
                    <p className="text-2xl font-bold tabular-nums">{gpa !== null ? gpa.toFixed(2) : "—"}</p>
                    <Badge variant="outline">{gpa !== null ? "Recorded grades" : "No grades yet"}</Badge>
                </CardContent>
            </Card>
        </section>

        <Card>
            <CardHeader>
                <CardTitle>Next step</CardTitle>
                <CardDescription>{next.sentence}</CardDescription>
            </CardHeader>
            <CardContent>
                <Button nativeButton={false} render={<Link href={next.href}>{next.label}</Link>} />
            </CardContent>
        </Card>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <section className="flex min-w-0 flex-1 flex-col gap-4 not-typeset">
                <header className="flex items-center justify-between gap-3">
                    <h2 className="text-2xl font-bold">{semester ? academicTermLabel(semester) : "No semester in session"}</h2>
                    {semesterPlan ? (
                        <Badge variant={planStatusBadgeVariant(semesterPlan.status)}>
                            {planStatusLabel(semesterPlan.status)}
                        </Badge>
                    ) : null}
                </header>

                {semesterPlan && semesterPlan.courses.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {semesterPlan.courses.map((row) => (
                            <div key={row.id} className="flex w-full flex-col items-start gap-3 rounded-lg border border-border bg-muted p-4 not-typeset">
                                <div className="flex w-full items-center justify-between gap-2">
                                    <Badge variant="default">{row.course.subject} {row.course.number}</Badge>
                                    {row.course.isLab && <FlaskIcon size={20} weight="fill" />}
                                </div>
                                <h3 className="text-lg font-bold text-balance">{row.course.title}</h3>
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
                                    ? `Your ${academicTermLabel(semesterPlan.term)} plan is ${planStatusLabel(semesterPlan.status).toLowerCase()} and has no courses on it.`
                                    : "Courses show here when a plan is waiting for review or approved for the semester in session."}
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                )}
            </section>
            <Card className="w-full lg:max-w-sm">
                <CardHeader>
                    <CardTitle>Advising notes</CardTitle>
                </CardHeader>
                <CardContent>
                    <Empty className="border-0 p-0">
                        <EmptyHeader>
                            <EmptyTitle>No advising notes to show</EmptyTitle>
                            <EmptyDescription>Notes shared by your advisor will appear here.</EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                </CardContent>
            </Card>
        </div>
    </div>;
}

function nextStep(
    plan: {
        status: string;
        registeredAt: Date | null;
        termId: string;
        term: { season: Parameters<typeof academicTermLabel>[0]["season"]; year: number };
    } | null,
    semester: { season: Parameters<typeof academicTermLabel>[0]["season"]; year: number } | null,
) {
    if (!plan) {
        return {
            sentence: semester
                ? `${academicTermLabel(semester)} does not have a plan yet. Add your courses and submit them for review.`
                : "Add the courses for your next term and submit that plan for review.",
            href: "/student/planner",
            label: "Continue plan",
        };
    }

    const term = academicTermLabel(plan.term);
    const href = `/student/planner?term=${plan.termId}`;
    if (plan.status === "APPROVED" && plan.registeredAt) {
        return { sentence: `You confirmed registration for ${term}.`, href, label: "View plan" };
    }
    if (plan.status === "APPROVED") {
        return {
            sentence: `Your ${term} plan is approved. Register with your pin, then confirm in the planner.`,
            href,
            label: "Open approved plan",
        };
    }
    if (plan.status === "SUBMITTED") {
        return { sentence: `Your ${term} plan is waiting for your advisor's review.`, href, label: "View plan" };
    }
    if (plan.status === "DRAFT") {
        return { sentence: `Your ${term} plan is a draft. Add your courses and submit it for review.`, href, label: "Continue plan" };
    }
    return { sentence: "Status unavailable. Open the planner to see this term.", href, label: "View plan" };
}