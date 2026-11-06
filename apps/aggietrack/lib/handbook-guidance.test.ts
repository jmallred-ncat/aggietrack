import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { courseKey, courses as handbookCourses } from "../prisma/seed/courses";
import { mergeCstCatalogCourses } from "../prisma/seed/cst-catalog";
import { mergeGecCourses } from "../prisma/seed/gec";
import { info2025 } from "../prisma/seed/info-2025";
import { mergeMgmtCourses } from "../prisma/seed/mgmt";
import { courseOfferedInSeason } from "./academic-term";
import { TermSeason } from "./generated/prisma/client";
import {
    handbookCourseCode,
    handbookReferenceForTerm,
    type HandbookNamedCourse,
} from "./handbook-guidance";
import { selectPlannableCourses, type PlannableCourse } from "./plannable-courses";

const merged = new Map(
    mergeCstCatalogCourses(mergeMgmtCourses(mergeGecCourses(handbookCourses))).map((course) => [courseKey(course), course]),
);

const infoCourses: HandbookNamedCourse[] = info2025.recommended.flatMap((term) =>
    term.courses.map((course, sortOrder) => {
        const row = merged.get(courseKey(course));
        if (!row) throw new Error(`${course.subject} ${course.number} is missing from the catalog merge.`);
        return {
            sequence: term.sequence,
            sortOrder,
            subject: row.subject,
            number: row.number,
            title: row.title,
            offeredIn: row.offeredIn ?? [],
        };
    }),
);

function completedThrough(sequence: number) {
    return new Set(
        infoCourses.filter((course) => course.sequence <= sequence).map((course) => handbookCourseCode(course)),
    );
}

function referenceFor(input: {
    completed?: ReadonlySet<string>;
    standing?: "FRESHMAN" | "SOPHOMORE" | "JUNIOR" | "SENIOR" | null;
    season?: TermSeason;
    termLabel?: string;
    courses?: HandbookNamedCourse[];
}) {
    return handbookReferenceForTerm({
        courses: input.courses ?? infoCourses,
        completed: input.completed ?? new Set(),
        standing: input.standing ?? null,
        season: input.season ?? TermSeason.SPRING,
        termLabel: input.termLabel ?? "Spring 2027",
    });
}

const rawEnum = /\b(FALL|SPRING|SUMMER_I|SUMMER_II|SUMMER|FRESHMAN|SOPHOMORE|JUNIOR|SENIOR)\b/;

test("a sophomore who finished the first year sees CST 231 while planning spring", () => {
    const reference = referenceFor({ completed: completedThrough(2), season: TermSeason.SPRING });
    assert.ok(reference);
    assert.equal(reference.classYear, "Sophomore year");
    assert.equal(reference.code, "CST 231");
    assert.equal(reference.title, "Web Systems");
    assert.match(reference.aside ?? "", /CST 231 is not a choice for Spring 2027/);
    assert.match(reference.aside ?? "", /not offered in Spring/);
    assert.match(reference.aside ?? "", /offered in Fall or Summer/);
    assert.match(reference.aside ?? "", /you can add CST 225 Computer Database Management I/);
    assert.doesNotMatch(`${reference.classYear} ${reference.aside}`, rawEnum);

    const suggested = infoCourses.find((course) => handbookCourseCode(course) === "CST 225");
    const expected = infoCourses.find((course) => handbookCourseCode(course) === "CST 231");
    assert.ok(suggested && expected);
    assert.equal(courseOfferedInSeason(suggested.offeredIn, TermSeason.SPRING), true);
    assert.equal(courseOfferedInSeason(expected.offeredIn, TermSeason.SPRING), false);
});

test("an entering sophomore uses the standing already saved, and is not asked again", () => {
    const fromStanding = referenceFor({ standing: "SOPHOMORE", season: TermSeason.SPRING });
    const fromCoursework = referenceFor({ completed: completedThrough(2), standing: "FRESHMAN", season: TermSeason.SPRING });
    assert.equal(fromStanding?.code, "CST 231");
    assert.equal(fromStanding?.classYear, "Sophomore year");
    assert.equal(fromCoursework?.code, "CST 231");
    assert.match(fromCoursework?.aside ?? "", /CST 225/);
});

