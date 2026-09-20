import { prisma } from "./prisma";

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
