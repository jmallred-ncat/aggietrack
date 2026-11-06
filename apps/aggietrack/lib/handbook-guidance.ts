import { courseOfferedInSeason, offeredSeasonsLabel, termSeasonLabel } from "./academic-term";
import type { TermSeason } from "./generated/prisma/client";

/**
 * Named course on a handbook term.
 * Sequence 1 is the first year, fall. Odd sequences are fall. Even sequences are spring.
 */
export type HandbookNamedCourse = {
    sequence: number;
    sortOrder: number;
    subject: string;
    number: string;
    title: string;
    offeredIn: readonly TermSeason[];
};

/** Class status already stored on the profile. The planner does not ask for it again. */
export type RecordedStanding = "FRESHMAN" | "SOPHOMORE" | "JUNIOR" | "SENIOR";

export type HandbookReference = {
    /** "Sophomore year" */
    classYear: string;
    code: string;
    title: string;
    /**
     * Why this course is not a choice in the open term, and a course that is.
     * Null when the handbook course is offered then.
     */
    aside: string | null;
};

const classYearNames = ["Freshman", "Sophomore", "Junior", "Senior"] as const;

/** Fall sequence where an entering student in that class year begins. */
const standingSequence: Record<RecordedStanding, number> = {
    FRESHMAN: 1,
    SOPHOMORE: 3,
    JUNIOR: 5,
    SENIOR: 7,
};

export function handbookCourseCode(course: { subject: string; number: string }) {
    return `${course.subject} ${course.number}`;
}

function classYearForSequence(sequence: number) {
    const index = Math.floor((sequence - 1) / 2);
    const named = classYearNames[index];
    return named ? `${named} year` : `Year ${index + 1}`;
}

function byHandbookOrder(a: HandbookNamedCourse, b: HandbookNamedCourse) {
    return a.sequence - b.sequence || a.sortOrder - b.sortOrder;
}

/** Fall and spring handbook terms share a season. Summer has no handbook column. */
function sequenceMatchesSeason(sequence: number, season: TermSeason) {
    if (season === "FALL") return sequence % 2 === 1;
    if (season === "SPRING") return sequence % 2 === 0;
    return false;
}

/**
 * The handbook course for the year the student is in, while one term is open.
 *
 * The year comes from coursework they already recorded. The first unfinished
 * named handbook course is the year they are in. When nothing is recorded, a
 * standing saved earlier is the entering year, and an empty start is freshman.
 * The result is a reference. It is not a course added to the term.
 */
export function handbookReferenceForTerm(input: {
    courses: readonly HandbookNamedCourse[];
    completed: ReadonlySet<string>;
    standing: RecordedStanding | null;
    season: TermSeason;
    termLabel: string;
}): HandbookReference | null {
    const courses = [...input.courses].sort(byHandbookOrder);
    const anyCompleted = courses.some((course) => input.completed.has(handbookCourseCode(course)));
    const fromSequence = !anyCompleted && input.standing ? standingSequence[input.standing] : 1;
    const expected = courses.find((course) =>
        course.sequence >= fromSequence && !input.completed.has(handbookCourseCode(course)),
    );
    if (!expected) return null;

    const code = handbookCourseCode(expected);
    const reference: HandbookReference = {
        classYear: classYearForSequence(expected.sequence),
        code,
        title: expected.title,
        aside: null,
    };
    if (courseOfferedInSeason(expected.offeredIn, input.season)) {
        return reference;
    }

    const yearStart = Math.floor((expected.sequence - 1) / 2) * 2 + 1;
    const sameYear = courses.filter((course) => course.sequence === yearStart || course.sequence === yearStart + 1);
    const seasonFirst = [
        ...sameYear.filter((course) => sequenceMatchesSeason(course.sequence, input.season)),
        ...sameYear.filter((course) => !sequenceMatchesSeason(course.sequence, input.season)),
    ];
    const suggestion = seasonFirst.find((course) =>
        handbookCourseCode(course) !== code
        && !input.completed.has(handbookCourseCode(course))
        && courseOfferedInSeason(course.offeredIn, input.season),
    );
    const seasonName = termSeasonLabel(input.season);
    let aside = `${code} is not a choice for ${input.termLabel} because it is not offered in ${seasonName}. It is offered in ${offeredSeasonsLabel(expected.offeredIn)}.`;
    if (suggestion) {
        aside += ` For ${input.termLabel}, you can add ${handbookCourseCode(suggestion)} ${suggestion.title}.`;
    }
    return { ...reference, aside };
}
