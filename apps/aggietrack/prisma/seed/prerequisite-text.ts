import type { CourseRef } from "./courses";

const COURSE_TOKEN = /\b([A-Z]{2,8})\s+(\d{3}[A-Z]?)\b/g;

export type PrerequisiteClause = {
    options: CourseRef[];
    note: string | null;
};

export type PrerequisiteGroupSeed = {
    course: CourseRef;
    isConcurrent: boolean;
    options: CourseRef[];
    note: string | null;
};

function extractCourseRefs(text: string): CourseRef[] {
    const refs: CourseRef[] = [];
    const seen = new Set<string>();

    for (const match of text.matchAll(COURSE_TOKEN)) {
        const ref = { subject: match[1], number: match[2] };
        const key = `${ref.subject} ${ref.number}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        refs.push(ref);
    }

    return refs;
}

function normalizeRequirementText(text: string) {
    return text
        .trim()
        .replace(/[“”]/g, "\"")
        .replace(/[‘’]/g, "'")
        .replace(/\s+/g, " ")
        .replace(/\.$/, "");
}

function mentionsUnparsedAlternative(text: string) {
    return /\b(SAT|ACT|score|standing|placement|approval|consent|instructor|equivalent|units of high school)\b/i.test(text);
}

function mentionsGrade(text: string) {
    return /\bgrade\b|\bor better\b|minimum grade/i.test(text);
}

/**
 * Groups in the returned list are combined with AND.
 * Courses inside one group are combined with OR.
 * A note is catalog text that completed courses cannot prove (scores, standing, consent, "or higher").
 */
export function parsePrerequisiteClauses(text: string): PrerequisiteClause[] {
    const cleaned = normalizeRequirementText(text);
    if (!cleaned) {
        return [];
    }

    const pieces = cleaned.split(/\s*;\s*/).flatMap((part) => {
        const piece = part.trim();
        if (!piece) {
            return [];
        }
        if (mentionsUnparsedAlternative(piece)) {
            return [piece.replace(/^(?:and|or)\s+/i, "")];
        }
        return piece
            .split(/\s+\band\b\s+/i)
            .map((item) => item.replace(/^(?:and|or)\s+/i, "").trim())
            .filter(Boolean);
    });

    return pieces.flatMap(parsePiece);
}

function parsePiece(piece: string): PrerequisiteClause[] {
    if (/\bor higher\b|\bor above\b/i.test(piece)) {
        return [{ options: [], note: piece }];
    }

    const courses = extractCourseRefs(piece);
    const keepNote = mentionsUnparsedAlternative(piece) || mentionsGrade(piece);

    if (courses.length === 0) {
        return [{ options: [], note: piece }];
    }

    if (!/\bor\b/i.test(piece) && courses.length > 1) {
        return courses.map((course) => ({
            options: [course],
            note: keepNote ? piece : null,
        }));
    }

    return [{
        options: courses,
        note: keepNote ? piece : null,
    }];
}

export function prerequisiteGroupsFor(
    course: CourseRef,
    text: string | null | undefined,
    isConcurrent: boolean,
): PrerequisiteGroupSeed[] {
    if (!text?.trim()) {
        return [];
    }

    return parsePrerequisiteClauses(text).map((clause) => ({
        course,
        isConcurrent,
        options: clause.options,
        note: clause.note,
    }));
}
