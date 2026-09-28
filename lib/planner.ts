import { prisma } from "./prisma";
import { requireStudentProfile } from "./student";

export async function getCurriculumRecommendations() {
    const profile = await requireStudentProfile();
    const catalogYear = profile.catalogYear;

    const recommended = await prisma.recommendedTerm.findMany({
        where: {
            catalogYearId: catalogYear.id,
        },
        include: {
            courses: {
                include: {
                    course: true,
                    requirementGroup: true
                }
            },
        },
    });

    return recommended;
}