import { academicTermLabel } from "./academic-term";
import type { RequirementGroup, StudentStanding, TermSeason } from "./generated/prisma/client";
import { handbookReferenceForTerm, type RecordedStanding } from "./handbook-guidance";
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

function recordedStanding(standing: StudentStanding | null): RecordedStanding | null {
    if (
        standing === "FRESHMAN"
        || standing === "SOPHOMORE"
        || standing === "JUNIOR"
        || standing === "SENIOR"
    ) {
        return standing;
    }
    return null;
}

/** Handbook course for this student's year, as a reference for the term they have open. */
export async function getHandbookReference(
    student: { id: string; catalogYearId: string; standing: StudentStanding | null },
    term: { season: TermSeason; year: number },
) {
    const [recommended, entries] = await Promise.all([
        prisma.recommendedTerm.findMany({
            where: { catalogYearId: student.catalogYearId },
            orderBy: { sequence: "asc" },
            include: {
                courses: {
                    where: { courseId: { not: null } },
                    orderBy: { sortOrder: "asc" },
                    include: {
                        course: {
                            select: { subject: true, number: true, title: true, offeredIn: true },
                        },
                    },
                },
            },
        }),
        prisma.transcriptEntry.findMany({
            where: {
                studentId: student.id,
                status: "COMPLETED",
                courseId: { not: null },
            },
            select: {
                course: { select: { subject: true, number: true } },
            },
        }),
    ]);

    const courses = recommended.flatMap((row) =>
        row.courses.flatMap((item) => item.course
            ? [{
                sequence: row.sequence,
                sortOrder: item.sortOrder,
                subject: item.course.subject,
                number: item.course.number,
                title: item.course.title,
                offeredIn: item.course.offeredIn,
            }]
            : []),
    );
    const completed = new Set(
        entries.flatMap((entry) => entry.course ? [`${entry.course.subject} ${entry.course.number}`] : []),
    );

    return handbookReferenceForTerm({
        courses,
        completed,
        standing: recordedStanding(student.standing),
        season: term.season,
        termLabel: academicTermLabel(term),
    });
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

/** Subject rule shown beside an open elective, such as CST or CST 200+. */
export function requirementSlotBadge(group: {
    slot: string;
    subject: string | null;
    minNumber: number | null;
}) {
    if (!group.subject) {
        return null;
    }
    if (group.slot !== "TECHNICAL_ELECTIVE" && group.slot !== "RELATED_POOL") {
        return null;
    }
    if (group.minNumber != null) {
        return `${group.subject} ${group.minNumber}+`;
    }
    return group.subject;
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