import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getProgressSlotCourses, type ProgressSlotCourse } from "@/lib/catalog";
import { computeDegreeProgress } from "@/lib/degree-progress";
import type { TranscriptSource, TranscriptStatus } from "@/lib/generated/prisma/browser";
import { computeGpa } from "@/lib/gpa";
import { loggedRequirementCredits } from "@/lib/logged-credits";
import { getCurriculumRecommendations, planPosition, requirementGroupTitle, requirementSlotBadge } from "@/lib/planner";
import { prisma } from "@/lib/prisma";
import { formatProgramName } from "@/lib/program";
import { slotIsUnfilled } from "@/lib/progress-slots";
import { getStudentProfile, hasConfirmedStart } from "@/lib/student";
import { getTranscript, progressStatusFromEntry, type ProgressStatus } from "@/lib/transcript";
import { ArrowsLeftRightIcon, CheckCircleIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import ProgressForm, { type ProgressTerm, type ProgressYear } from "./ProgressForm";
import { RequirementSummary } from "./RequirementSummary";

const emptySlot = {
    courseId: "",
    subject: "",
    number: "",
    title: "",
    credits: "",
    status: "" as const,
};

const courseStatuses = [
    { value: "complete", label: "Complete", detail: "Completed at NCA&T", icon: CheckCircleIcon },
    { value: "transfer", label: "Transfer", detail: "Credit from another school", icon: ArrowsLeftRightIcon },
] as const;

function StatusLegend() {
    return (
        <dl className="not-typeset mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {courseStatuses.map(({ value, label, detail, icon: Icon }) => (
                <div key={value} className="flex w-full items-center gap-2.5 rounded-lg bg-muted py-1.5 pr-3.5 pl-1.5 sm:w-auto">
                    <span className="inline-flex size-7 items-center justify-center rounded-[10px] bg-accent text-accent-foreground">
                        <Icon className="size-4" />
                    </span>
                    <div className="leading-tight">
                        <dt className="text-sm font-medium text-foreground">{label}</dt>
                        <dd className="text-xs text-muted-foreground">{detail}</dd>
                    </div>
                </div>
            ))}
        </dl>
    );
}

type TranscriptAttempt = {
    id: string;
    grade: string | null;
    status: TranscriptStatus;
    source: TranscriptSource;
    createdAt: Date;
};

