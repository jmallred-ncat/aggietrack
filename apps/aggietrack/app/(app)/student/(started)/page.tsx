import { MeetingTime } from "@/components/advising/meeting-time";
import { DashboardTiles } from "@/components/dashboard-tiles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { academicTermLabel, semesterInSession } from "@/lib/academic-term";
import { studentUpcoming } from "@/lib/advising-meetings";
import { computeDegreeProgress } from "@/lib/degree-progress";
import { computeGpa, computeHonors } from "@/lib/gpa";
import { coursesAreInProgress, dashboardCoursePlan, plannedTermStatusLabel, plannedTermStatusVariant, studentNextStep } from "@/lib/plan-status";
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
    const honors = computeHonors(transcript);
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
    const advising = await studentUpcoming(prisma, user.id, now).catch(() => null);
    const listed = dashboardCoursePlan({ semesterPlan, laterPlan: otherPlan });
    const headingTerm = listed.primary?.term ?? semester;

    return <div className="flex flex-col gap-6 py-6">
        <header className="not-typeset">
            <h1 className="text-3xl font-bold sm:text-4xl">Dashboard</h1>
            <p className="mt-2 text-base">Welcome back, {user.firstName}.</p>
            <p className="mt-1 text-sm text-muted-foreground">
                {formatProgramName(profile.catalogYear.program)} · {profile.catalogYear.year} catalog
            </p>
        </header>

        <DashboardTiles
            earnedCredits={progress.earnedCredits}
            totalCredits={progress.totalCredits}
            percentage={progress.percentage}
            targetLabel={target ? academicTermLabel(target) : null}
            gpa={gpa}
            honor={honors.honor}
            honorEligible={honors.eligible}
        />

        <Card>
            <CardHeader>
                <CardTitle>{nextStep.title}</CardTitle>
                <CardDescription>{nextStep.body}</CardDescription>
            </CardHeader>
            <CardContent>
                <Button nativeButton={false} render={<Link href={nextStep.href}>{nextStep.action}</Link>} />
            </CardContent>
        </Card>

        {advising ? (
            <Card>
                <CardHeader>
                    <CardTitle>Upcoming advising</CardTitle>
                    <CardDescription>
                        <MeetingTime dateLabel={advising.dateLabel} timeLabel={advising.timeLabel} iso={advising.iso} full={`${advising.dateLabel}, ${advising.timeLabel}`} />
                        {` with ${advising.personName}`}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button nativeButton={false} render={<Link href={`/student/advising?session=${advising.id}`}>View session</Link>} />
                </CardContent>
            </Card>
        ) : null}

        <section className="not-typeset flex flex-col gap-6">
            <header className="flex items-center justify-between gap-3">
                <h2 className="text-2xl font-bold">{headingTerm ? academicTermLabel(headingTerm) : "No semester in session"}</h2>
                {listed.primary ? (
                    <Badge variant={plannedTermStatusVariant(listed.primary.status)}>
                        {plannedTermStatusLabel(listed.primary.status)}
                    </Badge>
                ) : null}
            </header>

            {listed.primary ? (
                <CourseCards courses={listed.primary.courses} inProgress={coursesAreInProgress(listed.primary.status)} />
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
                                        ? otherPlan.status === "APPROVED"
                                            ? `Your ${academicTermLabel(otherPlan.term)} plan is ${plannedTermStatusLabel(otherPlan.status)} and has no courses on it, so there is nothing in progress yet.`
                                            : `Your ${academicTermLabel(otherPlan.term)} plan is ${plannedTermStatusLabel(otherPlan.status)}. Its courses show here when that semester is in session.`
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
            {listed.also ? (
                <div className="flex flex-col gap-6">
                    <header className="flex items-center justify-between gap-3">
                        <h2 className="text-2xl font-bold">{academicTermLabel(listed.also.term)}</h2>
                        <Badge variant={plannedTermStatusVariant(listed.also.status)}>
                            {plannedTermStatusLabel(listed.also.status)}
                        </Badge>
                    </header>
                    <CourseCards courses={listed.also.courses} inProgress />
                </div>
            ) : null}
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

function CourseCards({
    courses,
    inProgress,
}: {
    courses: Array<{
        id: string;
        course: {
            subject: string;
            number: string;
            title: string;
            credits: number;
            description: string | null;
            isLab: boolean;
        };
    }>;
    inProgress: boolean;
}) {
    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {courses.map((row) => (
                <div key={row.id} className="flex w-full flex-col items-start space-y-3 rounded-lg border border-border bg-muted p-4 not-typeset">
                    <div className="flex w-full items-center justify-between gap-2">
                        <Badge variant="default">{row.course.subject} {row.course.number}</Badge>
                        <span className="flex items-center gap-2">
                            {inProgress ? <Badge variant="secondary">In progress</Badge> : null}
                            {row.course.isLab ? <FlaskIcon size={20} weight="fill" /> : null}
                        </span>
                    </div>
                    <h3 className="text-lg font-bold">{row.course.title}</h3>
                    <span className="text-sm text-muted-foreground">{row.course.credits} credits</span>
                    <p className="line-clamp-3 text-sm text-muted-foreground">{row.course.description}</p>
                </div>
            ))}
        </div>
    );
}
