import { subYears } from "date-fns";
import { prisma } from "./prisma";

export async function getCatalogYears() {
    const catalogYears = await prisma.catalogYear.findMany({
        select: {
            id: true,
            label: true,
            program: true,
        },
    });
    return catalogYears;
}

export type CatalogYearsWithPrograms = NonNullable<Awaited<ReturnType<typeof getCatalogYearsForPrograms>>>;

export async function getCatalogYearsForPrograms() {
    const programs = await prisma.program.findMany({
        include: {
            catalogYears: {
                where: {
                    effectiveFrom: {
                        gt: subYears(new Date(), 7),
                    }
                }
            },
        },
    });
    return programs;
}