export default async function ProgressPage() {
    const profile = await getStudentProfile();
    if (!profile) {
        return (
            <div className="flex min-h-full flex-1 flex-col">
                <header>
                    <h1>Your Degree Progress</h1>
                    <p className="max-w-prose text-sm text-balance text-muted-foreground">A student profile is required to view degree progress.</p>
                </header>
            </div>
        );
    }

    const [transcript, curriculum, slotCourses, progress, requirementGroups] = await Promise.all([
        getTranscript(),
        getCurriculumRecommendations(),
        getProgressSlotCourses(),
        computeDegreeProgress(profile.id),
        prisma.requirementGroup.findMany({
            where: { catalogYearId: profile.catalogYearId },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            select: {
                id: true,
                name: true,
                minCredits: true,
                sortOrder: true,
                items: { select: { courseId: true } },
            },
        }),
    ]);
    const slotIds = transcript.flatMap((entry) => entry.recommendedTermCourseId ? [entry.recommendedTermCourseId] : []);
    const slotGroups = slotIds.length === 0
        ? []
        : await prisma.recommendedTermCourse.findMany({
            where: { id: { in: slotIds } },
            select: { id: true, requirementGroupId: true },
        });
    const groupBySlot = new Map(slotGroups.map((row) => [row.id, row.requirementGroupId]));
    const logged = loggedRequirementCredits(
        requirementGroups.map((group) => ({
            id: group.id,
            name: group.name,
            minCredits: group.minCredits,
            sortOrder: group.sortOrder,
            courseIds: group.items.map((item) => item.courseId),
        })),
        transcript.map((entry) => ({
            courseId: entry.courseId,
            credits: entry.credits,
            status: entry.status,
            grade: entry.grade,
            createdAt: entry.createdAt,
            groupId: entry.recommendedTermCourseId ? groupBySlot.get(entry.recommendedTermCourseId) ?? null : null,
        })),
    );
    const gpa = computeGpa(transcript);

    const terms: Array<ProgressTerm & { yearLabel: string }> = [...curriculum]
        .sort((a, b) => a.sequence - b.sequence)
        .map((recommendation) => {
            const position = planPosition(recommendation.sequence);
            return {
                id: recommendation.id,
                yearLabel: position.yearLabel,
                label: position.season,
                rows: [...recommendation.courses]
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((course) => course.course
                        ? {
                            id: course.id,
                            kind: "course" as const,
                            courseId: course.course.id,
                            subject: course.course.subject,
                            number: course.course.number,
                            title: course.course.title,
                            credits: course.course.credits,
                        }
                        : {
                            id: course.id,
                            kind: "slot" as const,
                            groupId: course.requirementGroup!.id,
                            badge: course.requirementGroup
                                ? requirementSlotBadge(course.requirementGroup)
                                : null,
                            title: course.label ?? requirementGroupTitle(course.requirementGroup!),
                            allowUnlisted: course.requirementGroup?.slot === "FREE_ELECTIVE",
                            requiresLab: course.requiresLab,
                            minNumber: course.requirementGroup?.minNumber ?? 100,
                        }),
            };
        });

    const years: ProgressYear[] = [];
    for (const term of terms) {
        const { yearLabel, ...progressTerm } = term;
        const year = years.find((item) => item.label === yearLabel);
        if (year) {
            year.terms.push(progressTerm);
            continue;
        }
        years.push({
            id: yearLabel,
            label: yearLabel,
            terms: [progressTerm],
        });
    }

    const defaultCourses: Record<string, "" | ProgressStatus> = {};
    const defaultSlots: Record<string, typeof emptySlot | {
        courseId: string;
        subject: string;
        number: string;
        title: string;
        credits: string;
        status: "" | ProgressStatus;
    }> = {};
    const courseAttempts: Record<string, TranscriptAttempt[]> = {};
    const slotAttempts: Record<string, TranscriptAttempt[]> = {};
    const reservedCourseCodes: string[] = [];
    const inProgressCourseIds = new Set<string>();
    const inProgressSlotIds = new Set<string>();
    for (const row of years.flatMap((year) => year.terms.flatMap((term) => term.rows))) {
        if (row.kind === "course") {
            defaultCourses[row.courseId] = "";
            reservedCourseCodes.push(`${row.subject} ${row.number}`);
        } else {
            defaultSlots[row.id] = { ...emptySlot };
        }
    }
    for (const entry of [...transcript].reverse()) {
        if (entry.status === "IN_PROGRESS") {
            if (entry.recommendedTermCourseId) {
                inProgressSlotIds.add(entry.recommendedTermCourseId);
            } else if (entry.courseId) {
                inProgressCourseIds.add(entry.courseId);
            }
        }

        // Collect all attempts for this course/slot
        const attempt: TranscriptAttempt = {
            id: entry.id,
            grade: entry.grade,
            status: entry.status,
            source: entry.source,
            createdAt: entry.createdAt,
        };

        if (entry.recommendedTermCourseId && entry.recommendedTermCourseId in defaultSlots) {
            if (!slotAttempts[entry.recommendedTermCourseId]) {
                slotAttempts[entry.recommendedTermCourseId] = [];
            }
            slotAttempts[entry.recommendedTermCourseId].push(attempt);

            // Slots are initialized to a copy of the blank value, so identity comparison never matches.
            const current = defaultSlots[entry.recommendedTermCourseId];
            if (!current || slotIsUnfilled(current)) {
                defaultSlots[entry.recommendedTermCourseId] = entry.courseId
                    ? {
                        ...emptySlot,
                        courseId: entry.courseId,
                        status: progressStatusFromEntry(entry),
                    }
                    : {
                        ...emptySlot,
                        subject: entry.subject ?? "",
                        number: entry.number ?? "",
                        title: entry.title ?? "",
                        credits: String(entry.credits),
                        status: progressStatusFromEntry(entry),
                    };
            }
            continue;
        }
        if (entry.courseId && entry.courseId in defaultCourses) {
            if (!courseAttempts[entry.courseId]) {
                courseAttempts[entry.courseId] = [];
            }
            courseAttempts[entry.courseId].push(attempt);

            // Only set the default course value from the most recent entry
            if (!defaultCourses[entry.courseId]) {
                defaultCourses[entry.courseId] = progressStatusFromEntry(entry);
            }
        }
    }

    const outsidePlan = new Map<string, {
        courseId: string;
        subject: string;
        number: string;
        title: string;
        credits: number;
        attempts: TranscriptAttempt[];
    }>();
    for (const entry of transcript) {
        const onNamedCourse = entry.courseId != null && entry.courseId in defaultCourses;
        const onSlot = entry.recommendedTermCourseId != null && entry.recommendedTermCourseId in defaultSlots;
        if (onNamedCourse || onSlot) continue;
        const subject = entry.course?.subject ?? entry.subject ?? "";
        const number = entry.course?.number ?? entry.number ?? "";
        if (!subject || !number) continue;
        const key = entry.courseId ?? `${subject} ${number}`;
        const existing = outsidePlan.get(key) ?? {
            courseId: entry.courseId ?? "",
            subject,
            number,
            title: entry.course?.title ?? entry.title ?? `${subject} ${number}`,
            credits: entry.credits,
            attempts: [],
        };
        existing.attempts.push({
            id: entry.id,
            grade: entry.grade,
            status: entry.status,
            source: entry.source,
            createdAt: entry.createdAt,
        });
        outsidePlan.set(key, existing);
    }

    const coursesByGroup: Record<string, ProgressSlotCourse[]> = { ...slotCourses };
    for (const row of years.flatMap((year) => year.terms.flatMap((term) => term.rows))) {
        if (row.kind !== "slot") {
            continue;
        }
        const chosenId = defaultSlots[row.id]?.courseId;
        if (!chosenId) {
            continue;
        }
        const options = coursesByGroup[row.groupId] ?? [];
        if (options.some((course) => course.id === chosenId)) {
            continue;
        }
        const entry = transcript.find((item) => item.recommendedTermCourseId === row.id);
        if (!entry?.course) {
            continue;
        }
        coursesByGroup[row.groupId] = [...options, { ...entry.course, lab: row.requiresLab }];
    }

    const setupFinished = hasConfirmedStart(profile);
    const missingGrade = transcript.find((entry) => (
        entry.status === "COMPLETED"
        && entry.grade == null
        && (
            (entry.courseId != null && entry.courseId in defaultCourses)
            || (entry.recommendedTermCourseId != null && entry.recommendedTermCourseId in defaultSlots)
        )
    ));
    const reviewHref = missingGrade?.courseId && missingGrade.courseId in defaultCourses
        ? `#progress-course-${missingGrade.courseId}`
        : missingGrade?.recommendedTermCourseId
            ? `#progress-slot-${missingGrade.recommendedTermCourseId}`
            : "#progress-courses";
    const reviewLabel = missingGrade ? "Review missing grades" : "Review courses";

    return (
        <div className="flex min-h-full flex-1 flex-col">
            <header>
                <h1>Your Degree Progress</h1>
                <RequirementSummary
                    programName={formatProgramName(profile.catalogYear.program)}
                    catalogYear={profile.catalogYear.year}
                    totalCredits={profile.catalogYear.program.totalCredits}
                    groups={logged.groups}
                    hasCompletedEntries={logged.hasCompletedEntries}
                />
                {!setupFinished ? (
                    <p className="mt-4 max-w-prose text-sm text-balance text-muted-foreground">
                        Add your previous courses, or choose &apos;I have no prior coursework&apos; to continue.
                    </p>
                ) : null}
                <div className="mt-4 rounded-lg border border-border bg-muted px-4 py-3 not-typeset">
                    <div className="flex flex-wrap items-start gap-4">
                        <div className="min-w-[200px] flex-1">
                            <p className="text-sm font-medium">Degree progress</p>
                            <p className="mt-1 text-xl font-semibold">
                                {progress.earnedCredits} of {progress.totalCredits} credits ({progress.percentage}%)
                            </p>
                            <Badge className="mt-2">Completed requirements</Badge>
                            <p className="mt-2 text-xs text-muted-foreground">
                                Only completed courses that meet a degree requirement count here.
                            </p>
                            {setupFinished && progress.earnedCredits === 0 ? (
                                <p className="mt-2 max-w-prose text-sm text-balance text-muted-foreground">
                                    No completed credits count toward this degree yet. In-progress courses do not count until they are completed and meet the requirement.
                                </p>
                            ) : null}
                            <Button nativeButton={false} variant="outline" className="mt-3" render={<Link href={reviewHref}>{reviewLabel}</Link>} />
                        </div>
                        <div className="flex flex-col items-start rounded-lg border border-border bg-background px-3 py-2">
                            <span className="text-xs font-medium text-muted-foreground">Cumulative GPA</span>
                            <span className="mt-1 text-xl font-bold">{gpa !== null ? gpa.toFixed(2) : "—"}</span>
                            <Badge variant="outline" className="mt-1.5 border-border text-xs">
                                {gpa !== null ? "Recorded grades" : "No grades yet"}
                            </Badge>
                        </div>
                    </div>
                </div>
                <StatusLegend />
            </header>
            <ProgressForm
                years={years}
                defaultCourses={defaultCourses}
                defaultSlots={defaultSlots}
                courseAttempts={courseAttempts}
                slotAttempts={slotAttempts}
                slotCourses={coursesByGroup}
                reservedCourseCodes={reservedCourseCodes}
                outsidePlan={[...outsidePlan.values()]}
                inProgressCourseIds={[...inProgressCourseIds]}
                inProgressSlotIds={[...inProgressSlotIds]}
                startConfirmed={hasConfirmedStart(profile)}
                standing={profile.standing ?? ""}
            />
        </div>
    );
}
