import {
    Prisma,
    RequirementSlot,
    type Course,
} from "./generated/prisma/client";
import { prisma } from "./prisma";
import { requireStudentProfile } from "./student";

const courseWithRequirements = {
    include: {
        prerequisiteGroups: {
            orderBy: { sortOrder: "asc" as const },
            select: {
                id: true,
                isConcurrent: true,
                note: true,
                options: {
                    select: {
                        requires: {
                            select: {
                                id: true,
                                subject: true,
                                number: true,
                                title: true,
                                offeredIn: true,
                            },
                        },
                    },
                },
            },
        },
    },
} as const;

type CourseWithRequirements = Prisma.CourseGetPayload<typeof courseWithRequirements>;

const programWithDegree = {
    include: {
        degree: true,
        department: true,
    },
} as const;

export async function getCatalogYears() {
    const catalogYears = await prisma.catalogYear.findMany({
        select: {
            id: true,
            year: true,
            program: programWithDegree,
        },
        orderBy: {
            year: "desc",
        },
    });
    return catalogYears;
}

export type CatalogYearsWithPrograms = NonNullable<Awaited<ReturnType<typeof getCatalogYearsForPrograms>>>;

export async function getCatalogYearsForPrograms(searchQuery?: string) {
    const query = searchQuery?.trim() ?? "";
    if (query.length >= 3) {
        const programs = await prisma.program.findMany({
            where: {
                OR: [
                    {
                        name: {
                            contains: query,
                            mode: "insensitive",
                        },
                    }, {
                        code: {
                            contains: query,
                            mode: "insensitive",
                        },
                    }, {
                        shortName: {
                            contains: query,
                            mode: "insensitive",
                        },
                    }, {
                        degree: {
                            abbreviation: {
                                contains: query,
                                mode: "insensitive",
                            },
                        },
                    }, {
                        degree: {
                            name: {
                                contains: query,
                                mode: "insensitive",
                            },
                        },
                    }, {
                        department: {
                            abbreviation: {
                                contains: query,
                                mode: "insensitive",
                            },
                        },
                    }, {
                        department: {
                            name: {
                                contains: query,
                                mode: "insensitive",
                            },
                        },
                    },
                ],
            },
            include: {
                degree: true,
                department: true,
                catalogYears: {
                    orderBy: {
                        year: "desc",
                    },
                },
            },
        });
        return programs;
    }

    return [];
}

function compareCourses(a: Pick<Course, "subject" | "number">, b: Pick<Course, "subject" | "number">) {
    return a.subject.localeCompare(b.subject)
        || a.number.localeCompare(b.number, undefined, { numeric: true });
}

function applyMinimumNumber<T extends Pick<Course, "number">>(courses: T[], minNumber: number | null) {
    if (minNumber == null) {
        return courses;
    }

    return courses.filter(
        (course) => Number.parseInt(course.number, 10) >= minNumber,
    );
}