test("a freshman with no recorded courses is shown the first handbook course", () => {
    const spring = referenceFor({ season: TermSeason.SPRING });
    assert.equal(spring?.classYear, "Freshman year");
    assert.equal(spring?.code, "CST 120");
    assert.equal(spring?.title, "Fundamentals of Technology");
    assert.equal(spring?.aside, null);

    const recorded = referenceFor({ standing: "FRESHMAN", season: TermSeason.FALL, termLabel: "Fall 2026" });
    assert.equal(recorded?.code, "CST 120");
    assert.equal(recorded?.aside, null);
});

test("CST 231 is a quiet reference in fall and in summer, when the catalog offers it", () => {
    const fall = referenceFor({
        completed: completedThrough(2),
        season: TermSeason.FALL,
        termLabel: "Fall 2026",
    });
    const summer = referenceFor({
        completed: completedThrough(2),
        season: TermSeason.SUMMER_I,
        termLabel: "Summer I 2027",
    });
    assert.equal(fall?.code, "CST 231");
    assert.equal(fall?.aside, null);
    assert.equal(summer?.code, "CST 231");
    assert.equal(summer?.aside, null);
});

test("the spring suggestion is a same-year course the catalog offers, and never the course it does not", () => {
    const blocked = referenceFor({
        standing: "SOPHOMORE",
        courses: [
            { sequence: 3, sortOrder: 0, subject: "CST", number: "231", title: "Web Systems", offeredIn: [TermSeason.FALL, TermSeason.SUMMER] },
            { sequence: 3, sortOrder: 1, subject: "CST", number: "240", title: "Applied Java Programming", offeredIn: [TermSeason.FALL] },
            { sequence: 4, sortOrder: 0, subject: "CST", number: "225", title: "Computer Database Management I", offeredIn: [TermSeason.FALL] },
        ],
    });
    assert.match(blocked?.aside ?? "", /CST 231 is not a choice/);
    assert.doesNotMatch(blocked?.aside ?? "", /you can add/);

    const fallback = referenceFor({
        standing: "SOPHOMORE",
        courses: [
            { sequence: 3, sortOrder: 0, subject: "CST", number: "231", title: "Web Systems", offeredIn: [TermSeason.FALL] },
            { sequence: 3, sortOrder: 1, subject: "CST", number: "240", title: "Applied Java Programming", offeredIn: [TermSeason.SPRING] },
            { sequence: 4, sortOrder: 0, subject: "CST", number: "225", title: "Computer Database Management I", offeredIn: [TermSeason.FALL] },
        ],
    });
    assert.match(fallback?.aside ?? "", /you can add CST 240 Applied Java Programming/);
    assert.doesNotMatch(fallback?.aside ?? "", /CST 225/);
});

test("spring planning does not list CST 231 as a course that can be added", () => {
    const webSystems = infoCourses.find((course) => course.number === "231");
    assert.ok(webSystems);
    const course: PlannableCourse = {
        id: "cst-231",
        subject: webSystems.subject,
        number: webSystems.number,
        title: webSystems.title,
        credits: 3,
        offeredIn: [...webSystems.offeredIn],
        prerequisiteGroups: [{ isConcurrent: false, optionIds: [] }],
    };
    const spring = selectPlannableCourses([course], TermSeason.SPRING, new Set(), new Set(), new Set());
    const fall = selectPlannableCourses([course], TermSeason.FALL, new Set(), new Set(), new Set());
    assert.deepEqual(spring.map((row) => row.number), []);
    assert.deepEqual(fall.map((row) => row.number), ["231"]);
});

test("the planner shows the handbook reference as text and does not ask for a class year", () => {
    const editor = readFileSync(new URL("../app/(app)/student/(started)/planner/PlanEditor.tsx", import.meta.url), "utf8");
    const page = readFileSync(new URL("../app/(app)/student/(started)/planner/page.tsx", import.meta.url), "utf8");
    const note = editor.slice(editor.indexOf("function HandbookReferenceNote"), editor.indexOf("type PlannedRow"));
    assert.match(note, /data-handbook-reference/);
    assert.doesNotMatch(note, /<button|addPlannedCourse|onClick|FRESHMAN|SOPHOMORE/);
    assert.match(page, /getHandbookReference/);
    assert.doesNotMatch(page, /Student status|standingSchema|FRESHMAN/);
});
