"use client";

import { AdvisorBoard } from "@/components/advising/advisor-board";
import { StudentBoard } from "@/components/advising/student-board";
import { MeetingTime } from "@/components/advising/meeting-time";
import { DashboardTiles } from "@/components/dashboard-tiles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
    advisorAvailability,
    advisorEmpty,
    studentBooked,
    studentCanceled,
    studentLong,
    studentOpen,
    studentRescheduled,
    studentUnassigned,
    studentZoom,
} from "@/lib/advising-fixtures";
import type { MeetingResult, OpenSlotChoice } from "@/lib/advising-types";
import { ThemeLock } from "./theme-lock";

const ok = async (): Promise<MeetingResult> => ({ ok: true });
const openChoices = async (): Promise<OpenSlotChoice[]> => studentOpen.slots;
const staleFail: MeetingResult = {
    ok: false,
    code: "stale",
    title: "That time is no longer open",
    description: "Someone booked it, or it was removed. Pick another time.",
};
const rescheduleFail: MeetingResult = {
    ok: false,
    code: "reschedule",
    title: "Session could not be rescheduled",
    description: "Your original time is unchanged.",
};
const bookedFail: MeetingResult = {
    ok: false,
    code: "booked",
    title: "This time has a booked session",
    description: "Avery Cole is booked on Tuesday, November 10, 2026, 3:00–3:20 PM EST. Cancel or reschedule that session first. Removing other open times does not change the booking.",
    sessionId: "session-confirmed",
};

function sceneView(scene: string) {
    const studentActions = {
        book: scene === "conflict" ? async () => staleFail : scene === "pending" ? () => new Promise<MeetingResult>(() => {}) : async () => ok(),
        cancel: async () => ok(),
        reschedule: async () => ok(),
        choices: openChoices,
    };
    const advisorActions = {
        saveDuration: async () => ok(),
        addWindow: async () => ok(),
        addOne: async () => ok(),
        move: async () => ok(),
        remove: scene === "availability-conflict" ? async () => bookedFail : async () => ok(),
        cancel: async () => ok(),
        reschedule: scene === "reschedule-fail" ? async () => rescheduleFail : async () => ok(),
        choices: openChoices,
        saveZoom: async () => ok(),
        removeZoom: async () => ok(),
    };
    switch (scene) {
        case "student-booked":
            return { role: "STUDENT" as const, name: "Avery Cole", crumb: "Advising", board: <StudentBoard view={studentBooked} actions={studentActions} /> };
        case "student-empty":
            return { role: "STUDENT" as const, name: "Avery Cole", crumb: "Advising", board: <StudentBoard view={{ ...studentOpen, slots: [] }} actions={studentActions} /> };
        case "student-unassigned":
            return { role: "STUDENT" as const, name: "Avery Cole", crumb: "Advising", board: <StudentBoard view={studentUnassigned} actions={studentActions} /> };
        case "student-canceled":
            return { role: "STUDENT" as const, name: "Avery Cole", crumb: "Advising", board: <StudentBoard view={studentCanceled} actions={studentActions} /> };
        case "student-reschedule":
            return { role: "STUDENT" as const, name: "Avery Cole", crumb: "Advising", board: <StudentBoard view={studentRescheduled} actions={studentActions} /> };
        case "student-zoom":
            return { role: "STUDENT" as const, name: "Avery Cole", crumb: "Advising", board: <StudentBoard view={studentZoom} actions={studentActions} /> };
        case "student-long":
            return { role: "STUDENT" as const, name: "Avery Cole", crumb: "Advising", board: <StudentBoard view={studentLong} actions={studentActions} /> };
        case "advisor-availability":
        case "reschedule-fail":
        case "availability-conflict":
            return { role: "ADVISOR" as const, name: "Sarah Martinez", crumb: "Appointments", board: <AdvisorBoard view={advisorAvailability} actions={advisorActions} nowIso="2026-11-08T15:00:00.000Z" /> };
        case "advisor-empty":
            return { role: "ADVISOR" as const, name: "Sarah Martinez", crumb: "Appointments", board: <AdvisorBoard view={advisorEmpty} actions={advisorActions} nowIso="2026-11-08T15:00:00.000Z" /> };
        case "student-dashboard":
            return { role: "STUDENT" as const, name: "Avery Cole", crumb: "Dashboard", board: <StudentDashboardFixture /> };
        case "advisor-dashboard":
            return { role: "ADVISOR" as const, name: "Sarah Martinez", crumb: "Dashboard", board: <AdvisorDashboardFixture /> };
        case "session-unavailable":
            return { role: "STUDENT" as const, name: "Avery Cole", crumb: "Advising", board: <UnavailableFixture /> };
        case "conflict":
        case "pending":
            return { role: "STUDENT" as const, name: "Avery Cole", crumb: "Advising", board: <StudentBoard view={studentOpen} actions={studentActions} /> };
        default:
            return { role: "STUDENT" as const, name: "Avery Cole", crumb: "Advising", board: <StudentBoard view={studentOpen} actions={studentActions} /> };
    }
}