export async function getCurriculumCourseSections() {
    const profile = await requireStudentProfile();
    const catalogYearId = profile.catalogYear.id;
    const groupsWithItems = await prisma.requirementGroup.findMany({
        where: { catalogYearId },
        select: {
            id: true,
            name: true,
            slot: true,
            minCredits: true,
            minGrade: true,
            sortOrder: true,
            subject: true,
            minNumber: true,
            genEdCategory: true,
            requiredGenEdTag: true,
            items: {
                select: {
                    course: {
                        include: courseWithRequirements.include,
                    },
                },
            },
        },
        orderBy: { sortOrder: "asc" },
    });

    const genEdTags = [
        ...new Set(
            groupsWithItems.flatMap((group) =>
                [group.genEdCategory, group.requiredGenEdTag].filter((tag): tag is NonNullable<typeof tag> => tag != null),
            ),
        ),
    ];
    const dynamicSubjects = [
        ...new Set(
            groupsWithItems
                .filter(
                    (group) =>
                        group.subject
                        && (
                            group.slot === RequirementSlot.TECHNICAL_ELECTIVE
                            || (
                                group.slot === RequirementSlot.RELATED_POOL
                                && group.items.length === 0
                            )
                        ),
                )
                .map((group) => group.subject as string),
        ),
    ];

    const [attributes, subjectCourses] = await Promise.all([
        genEdTags.length > 0
            ? prisma.courseAttribute.findMany({
                where: {
                    catalogYearId,
                    tag: { in: genEdTags },
                },
                include: {
                    course: {
                        include: courseWithRequirements.include,
                    },
                },
            })
            : [],
        dynamicSubjects.length > 0
            ? prisma.course.findMany({
                where: { subject: { in: dynamicSubjects } },
                include: courseWithRequirements.include,
            })
            : [],
    ]);

    const coursesByTag = Map.groupBy(attributes, (attribute) => attribute.tag);
    const coursesBySubject = Map.groupBy(subjectCourses, (course) => course.subject);
    const explicitlyListedIds = new Set(
        groupsWithItems.flatMap((group) =>
            group.items.map((item) => item.course.id),
        ),
    );

    return groupsWithItems.map(({ items, ...group }) => {
        let courses: CourseWithRequirements[];

        switch (group.slot) {
            case RequirementSlot.PROGRAM_CORE:
            case RequirementSlot.SUPPORTING_REQUIRED:
                courses = items.map((item) => item.course);
                break;

            case RequirementSlot.GEN_ED_POOL: {
                if (!group.genEdCategory) {
                    throw new Error(`${group.name} does not define a gen-ed category`);
                }
                let tagged = (coursesByTag.get(group.genEdCategory) ?? [])
                    .map((attribute) => attribute.course);
                if (group.requiredGenEdTag) {
                    const requiredIds = new Set(
                        (coursesByTag.get(group.requiredGenEdTag) ?? [])
                            .map((attribute) => attribute.course.id),
                    );
                    tagged = tagged.filter((course) => requiredIds.has(course.id));
                }
                courses = applyMinimumNumber(
                    [...new Map(tagged.map((course) => [course.id, course])).values()],
                    group.minNumber,
                );
                break;
            }

            case RequirementSlot.RELATED_POOL:
                if (items.length > 0) {
                    courses = items.map((item) => item.course);
                } else if (group.subject) {
                    courses = coursesBySubject.get(group.subject) ?? [];
                } else {
                    throw new Error(`${group.name} does not define a course pool`);
                }
                courses = applyMinimumNumber(courses, group.minNumber);
                break;

            case RequirementSlot.TECHNICAL_ELECTIVE:
                if (!group.subject) {
                    throw new Error(`${group.name} does not define a subject`);
                }
                courses = applyMinimumNumber(
                    coursesBySubject.get(group.subject) ?? [],
                    group.minNumber,
                ).filter((course) => !explicitlyListedIds.has(course.id));
                break;

            case RequirementSlot.FREE_ELECTIVE:
                courses = [];
                break;

            default:
                throw new Error(`Unsupported requirement slot: ${group.slot}`);
        }

        return {
            group,
            courses: [...courses].sort(compareCourses),
        };
    });
}

export type CurriculumCourseSection =
    Awaited<ReturnType<typeof getCurriculumCourseSections>>[number];

const progressSlotSelect = {
    id: true,
    subject: true,
    number: true,
    title: true,
    credits: true,
} as const;

export type ProgressSlotCourse = {
    id: string;
    subject: string;
    number: string;
    title: string;
    credits: number;
};

const openRequirementSlots = new Set<RequirementSlot>([
    RequirementSlot.GEN_ED_POOL,
    RequirementSlot.RELATED_POOL,
    RequirementSlot.TECHNICAL_ELECTIVE,
    RequirementSlot.FREE_ELECTIVE,
]);

/** Courses a student can claim for each open requirement group on the progress checklist. */
export async function getProgressSlotCourses() {
    const sections = await getCurriculumCourseSections();
    const requiredIds = new Set(
        sections
            .filter((section) =>
                section.group.slot === RequirementSlot.PROGRAM_CORE
                || section.group.slot === RequirementSlot.SUPPORTING_REQUIRED,
            )
            .flatMap((section) => section.courses.map((course) => course.id)),
    );

    const hasFreeElective = sections.some((section) => section.group.slot === RequirementSlot.FREE_ELECTIVE);
    const freeCourses = hasFreeElective
        ? (await prisma.course.findMany({ select: progressSlotSelect }))
            .filter((course) => !requiredIds.has(course.id))
            .sort(compareCourses)
        : [];

    const coursesByGroup: Record<string, ProgressSlotCourse[]> = {};
    for (const section of sections) {
        if (!openRequirementSlots.has(section.group.slot)) {
            continue;
        }

        if (section.group.slot === RequirementSlot.FREE_ELECTIVE) {
            coursesByGroup[section.group.id] = applyMinimumNumber(freeCourses, section.group.minNumber);
            continue;
        }

        const courses = section.group.slot === RequirementSlot.GEN_ED_POOL
            ? section.courses.filter((course) => !requiredIds.has(course.id))
            : section.courses;

        coursesByGroup[section.group.id] = courses.map((course) => ({
            id: course.id,
            subject: course.subject,
            number: course.number,
            title: course.title,
            credits: course.credits,
        }));
    }

    return coursesByGroup;
}
