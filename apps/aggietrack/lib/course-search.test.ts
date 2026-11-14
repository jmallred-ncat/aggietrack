import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { cstCatalogGroups } from "../prisma/seed/cst-catalog";
import { gecCatalogGroups } from "../prisma/seed/gec";
import { mgmtCatalogGroups } from "../prisma/seed/mgmt";
import { TermSeason } from "./generated/prisma/client";
import { selectPlannableCourses, type PlannableCourse } from "./plannable-courses";
import { CATALOG_BROWSER_LABEL, courseMatchesSearch } from "./course-search";
import {
    ADVISOR_REVIEW_PREREQUISITES,
    coursePrerequisitesNeedAdvisorReview,
} from "./prerequisites";

const browserSource = readFileSync(
    new URL("../app/(app)/student/(started)/courses/course-browser.tsx", import.meta.url),
    "utf8",
);
const plannerSource = readFileSync(
    new URL("../app/(app)/student/(started)/planner/PlanEditor.tsx", import.meta.url),
    "utf8",
);

const cst300 = {
    subject: "CST",
    number: "300",
    title: "Introduction to Project Management for Information Technology Professionals",
};

test("catalog and planner search match a course code or title", () => {
    assert.equal(courseMatchesSearch(cst300, "cst 300"), true);
    assert.equal(courseMatchesSearch(cst300, "  CST 300  "), true);
    assert.equal(courseMatchesSearch(cst300, "project management"), true);
    assert.equal(courseMatchesSearch(cst300, "critical path"), false);
    assert.equal(courseMatchesSearch(cst300, ""), false);
    assert.match(browserSource, /courseMatchesSearch/);
    assert.match(plannerSource, /courseMatchesSearch/);
});

test("the courses page is labeled Catalog browser and has a search box", () => {
    assert.equal(CATALOG_BROWSER_LABEL, "Catalog browser");
    assert.match(browserSource, /CATALOG_BROWSER_LABEL/);
    assert.match(browserSource, /id="catalog-course-search"/);
    assert.match(browserSource, /Search for a course/);
});

test("malformed catalog prerequisite text is not imported as a rule", () => {
    const groups = [...cstCatalogGroups, ...gecCatalogGroups, ...mgmtCatalogGroups];
    const byCourse = Map.groupBy(groups, (group) => `${group.course.subject} ${group.course.number}`);
    const needsReview = [...byCourse.entries()]
        .filter(([, courseGroups]) => coursePrerequisitesNeedAdvisorReview(courseGroups.map((group) => ({
            isConcurrent: group.isConcurrent,
            optionCount: group.options.length,
            note: group.note,
        }))))
        .map(([code]) => code);

    assert.deepEqual(needsReview, []);
    assert.equal(byCourse.get("CST 300"), undefined);
    assert.equal(ADVISOR_REVIEW_PREREQUISITES, "Prerequisites need advisor review");
    assert.match(browserSource, /ADVISOR_REVIEW_PREREQUISITES/);
    assert.doesNotMatch(browserSource, /critical path/);
});

test("planner search leaves out a course whose prerequisites could not be checked", () => {
    const unresolved: PlannableCourse = {
        id: "cst-300",
        subject: "CST",
        number: "300",
        title: cst300.title,
        credits: 3,
        offeredIn: [TermSeason.SPRING, TermSeason.SUMMER],
        prerequisitesNeedAdvisorReview: true,
        prerequisiteGroups: [{ isConcurrent: false, optionIds: [] }],
    };
    const open: PlannableCourse = {
        id: "cst-130",
        subject: "CST",
        number: "130",
        title: "Introduction to Computing",
        credits: 3,
        offeredIn: [TermSeason.SPRING],
        prerequisiteGroups: [],
    };

    const matches = selectPlannableCourses(
        [unresolved, open],
        TermSeason.SPRING,
        new Set(),
        new Set(),
        new Set(),
        new Set(),
    ).filter((course) => courseMatchesSearch(course, "cst"));

    assert.deepEqual(matches.map((course) => course.number), ["130"]);
});

test("courses on the transcript (including Incomplete) are not plannable", () => {
    const cst120: PlannableCourse = {
        id: "cst-120",
        subject: "CST",
        number: "120",
        title: "Computer Science I",
        credits: 3,
        offeredIn: [TermSeason.FALL, TermSeason.SPRING],
        prerequisiteGroups: [],
    };
    
    // Course not on transcript should be plannable
    const withoutTranscript = selectPlannableCourses(
        [cst120],
        TermSeason.FALL,
        new Set(),
        new Set(),
        new Set(),
        new Set(),
    );
    assert.equal(withoutTranscript.length, 1, "Course should be plannable when not on transcript");
    
    // Course on transcript (even if Incomplete) should not be plannable
    const withTranscript = selectPlannableCourses(
        [cst120],
        TermSeason.FALL,
        new Set(),
        new Set(),
        new Set(),
        new Set(["cst-120"]), // On transcript
    );
    assert.equal(withTranscript.length, 0, "Course on transcript should not be plannable");
});
