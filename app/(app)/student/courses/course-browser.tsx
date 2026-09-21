"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { CurriculumCourseSection } from "@/lib/catalog";
import { GenEdTag, RequirementKind, type Course } from "@/lib/generated/prisma/browser";
import type { StudentProfileWithCatalog } from "@/lib/student";
import { FlaskIcon, LecternIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { useDebounce } from "@uidotdev/usehooks";
import { memo, useMemo, useState } from "react";

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
    program,
    sections,
}: {
    program: StudentProfileWithCatalog["catalogYear"]["program"];
    sections: CurriculumCourseSection[];
}) {
    const [query, setQuery] = useState("");
    const debouncedQuery = useDebounce(query, 250);

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
        <header>
            <h1 className="text-2xl font-bold">{program.degree.abbreviation} in {program.name} Courses</h1>
        </header>

        <div className="sticky top-0 z-20 -mx-4 mt-4 border-y bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
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
            <RequirementCourseSection key={section.group.id} section={section} />
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
}: {
    section: CurriculumCourseSection;
}) {
    const { group, courses } = section;
    const creditLabel = `${group.minCredits} ${group.minCredits === 1 ? "credit" : "credits"}`;
    const labQualifier =
        group.requiredGenEdTag === GenEdTag.SCIENTIFIC_REASONING_LAB
            ? ", including a lab"
            : "";

    let requirementCopy: string;
    if (group.kind === RequirementKind.ALL_OF) {
        requirementCopy = `${creditLabel} • All listed courses required`;
    } else if (group.kind === RequirementKind.FREE_ELECTIVE) {
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
                    <CourseCard key={`${group.id}-${course.id}`} course={course} />
                ))}
            </div>
            : <p className="mt-4 text-sm text-muted-foreground">
                This requirement does not have a fixed course list.
            </p>}
    </section>;
});

const CourseCard = memo(function CourseCard({ course }: { course: Course }) {
    return <Card className="not-typeset">
        <CardHeader>
            <div className="flex w-full items-center justify-between gap-2">
                <Badge className="font-mono">{course.subject} {course.number}</Badge>
                {course.isLab
                    ? <FlaskIcon size={16} weight="bold" />
                    : <LecternIcon size={16} weight="bold" />}
            </div>
            <CardTitle className="line-clamp-2">{course.title}</CardTitle>
            <CardDescription>
                {course.credits} Credits • {convertCourseOfferedIn(course.offeredIn, true)}
            </CardDescription>
        </CardHeader>
        <CardContent className="flex-1">
            <p className="line-clamp-2 text-sm text-muted-foreground">{course.description}</p>
        </CardContent>
        <CardFooter>
            <Dialog>
                <DialogTrigger render={<Button variant="ghost" className="w-full" size="sm">View Details</Button>} />
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
                        <p className="mt-3">{course.description}</p>
                    </div>
                </DialogContent>
            </Dialog>
        </CardFooter>
    </Card>;
});

function convertCourseOfferedIn(offeredIn: string[], condensed = false) {
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
