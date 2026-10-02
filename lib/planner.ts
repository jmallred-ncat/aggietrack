import type { RequirementGroup } from "./generated/prisma/client";
import { prisma } from "./prisma";
import { requireStudentProfile } from "./student";

export async function getCurriculumRecommendations() {
    const profile = await requireStudentProfile();
    const catalogYear = profile.catalogYear;

    const recommended = await prisma.recommendedTerm.findMany({
        where: {
            catalogYearId: catalogYear.id,
        },
        orderBy: { sequence: "asc" },
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

export function requirementSlotCredits(
    recommendations: { courses: { requirementGroup: { id: string } | null }[] }[],
    group: { id: string; minCredits: number },
) {
    const slots = recommendations.reduce(
        (count, term) => count + term.courses.filter((row) => row.requirementGroup?.id === group.id).length,
        0,
    );

    if (slots <= 1) {
        return group.minCredits;
    }

    return group.minCredits / slots;
}

export function requirementSlotTitle(name: string) {
    return name.replaceAll("Electives", "Elective");
}

const yearNames = ["First", "Second", "Third", "Fourth"] as const;

/** Place of a handbook sequence in the degree. Sequence 1 is First Year, Fall. */
export function planPosition(sequence: number) {
    const yearIndex = Math.floor((sequence - 1) / 2);
    const namedYear = yearNames[yearIndex];
    const yearLabel = namedYear ? `${namedYear} Year` : `Year ${yearIndex + 1}`;
    const season = sequence % 2 === 1 ? "Fall" : "Spring";

    return {
        yearLabel,
        season,
        label: `${yearLabel}, ${season}`,
    };
}

export function requirementGroupTitle(group: RequirementGroup) {
    let name = group.name;

    if (group.slot.split("_").some(s => s === "ELECTIVE" || s === "POOL")) {
        name = name.replaceAll("Electives", "Elective");
    }

    switch (group.slot) {
        case "GEN_ED_POOL":
            return name + " (General Education)";
        case "TECHNICAL_ELECTIVE":
            return "Technical Elective";
        case "FREE_ELECTIVE":
            return "Free Elective";
        case "SUPPORTING_REQUIRED":
            return "Supporting Required";
        case "PROGRAM_CORE":
            return "Program Core";
        case "RELATED_POOL":
            return name;
        default:
            return name;
    }

}