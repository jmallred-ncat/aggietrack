

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CircularProgress } from "@/components/ui/circular-progress";
import { formatProgramName } from "@/lib/program";
import { getSessionUser, getStudentProfile } from "@/lib/student";
import { GraduationCapIcon, MedalIcon, NoteIcon } from "@phosphor-icons/react/dist/ssr";
import { redirect } from "next/navigation";

export default async function Dashboard() {
    const user = await getSessionUser();

    const profile = await getStudentProfile();

    if (!profile) {
        if (user.role === "STUDENT") {
            return redirect("/onboarding");
        }

        return (
            <div className="flex flex-col gap-16 py-16">
                <section>
                    <header className="not-typeset">
                        <Badge>Overview</Badge>
                        <h1 className="text-5xl font-bold">Dashboard</h1>
                        <p className="text-lg text-muted-foreground max-w-prose w-full text-balance leading-tight mt-3">
                            Welcome back, {user.firstName}.
                        </p>
                    </header>
                </section>
            </div>
        )
    }

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
                <CircularProgress strokeWidth={16} size={120} value={102} max={120} label labelClassName="text-2xl font-bold" />
                <p className="text-sm text-muted-foreground text-center leading-tight mt-1">102 of 120 Credits</p>
                <div className="flex items-center justify-center">
                    <GraduationCapIcon weight="fill" size={24} className="text-primary mr-2" />
                    <Badge variant="default">Spring 2027</Badge>
                </div>
            </div>
            <div className="flex flex-col items-center w-full rounded-lg bg-muted p-4 border border-border space-y-2 not-typeset">
                <span className="text-sm font-semibold">Cumulative GPA</span>
                <h4 className="text-6xl font-bold flex-1 place-content-center">3.82</h4>
                <div className="flex items-center justify-center">
                    <MedalIcon weight="fill" size={24} className="text-primary mr-2" />
                    <Badge variant="default">Summa Cum Laude</Badge>
                </div>
            </div>
        </section>

        <div className="flex flex-col @container @lg:flex-row gap-x-8 space-y-16">
            <section className="flex-1 not-typeset flex flex-col space-y-6">
                <header className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold">In-Progress Courses</h2>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col items-start w-full rounded-lg bg-muted p-4 border border-border space-y-3 not-typeset">
                        <Badge variant="default">CST 100</Badge>
                        <h3 className="text-lg font-bold">Course Name</h3>
                        <p className="text-sm text-muted-foreground">Course Description</p>
                    </div>
                    <div className="flex flex-col items-start w-full rounded-lg bg-muted p-4 border border-border space-y-3 not-typeset">
                        <Badge variant="default">CST 100</Badge>
                        <h3 className="text-lg font-bold">Course Name</h3>
                        <p className="text-sm text-muted-foreground">Course Description</p>
                    </div>
                    <div className="flex flex-col items-start w-full rounded-lg bg-muted p-4 border border-border space-y-3 not-typeset">
                        <Badge variant="default">CST 100</Badge>
                        <h3 className="text-lg font-bold">Course Name</h3>
                        <p className="text-sm text-muted-foreground">Course Description</p>
                    </div>
                    <div className="flex flex-col items-start w-full rounded-lg bg-muted p-4 border border-border space-y-3 not-typeset">
                        <Badge variant="default">CST 100</Badge>
                        <h3 className="text-lg font-bold">Course Name</h3>
                        <p className="text-sm text-muted-foreground">Course Description</p>
                    </div>
                </div>
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