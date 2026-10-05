

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CircularProgress } from "@/components/ui/circular-progress";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { academicTermLabel, semesterInSession } from "@/lib/academic-term";
import { prisma } from "@/lib/prisma";
import { formatProgramName } from "@/lib/program";
import { getSessionUser, requireStudentProfile } from "@/lib/student";
import { CheckSquareIcon, FlaskIcon, GraduationCapIcon, MedalIcon, NoteIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

export default async function Dashboard() {
    const user = await getSessionUser();
    const profile = await requireStudentProfile();

    const now = new Date();
    const [terms, plans] = await Promise.all([
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
    ]);
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

    const notes = Array.from({ length: 6 }, (_, index) => (`Lorem ipsum dolor, sit amet consectetur adipisicing elit. Molestias eligendi magni obcaecati eum ex officia provident adipisci nobis error similique sequi quia magnam iusto animi minima harum, rem debitis odio praesentium voluptatem deleniti sunt impedit velit amet? Ipsam nobis est ipsum, quidem in saepe repellat fugiat fuga quos consequuntur, maxime incidunt aspernatur et officia recusandae necessitatibus. Accusamus nisi, eveniet autem repellat quaerat cupiditate eligendi assumenda adipisci cum dolorum, sapiente tempora quisquam sint obcaecati illum earum? ${index + 1}`));

    return <div className="flex flex-col gap-16 py-16">
        <section>
            <header className="not-typeset">
                <Badge>Overview</Badge>
                <h1 className="text-5xl font-bold">Student Overview</h1>
                <p className="text-lg text-muted-foreground max-w-prose w-full text-balance leading-tight mt-3">Welcome back, {user.firstName}. You are currently pursuing your {formatProgramName(profile.catalogYear.program)} degree at North Carolina Agricultural and Technical State University.</p>
            </header>

        </section>
        <section className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="flex flex-col items-center w-full rounded-lg bg-muted p-4 border border-border space-y-3 not-typeset">
                <span className="text-sm font-semibold">Degree Completion</span>
                <CircularProgress strokeWidth={16} size={120} value={0} max={profile.catalogYear.program.totalCredits} label labelClassName="text-2xl font-bold" />
                <p className="text-sm text-muted-foreground text-center leading-tight mt-1">0 of {profile.catalogYear.program.totalCredits} Credits</p>
                <div className="flex items-center justify-center">
                    <GraduationCapIcon weight="fill" size={24} className="text-primary mr-2" />
                    <Badge variant="default">Spring 2027</Badge>
                </div>
            </div>
            <div className="flex flex-col items-center w-full rounded-lg bg-muted p-4 border border-border space-y-2 not-typeset">
                <span className="text-sm font-semibold">Cumulative GPA</span>
                <h4 className="text-6xl font-bold flex-1 place-content-center">---</h4>
                <div className="flex items-center justify-center">
                    <MedalIcon weight="fill" size={24} className="text-primary mr-2" />
                    <Badge variant="default">To Be Determined</Badge>
                </div>
            </div>
        </section>

        <div className="flex flex-col @container @lg:flex-row gap-x-8 space-y-16">
            <section className="flex-1 not-typeset flex flex-col space-y-6">
                <header className="flex justify-between items-center gap-3">
                    <h2 className="text-2xl font-bold">In-Progress Courses</h2>
                    {semesterPlan && (
                        <Badge variant={semesterPlan.status === "APPROVED" ? "default" : "secondary"}>
                            {semesterPlan.status === "APPROVED" ? "Approved" : "Pending review"}
                        </Badge>
                    )}
                </header>

                {semesterPlan && semesterPlan.courses.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {semesterPlan.courses.map((row) => (
                            <div key={row.id} className="flex flex-col items-start w-full rounded-lg bg-muted p-4 border border-border space-y-3 not-typeset">
                                <div className="flex items-center justify-between gap-2 w-full">
                                    <Badge variant="default">{row.course.subject} {row.course.number}</Badge>
                                    {row.course.isLab && <FlaskIcon size={20} weight="fill" />}
                                </div>
                                <h3 className="text-lg font-bold">{row.course.title}</h3>
                                <span className="text-sm text-muted-foreground">{row.course.credits} credits</span>
                                <p className="text-sm text-muted-foreground line-clamp-3">{row.course.description}</p>
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
                                    ? `Your ${academicTermLabel(semesterPlan.term)} plan is ${semesterPlan.status === "APPROVED" ? "approved" : "waiting for your advisor"} and has no courses on it, so there is nothing in progress this semester.`
                                    : draft
                                        ? `Your ${academicTermLabel(draft.term)} plan is still a draft. Open the planner, add the courses you want to take, and submit the plan so your advisor can review it. Those courses show here during that semester once the plan is pending or approved.`
                                        : otherPlan
                                            ? `Your ${academicTermLabel(otherPlan.term)} plan is ${otherPlan.status === "APPROVED" ? "approved" : "waiting for review"}. Its courses show here when that semester is in session.`
                                            : semester
                                                ? `${academicTermLabel(semester)} does not have a pending or approved plan. Open the planner, add the courses for the term you are registering for, and submit that plan so your advisor can review it.`
                                                : "No semester is in session. Open the planner, add the courses for your next term, and submit that plan so your advisor can review it. Those courses show here once that semester begins."}
                            </EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                            <Button nativeButton={false} render={<Link href="/student/planner">Open the planner</Link>} />
                        </EmptyContent>
                    </Empty>
                )}
            </section>
            <section className="space-y-6">
                <header className="flex justify-between items-center not-typeset">
                    <h2 className="text-2xl font-bold">Advising Notes</h2>
                    <Button size="sm" variant="outline">View All Notes</Button>
                </header>


                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {notes.map((note, index) => (
                        <article key={index} className="flex flex-col items-start w-full rounded-lg bg-muted p-4 border border-border space-y-3 not-typeset">
                            <header className="flex justify-between items-center w-full">
                                <span className="items-center text-sm font-medium flex w-full">
                                    <NoteIcon size={16} className="mr-2" />
                                    <span className="text-sm font-medium">
                                        Oct 12, 2026
                                    </span>
                                </span>

                                <Badge variant="default">Academic</Badge>
                            </header>

                            <p className="text-sm text-muted-foreground max-w-prose w-full text-balance leading-tight line-clamp-3">
                                Lorem ipsum dolor, sit amet consectetur adipisicing elit. Molestias eligendi magni obcaecati eum ex officia provident adipisci nobis error similique sequi quia magnam iusto animi minima harum, rem debitis odio praesentium voluptatem deleniti sunt impedit velit amet? Ipsam nobis est ipsum, quidem in saepe repellat fugiat fuga quos consequuntur, maxime incidunt aspernatur et officia recusandae necessitatibus. Accusamus nisi, eveniet autem repellat quaerat cupiditate eligendi assumenda adipisci cum dolorum, sapiente tempora quisquam sint obcaecati illum earum?
                            </p>

                            <footer className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-2">
                                    <Avatar>
                                        <AvatarFallback>SH</AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm font-medium">
                                        Dr. Sarah H.<span className="text-xs text-muted-foreground">{" "}&mdash;{" "}Advisor</span>
                                    </span>
                                </div>
                                <Button size="sm" variant="outline">View</Button>
                            </footer>
                        </article>
                    ))}
                </div>
                <div>
                    <Button size="sm" variant="outline">Request New Meeting</Button>
                </div>
            </section>
        </div>

    </div>;
}