import {
    RequirementKind,
    type Course,
} from "./generated/prisma/client";
import { prisma } from "./prisma";
import { requireStudentProfile } from "./student";

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

function compareCourses(a: Course, b: Course) {
    return a.subject.localeCompare(b.subject)
        || a.number.localeCompare(b.number, undefined, { numeric: true });
}

function applyMinimumNumber(courses: Course[], minNumber: number | null) {
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
            kind: true,
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
                    course: true,
                },
            },
        },
        orderBy: { sortOrder: "asc" },
    });

    const genEdTags = [
        ...new Set(
            groupsWithItems
                .map((group) => group.genEdCategory)
                .filter((tag): tag is NonNullable<typeof tag> => tag != null),
        ),
    ];
    const dynamicSubjects = [
        ...new Set(
            groupsWithItems
                .filter(
                    (group) =>
                        group.subject
                        && (
                            group.kind === RequirementKind.SUBJECT_ELECTIVE
                            || (
                                group.kind === RequirementKind.CREDITS_FROM_POOL
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
                include: { course: true },
            })
            : [],
        dynamicSubjects.length > 0
            ? prisma.course.findMany({
                where: { subject: { in: dynamicSubjects } },
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
        let courses: Course[];

        switch (group.kind) {
            case RequirementKind.ALL_OF:
                courses = items.map((item) => item.course);
                break;

            case RequirementKind.CREDITS_FROM_POOL:
                if (group.genEdCategory) {
                    courses = (coursesByTag.get(group.genEdCategory) ?? [])
                        .map((attribute) => attribute.course);
                } else if (items.length > 0) {
                    courses = items.map((item) => item.course);
                } else if (group.subject) {
                    courses = coursesBySubject.get(group.subject) ?? [];
                } else {
                    throw new Error(`${group.name} does not define a course pool`);
                }
                courses = applyMinimumNumber(courses, group.minNumber);
                break;

            case RequirementKind.SUBJECT_ELECTIVE:
                if (!group.subject) {
                    throw new Error(`${group.name} does not define a subject`);
                }
                courses = applyMinimumNumber(
                    coursesBySubject.get(group.subject) ?? [],
                    group.minNumber,
                ).filter((course) => !explicitlyListedIds.has(course.id));
                break;

            case RequirementKind.FREE_ELECTIVE:
                courses = [];
                break;

            default:
                throw new Error(`Unsupported requirement kind: ${group.kind}`);
        }

        return {
            group,
            courses: [...courses].sort(compareCourses),
        };
    });
}

export type CurriculumCourseSection =
    Awaited<ReturnType<typeof getCurriculumCourseSections>>[number];
