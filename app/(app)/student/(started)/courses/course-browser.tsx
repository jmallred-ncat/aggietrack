"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { courseOfferedInSeason, notOfferedInTermMessage } from "@/lib/academic-term";
import type { CurriculumCourseSection } from "@/lib/catalog";
import { GenEdTag, RequirementSlot, type Course, type TermSeason } from "@/lib/generated/prisma/browser";
import { coursePrerequisitesSatisfied } from "@/lib/prerequisites";
import type { StudentProfileWithCatalog } from "@/lib/student";
import { cn } from "@/lib/utils";
import { FlaskIcon, LecternIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { useDebounce } from "@uidotdev/usehooks";
import pluralize from "pluralize";
import { memo, useMemo, useState, useTransition } from "react";
import { addPlannedCourse } from "../planner/actions";

type PlanningTerm = {
    id: string;
    label: string;
    season: TermSeason;
    locked: boolean;
    startsOn: string;
};

type PlannedCourseTiming = {
    courseId: string;
    startsOn: string;
};

type PlanPlacement = {
    courseId: string;
    termLabel: string;
    locked: boolean;
};

function courseMatchesSearch(course: Course, search: string) {
    const values = [
        course.subject,
        course.number,
        `${course.subject} ${course.number}`,
        course.title,
        course.description,
    ];

    return values.some((value) => value?.toLowerCase().includes(search));
}

export function CourseBrowser({
    profile,
    sections,
    planningTerms,
    placements,
    satisfiedCourseIds,
    completedCourseIds,
    plannedCourses,
}: {
    profile: StudentProfileWithCatalog;
    sections: CurriculumCourseSection[];
    planningTerms: PlanningTerm[];
    placements: PlanPlacement[];
    satisfiedCourseIds: string[];
    completedCourseIds: string[];
    plannedCourses: PlannedCourseTiming[];
}) {
    const [query, setQuery] = useState("");
    const debouncedQuery = useDebounce(query, 250);

    const program = profile.catalogYear.program;

    const filteredSections = useMemo(() => {
        const search = debouncedQuery.trim().toLowerCase();
        if (!search) {
            return sections;
        }

        return sections.flatMap((section) => {
            if (section.group.name.toLowerCase().includes(search)) {
                return [section];
            }

            const courses = section.courses.filter((course) =>
                courseMatchesSearch(course, search),
            );

            return courses.length > 0 ? [{ ...section, courses }] : [];
        });
    }, [debouncedQuery, sections]);

    const matchCount = filteredSections.reduce(
        (total, section) => total + section.courses.length,
        0,
    );
    const isSearchPending = query.trim() !== debouncedQuery.trim();

    return <div>
        <header className="not-typeset py-6 space-y-2">
            <Badge>{program.department.name}</Badge>
            <h1 className="text-4xl font-bold not-typeset text-balance max-w-prose w-full -mb-1.5">{program.degree.abbreviation} in {program.name} Courses</h1>
            <span>{profile.catalogYear.year} Catalog Year</span>
            <p className="text-sm text-muted-foreground mt-2 max-w-prose w-full text-balance">
                Quickly search, filter, and browse courses in your degree program. Enter a course code, title, or requirement name to find relevant courses, see which requirements they satisfy, and discover course details instantly.
            </p>

        </header>

        <div className="sticky top-0 z-20 -mx-4 mt-4 bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <div className="relative">
                <MagnifyingGlassIcon
                    aria-hidden="true"
                    className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search by course code, title, or requirement…"
                    className="pl-9"
                    aria-label="Search curriculum courses"
                />
            </div>

            {query
                ? <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
                    {isSearchPending
                        ? "Searching…"
                        : <>
                            {matchCount} {matchCount === 1 ? "course" : "courses"} across{" "}
                            {filteredSections.length}{" "}
                            {filteredSections.length === 1 ? "requirement" : "requirements"}
                        </>}
                </p>
                : null}
        </div>

        {filteredSections.map((section) => (
            <RequirementCourseSection
                key={section.group.id}
                section={section}
                planningTerms={planningTerms}
                placements={placements}
                satisfiedCourseIds={satisfiedCourseIds}
                completedCourseIds={completedCourseIds}
                plannedCourses={plannedCourses}
            />
        ))}

        {query && !isSearchPending && filteredSections.length === 0
            ? <p className="py-12 text-center text-muted-foreground">
                No courses or requirements match “{query}”.
            </p>
            : null}
    </div>;
}

const RequirementCourseSection = memo(function RequirementCourseSection({
    section,
    planningTerms,
    placements,
    satisfiedCourseIds,
    completedCourseIds,
    plannedCourses,
}: {
    section: CurriculumCourseSection;
    planningTerms: PlanningTerm[];
    placements: PlanPlacement[];
    satisfiedCourseIds: string[];
    completedCourseIds: string[];
    plannedCourses: PlannedCourseTiming[];
}) {
    const { group, courses } = section;
    const creditLabel = `${group.minCredits} ${group.minCredits === 1 ? "credit" : "credits"}`;
    const labQualifier =
        group.requiredGenEdTag === GenEdTag.SCIENTIFIC_REASONING_LAB
            ? ", including a lab"
            : "";

    let requirementCopy: string;
    if (
        group.slot === RequirementSlot.PROGRAM_CORE
        || group.slot === RequirementSlot.SUPPORTING_REQUIRED
    ) {
        requirementCopy = `${creditLabel} • All listed courses required`;
    } else if (group.slot === RequirementSlot.FREE_ELECTIVE) {
        requirementCopy = group.minNumber
            ? `${creditLabel} from courses numbered ${group.minNumber} or above`
            : creditLabel;
    } else {
        requirementCopy = `Choose ${creditLabel}${labQualifier}`;
    }

    return <section className="mt-8">
        <header>
            <h2 className="text-2xl font-bold">{group.name}</h2>
            <p className="text-sm text-muted-foreground">{requirementCopy}</p>
        </header>

        {courses.length > 0
            ? <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {courses.map((course) => (
                    <CourseCard
                        key={`${group.id}-${course.id}`}
                        course={course}
                        planningTerms={planningTerms}
                        placement={placements.find((item) => item.courseId === course.id) ?? null}
                        placements={placements}
                        satisfiedCourseIds={satisfiedCourseIds}
                        completedCourseIds={completedCourseIds}
                        plannedCourses={plannedCourses}
                    />
                ))}
            </div>
            : <p className="mt-4 text-sm text-muted-foreground">
                This requirement does not have a fixed course list.
            </p>}
    </section>;
});

type CurriculumCourse = CurriculumCourseSection["courses"][number];
type PrerequisiteGroup = CurriculumCourse["prerequisiteGroups"][number];

function requirementGroups(course: CurriculumCourse, concurrent: boolean) {
    return course.prerequisiteGroups
        .filter((group) => group.isConcurrent === concurrent)
        .map((group) => ({
            ...group,
            options: [...group.options].sort((a, b) =>
                a.requires.subject.localeCompare(b.requires.subject)
                || a.requires.number.localeCompare(b.requires.number, undefined, { numeric: true }),
            ),
        }));
}

type CompanionCourse = {
    id: string;
    code: string;
    title: string;
    offeredIn: TermSeason[];
};

function corequisiteCourses(course: CurriculumCourse) {
    const seen = new Set<string>();
    const companions: CompanionCourse[] = [];
    for (const group of requirementGroups(course, true)) {
        for (const option of group.options) {
            if (seen.has(option.requires.id)) {
                continue;
            }
            seen.add(option.requires.id);
            companions.push({
                id: option.requires.id,
                code: `${option.requires.subject} ${option.requires.number}`,
                title: option.requires.title,
                offeredIn: option.requires.offeredIn,
            });
        }
    }
    return companions;
}

function joinCourses(codes: string[]) {
    if (codes.length <= 1) {
        return codes[0] ?? "";
    }
    if (codes.length === 2) {
        return `${codes[0]} and ${codes[1]}`;
    }
    return `${codes.slice(0, -1).join(", ")}, and ${codes.at(-1)}`;
}

const CourseCard = memo(function CourseCard({
    course,
    planningTerms,
    placement,
    placements,
    satisfiedCourseIds,
    completedCourseIds,
    plannedCourses,
}: {
    course: CurriculumCourse;
    planningTerms: PlanningTerm[];
    placement: PlanPlacement | null;
    placements: PlanPlacement[];
    satisfiedCourseIds: string[];
    completedCourseIds: string[];
    plannedCourses: PlannedCourseTiming[];
}) {
    const prerequisites = requirementGroups(course, false);
    const corequisites = requirementGroups(course, true);
    const hasRequirements = prerequisites.length > 0 || corequisites.length > 0;
    const prerequisiteGroups = course.prerequisiteGroups.map((group) => ({
        isConcurrent: group.isConcurrent,
        optionIds: group.options.map((option) => option.requires.id),
    }));
    const hasCoursePrerequisites = prerequisiteGroups.some((group) => !group.isConcurrent && group.optionIds.length > 0);
    const prerequisitesMet = (term: PlanningTerm) => {
        const satisfied = new Set(satisfiedCourseIds);
        for (const planned of plannedCourses) {
            if (planned.startsOn < term.startsOn) {
                satisfied.add(planned.courseId);
            }
        }
        return coursePrerequisitesSatisfied(prerequisiteGroups, satisfied);
    };
    const eligibleTerms = planningTerms.filter((term) => !term.locked && prerequisitesMet(term));
    const blockedByPrerequisites = !placement && hasCoursePrerequisites && !planningTerms.some(prerequisitesMet);
    const completed = new Set(completedCourseIds);
    const taken = new Set([
        ...satisfiedCourseIds,
        ...placements.map((item) => item.courseId),
    ]);
    const companions = corequisiteCourses(course);
    const companionsToAdd = companions.filter((item) => !taken.has(item.id));
    const completedCorequisites = companions.filter((item) => completed.has(item.id));
    const corequisiteGroups = course.prerequisiteGroups.filter((group) => group.isConcurrent && group.options.length > 0);
    const addWithOverride = !blockedByPrerequisites
        && corequisiteGroups.length > 0
        && companionsToAdd.length === 0
        && corequisiteGroups.every((group) => group.options.some((option) => completed.has(option.requires.id)));
    const addButton = () => (
        <AddToPlannerButton
            course={course}
            terms={eligibleTerms}
            placement={placement}
            blockedByPrerequisites={blockedByPrerequisites}
            companions={companionsToAdd}
            completedCorequisites={completedCorequisites}
            addWithOverride={addWithOverride}
        />
    );

    return <Card className="not-typeset">
        <div className={cn("flex flex-1 flex-col", blockedByPrerequisites && "opacity-60")}>
            <CardHeader>
                <div className="flex w-full items-center justify-between gap-2">
                    <Badge className="font-mono">{course.subject} {course.number}</Badge>
                    <span className="flex items-center gap-2">
                        {hasRequirements && (
                            <span
                                className="size-2 shrink-0 rounded-full bg-destructive"
                                role="img"
                                aria-label="Has a prerequisite or corequisite"
                            />
                        )}
                        {course.isLab
                            ? <FlaskIcon size={16} weight="bold" />
                            : <LecternIcon size={16} weight="bold" />}
                    </span>
                </div>
                <CardTitle className="line-clamp-2">{course.title}</CardTitle>
                <CardDescription className="text-xs">
                    {course.credits} {pluralize("Credit", course.credits)} • {convertCourseOfferedIn(course.offeredIn, true)}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 mt-2">
                <p className="line-clamp-2 text-sm text-muted-foreground">{course.description}</p>
            </CardContent>
        </div>
        <CardFooter className="flex items-center justify-between gap-2">
            <Dialog>
                <DialogTrigger render={
                    <Button
                        variant={blockedByPrerequisites ? "outline" : "ghost"}
                        className="w-full flex-1"
                        size="sm"
                    >
                        View Details
                    </Button>
                } />
                <DialogContent className="not-typeset w-full">
                    <DialogHeader>
                        <DialogTitle>
                            <div className="mb-2 flex items-center gap-2">
                                <Badge className="font-mono text-[12px] font-medium">
                                    {course.subject} {course.number}
                                </Badge>
                                {course.isLab
                                    ? <FlaskIcon size={16} weight="bold" />
                                    : <LecternIcon size={16} weight="bold" />}
                            </div>
                            {course.title}
                        </DialogTitle>
                    </DialogHeader>
                    <div>
                        <ul className="list-inside list-disc">
                            <li>
                                {course.credits === 1
                                    ? `${course.credits} Credit`
                                    : `${course.credits} Credits`}
                            </li>
                            <li>{convertCourseOfferedIn(course.offeredIn)}</li>
                        </ul>
                        <RequirementGroups title="Prerequisites" groups={prerequisites} />
                        <RequirementGroups title="Corequisites" groups={corequisites} />
                        <p className="mt-3">{course.description}</p>
                    </div>
                    <DialogFooter>
                        {addButton()}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className={cn("flex min-w-0 flex-1", blockedByPrerequisites && "opacity-60")}>
                {addButton()}
            </div>
        </CardFooter>
    </Card>;
});

function AddToPlannerButton({
    course,
    terms,
    placement,
    blockedByPrerequisites,
    companions,
    completedCorequisites,
    addWithOverride,
}: {
    course: CurriculumCourse;
    terms: PlanningTerm[];
    placement: PlanPlacement | null;
    blockedByPrerequisites: boolean;
    companions: CompanionCourse[];
    completedCorequisites: CompanionCourse[];
    addWithOverride: boolean;
}) {
    const [pending, startTransition] = useTransition();
    const [added, setAdded] = useState<PlanPlacement | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [includeCompanions, setIncludeCompanions] = useState(true);
    const [dialogError, setDialogError] = useState<string | null>(null);
    const current = added ?? placement;
    const label = `${course.subject} ${course.number}`;
    const companionList = joinCourses(companions.map((item) => item.code));
    const completedList = joinCourses(completedCorequisites.map((item) => item.code));
    const triggerLabel = addWithOverride ? "Add with override" : "Add to Plan";

    function offeringMessage(term: PlanningTerm, companionIds: string[]) {
        if (!courseOfferedInSeason(course.offeredIn, term.season)) {
            return notOfferedInTermMessage(label, term.label, course.offeredIn);
        }

        const blockedCompanion = companions.find((companion) =>
            companionIds.includes(companion.id) && !courseOfferedInSeason(companion.offeredIn, term.season),
        );
        return blockedCompanion
            ? notOfferedInTermMessage(blockedCompanion.code, term.label, blockedCompanion.offeredIn)
            : null;
    }

    function add(term: PlanningTerm, companionIds: string[]) {
        const blocked = offeringMessage(term, companionIds);
        if (blocked) {
            setDialogError(blocked);
            return;
        }

        startTransition(async () => {
            const result = await addPlannedCourse(term.id, course.id, companionIds);
            if (!result.success) {
                setDialogError(result.error ?? "That course could not be added.");
                return;
            }
            const addedCodes = [
                label,
                ...companions
                    .filter((item) => result.addedCourseIds.includes(item.id))
                    .map((item) => item.code),
            ];
            setAdded({ courseId: course.id, termLabel: term.label, locked: false });
            setConfirmOpen(false);
            toast.add({ title: `${joinCourses(addedCodes)} added to ${term.label}` });
        });
    }

    if (current) {
        return (
            <Button variant="secondary" className="w-full flex-1" size="sm" disabled>
                {current.locked ? `On ${current.termLabel}` : "Added"}
            </Button>
        );
    }

    if (blockedByPrerequisites || terms.length === 0) {
        return (
            <Button
                variant="secondary"
                className="w-full flex-1"
                size="sm"
                disabled
                aria-label={blockedByPrerequisites ? `Prerequisites for ${label} have not been completed` : "Add to Plan"}
            >
                Add to Plan
            </Button>
        );
    }

    const onlyTerm = terms.length === 1 ? terms[0] : null;
    const companionIds = companions.map((item) => item.id);
    const onlyTermBlocked = onlyTerm ? offeringMessage(onlyTerm, companionIds) : null;
    const onlyCourseBlocked = onlyTerm ? offeringMessage(onlyTerm, []) : null;

    return (
        <Dialog
            open={confirmOpen}
            onOpenChange={(open) => {
                setConfirmOpen(open);
                if (open) {
                    setIncludeCompanions(true);
                    setDialogError(null);
                }
            }}
        >
            <DialogTrigger render={
                <Button
                    type="button"
                    variant="secondary"
                    className={cn("w-full flex-1", addWithOverride && "h-auto whitespace-normal px-2 text-center leading-tight")}
                    size="sm"
                >
                    {triggerLabel}
                </Button>
            } />
            <DialogContent className="not-typeset w-full sm:max-w-lg" showCloseButton={false}>
                <DialogHeader className="min-w-0">
                    <DialogTitle>
                        {addWithOverride
                            ? `Add ${label} with an override?`
                            : onlyTerm
                                ? `Add ${label} to ${onlyTerm.label}?`
                                : `Add ${label} to your plan?`}
                    </DialogTitle>
                    <DialogDescription role={onlyCourseBlocked ? "alert" : undefined} className={onlyCourseBlocked ? "text-foreground" : undefined}>
                        {onlyCourseBlocked
                            ? onlyCourseBlocked
                            : addWithOverride
                                ? `${completedList} ${completedCorequisites.length === 1 ? "is" : "are"} already completed. Adding ${label} without ${completedCorequisites.length === 1 ? "that corequisite" : "those corequisites"} uses an override. You can remove it before submitting the plan for review.`
                                : companions.length > 0
                                    ? `${label} is taken with ${companionList}. Add ${companions.length === 1 ? "both courses" : "all of these courses"} to the same plan, or add ${label} on its own. You can remove them before submitting the plan for review.`
                                    : onlyTerm
                                        ? `${course.title} will be added to your ${onlyTerm.label} plan. You can remove it before submitting the plan for review.`
                                        : "Choose the term this course should join. You can remove it before submitting the plan for review."}
                    </DialogDescription>
                </DialogHeader>
                {onlyTerm && !onlyCourseBlocked && onlyTermBlocked && (
                    <p role="alert" className="text-sm text-foreground">{onlyTermBlocked}</p>
                )}
                {dialogError && dialogError !== onlyCourseBlocked && dialogError !== onlyTermBlocked && (
                    <p role="alert" className="text-sm text-foreground">{dialogError}</p>
                )}
                {onlyTerm ? (
                    <DialogFooter className="min-w-0 sm:justify-between">
                        <Button type="button" variant="destructive" size="sm" disabled={pending} onClick={() => setConfirmOpen(false)}>
                            Cancel
                        </Button>
                        <ButtonGroup>
                            {companions.length > 0 && (
                                <Button type="button" variant="outline" size="sm" disabled={pending || Boolean(onlyCourseBlocked)} onClick={() => add(onlyTerm, [])}>
                                    Add {label} only
                                </Button>
                            )}
                            <Button
                                type="button"
                                size="sm"
                                disabled={pending || Boolean(onlyTermBlocked)}
                                onClick={() => add(onlyTerm, companions.length > 0 ? companionIds : [])}
                            >
                                {addWithOverride
                                    ? "Add with override"
                                    : companions.length > 1
                                        ? "Add all"
                                        : companions.length === 1
                                            ? `Add ${label} and ${companions[0].code}`
                                            : "Add to Plan"}
                            </Button>
                        </ButtonGroup>
                    </DialogFooter>
                ) : (
                    <div className="flex min-w-0 flex-col gap-2">
                        {companions.length > 0 && (
                            <label className="flex items-start gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    className="mt-0.5"
                                    checked={includeCompanions}
                                    onChange={(event) => setIncludeCompanions(event.target.checked)}
                                />
                                <span>Also add {companionList}</span>
                            </label>
                        )}
                        {[...new Set(terms.flatMap((term) => {
                            const message = offeringMessage(term, includeCompanions ? companionIds : []);
                            return message ? [message] : [];
                        }))].map((message) => (
                            <p key={message} role="alert" className="text-sm text-foreground">{message}</p>
                        ))}
                        {terms.map((term) => {
                            const blocked = offeringMessage(term, includeCompanions ? companionIds : []);
                            return (
                                <Button
                                    key={term.id}
                                    type="button"
                                    size="sm"
                                    disabled={pending || Boolean(blocked)}
                                    onClick={() => add(term, includeCompanions ? companionIds : [])}
                                >
                                    {addWithOverride ? `${term.label} with override` : term.label}
                                </Button>
                            );
                        })}
                        <Button type="button" variant="destructive" size="sm" disabled={pending} onClick={() => setConfirmOpen(false)}>
                            Cancel
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

function RequirementGroups({
    title,
    groups,
}: {
    title: string;
    groups: PrerequisiteGroup[];
}) {
    if (groups.length === 0) {
        return null;
    }

    return (
        <div className="mt-4">
            <h3 className="text-sm font-semibold">{title}</h3>
            {groups.length > 1 && (
                <p className="mt-1 text-sm text-muted-foreground">All of the following</p>
            )}
            <ul className="mt-1 space-y-2 text-sm">
                {groups.map((group) => (
                    <li key={group.id}>
                        {group.options.length > 1 && (
                            <p className="text-foreground/75 leading-none font-medium mb-1 text-xs">Satisfy one of the following:</p>
                        )}
                        {group.options.length > 0 && (
                            <ul className="space-y-1 list-inside list-disc">
                                {group.options.map((option) => (
                                    <li key={option.requires.id}>
                                        <span className="font-mono text-sm tracking-tighter">{option.requires.subject}{" "}{option.requires.number}</span>{" "}&mdash;{" "}
                                        <span className="text-sm"> {option.requires.title}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {group.note && (
                            <p className="text-muted-foreground">{group.note}</p>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}

function convertCourseOfferedIn(offeredIn: string[], condensed = false) {
    if (offeredIn.length === 0) {
        return "Offering not specified";
    }

    const sessions = offeredIn.map(
        (season) => season.charAt(0) + season.slice(1).toLowerCase(),
    );

    if (condensed) {
        return new Intl.ListFormat("en", {
            style: "long",
            type: "conjunction",
        }).format(sessions);
    }

    const sessionList = new Intl.ListFormat("en", {
        style: "long",
        type: "conjunction",
    }).format(sessions);

    return sessions.length === 1
        ? `Offered in ${sessionList.toLowerCase()} session`
        : `Offered in ${sessionList} sessions`;
}
