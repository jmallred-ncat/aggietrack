import { Badge } from "@/components/ui/badge";
import { getProgressSlotCourses, type ProgressSlotCourse } from "@/lib/catalog";
import { computeDegreeProgress } from "@/lib/degree-progress";
import type { TranscriptSource, TranscriptStatus } from "@/lib/generated/prisma/browser";
import { computeGpa } from "@/lib/gpa";
import { getCurriculumRecommendations, planPosition, requirementGroupTitle, requirementSlotBadge } from "@/lib/planner";
import { slotIsUnfilled } from "@/lib/progress-slots";
import { hasConfirmedStart, requireStudentProfile } from "@/lib/student";
import { getTranscript, progressStatusFromEntry, type ProgressStatus } from "@/lib/transcript";
import { ArrowsLeftRightIcon, CheckCircleIcon, MedalIcon } from "@phosphor-icons/react/dist/ssr";
import ProgressForm, { type ProgressTerm, type ProgressYear } from "./ProgressForm";

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
    const profile = await requireStudentProfile();
    const [transcript, curriculum, slotCourses, progress] = await Promise.all([
        getTranscript(),
        getCurriculumRecommendations(),
        getProgressSlotCourses(),
        computeDegreeProgress(profile.id),
    ]);
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

    return (
        <div className="flex min-h-full flex-1 flex-col">
            <header>
                <h1>Your Degree Progress</h1>
                {progress.earnedCredits === 0 && (
                    <p className="text-sm text-muted-foreground max-w-prose w-full text-balance">AggieTrack needs the courses you have already completed before you can continue. Mark those courses below, or say you have no prior coursework.</p>
                )}
                {progress.earnedCredits > 0 && (
                    <div className="mt-4 rounded-lg border border-border bg-muted px-4 py-3 not-typeset">
                        <div className="flex flex-wrap gap-4 items-start">
                            <div className="flex-1 min-w-[200px]">
                                <p className="text-sm font-medium">
                                    Progress: {progress.earnedCredits} of {progress.totalCredits} credits ({progress.percentage}%)
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {progress.mappedCourses} {progress.mappedCourses === 1 ? "course" : "courses"} counted toward degree requirements
                                </p>
                            </div>
                            <div className="flex flex-col items-start rounded-lg bg-background px-3 py-2 border border-border">
                                <span className="text-xs font-medium text-muted-foreground">Cumulative GPA</span>
                                <div className="flex items-center gap-2 mt-1">
                                    <MedalIcon weight="fill" size={18} className="text-primary" />
                                    <span className="text-xl font-bold">{gpa !== null ? gpa.toFixed(2) : "—"}</span>
                                </div>
                                <Badge variant="outline" className="mt-1.5 text-xs border-border">
                                    {gpa !== null ? "Completed courses" : "No GPA yet"}
                                </Badge>
                            </div>
                        </div>
                    </div>
                )}
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