function UnavailableFixture() {
    return (
        <div className="not-typeset flex flex-col gap-4 py-6">
            <h1 className="text-3xl font-bold text-balance sm:text-4xl">This session is unavailable</h1>
            <p>It does not exist or you do not have access to it.</p>
            <Button nativeButton={false} variant="outline" render={<a href="/student/advising">Back to advising</a>} />
        </div>
    );
}

function StudentDashboardFixture() {
    return (
        <div className="flex flex-col gap-6 py-6">
            <header className="not-typeset">
                <h1 className="text-3xl font-bold sm:text-4xl">Dashboard</h1>
                <p className="mt-2 text-base">Welcome back, Avery.</p>
                <p className="mt-1 text-sm text-muted-foreground">B.S. Information Technology · 2025 catalog</p>
            </header>
            <DashboardTiles earnedCredits={48} totalCredits={120} percentage={40} targetLabel="Spring 2028" gpa={3.42} honor="Cum Laude" honorEligible />
            <Card>
                <CardHeader>
                    <CardTitle>Next step</CardTitle>
                    <CardDescription>Your Fall 2026 plan is waiting for review.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button nativeButton={false} render={<a href="/student/planner">Open planner</a>} />
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Upcoming advising</CardTitle>
                    <CardDescription>
                        <MeetingTime dateLabel="Tuesday, November 10, 2026" timeLabel="2:00–2:30 PM EST" iso="2026-11-10T19:00:00.000Z" full="Tuesday, November 10, 2026, 2:00–2:30 PM EST" />
                        {" with Sarah Martinez"}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button nativeButton={false} render={<a href="/student/advising?session=session-confirmed">View session</a>} />
                </CardContent>
            </Card>
        </div>
    );
}

function AdvisorDashboardFixture() {
    const tiles = [
        ["Waiting for review", "2", "Needs your review", "secondary"],
        ["Changes requested", "1", "Waiting on students", "outline"],
        ["Approved", "4", "This term", "default"],
        ["Students", "6", "Assigned to you", "outline"],
    ] as const;
    return (
        <div className="flex flex-col gap-6 py-6">
            <header className="not-typeset">
                <h1 className="text-3xl font-bold sm:text-4xl">Dashboard</h1>
                <p className="mt-2 text-base">Welcome back, Sarah.</p>
                <p className="mt-1 text-sm text-muted-foreground">Advisor</p>
            </header>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {tiles.map(([title, value, badge, variant]) => (
                    <Card key={title}>
                        <CardHeader>
                            <CardTitle>{title}</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col items-start gap-2">
                            <p className="text-2xl font-semibold tabular-nums">{value}</p>
                            <Badge variant={variant}>{badge}</Badge>
                        </CardContent>
                    </Card>
                ))}
            </section>
            <section className="not-typeset flex flex-col gap-3">
                <h2 className="text-2xl font-bold">Upcoming sessions</h2>
                <ul>
                    <li className="flex flex-wrap items-center justify-between gap-2">
                        <span>Avery Cole</span>
                        <time dateTime="2026-11-10T19:00:00.000Z" className="whitespace-nowrap text-sm">2:00–2:30 PM EST</time>
                        <Button variant="outline" nativeButton={false} render={<a href="/advisor/appointments">View</a>} />
                    </li>
                </ul>
            </section>
            <section className="not-typeset flex flex-col gap-3">
                <header>
                    <h2 className="text-2xl font-bold">Waiting for review</h2>
                    <p className="text-sm text-muted-foreground">Oldest submissions first.</p>
                </header>
                <Empty className="border border-dashed">
                    <EmptyHeader>
                        <EmptyTitle>No plans waiting for review</EmptyTitle>
                        <EmptyDescription>When a student submits a term plan, it shows up here, oldest first.</EmptyDescription>
                    </EmptyHeader>
                </Empty>
            </section>
        </div>
    );
}

export function EvidenceBoard({ scene, theme }: { scene: string; theme: "light" | "dark" }) {
    const view = sceneView(scene);
    return (
        <>
            <ThemeLock theme={theme} />
            {view.board}
        </>
    );
}
