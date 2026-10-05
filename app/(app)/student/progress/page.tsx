import { getProgressSlotCourses, type ProgressSlotCourse } from "@/lib/catalog";
import { getCurriculumRecommendations, planPosition, requirementGroupTitle } from "@/lib/planner";
import { hasConfirmedStart, requireStudentProfile } from "@/lib/student";
import { getTranscript, progressStatusFromEntry, type ProgressStatus } from "@/lib/transcript";
import { ArrowsLeftRightIcon, CheckCircleIcon, ClockIcon } from "@phosphor-icons/react/dist/ssr";
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
    { value: "active", label: "Active", detail: "Currently taking", icon: ClockIcon },
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

export default async function ProgressPage() {
    const [profile, transcript, curriculum, slotCourses] = await Promise.all([
        requireStudentProfile(),
        getTranscript(),
        getCurriculumRecommendations(),
        getProgressSlotCourses(),
    ]);

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
                            badge: course.requirementGroup?.subject
                                ? `${course.requirementGroup.subject} ${course.requirementGroup.minNumber}+`
                                : null,
                            title: requirementGroupTitle(course.requirementGroup!),
                            allowUnlisted: course.requirementGroup?.slot === "FREE_ELECTIVE",
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
    const reservedCourseCodes: string[] = [];
    for (const row of years.flatMap((year) => year.terms.flatMap((term) => term.rows))) {
        if (row.kind === "course") {
            defaultCourses[row.courseId] = "";
            reservedCourseCodes.push(`${row.subject} ${row.number}`);
        } else {
            defaultSlots[row.id] = { ...emptySlot };
        }
    }
    for (const entry of [...transcript].reverse()) {
        if (entry.recommendedTermCourseId && entry.recommendedTermCourseId in defaultSlots) {
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
            continue;
        }
        if (entry.courseId && entry.courseId in defaultCourses) {
            defaultCourses[entry.courseId] = progressStatusFromEntry(entry);
        }
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
        coursesByGroup[row.groupId] = [...options, entry.course];
    }

    return (
        <div className="flex min-h-full flex-1 flex-col">
            <header>
                <h1>Your Degree Progress</h1>
                <p className="text-sm text-muted-foreground max-w-prose w-full text-balance">AggieTrack needs the courses you have already completed before you can continue. Mark those courses below, or say you have no prior coursework.</p>
                <StatusLegend />
            </header>
            <ProgressForm
                years={years}
                defaultCourses={defaultCourses}
                defaultSlots={defaultSlots}
                slotCourses={coursesByGroup}
                reservedCourseCodes={reservedCourseCodes}
                startConfirmed={hasConfirmedStart(profile)}
                standing={profile.standing ?? ""}
            />
        </div>
    );
}
