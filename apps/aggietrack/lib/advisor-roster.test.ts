import assert from "node:assert/strict";
import { test } from "node:test";
import { TermSeason } from "./generated/prisma/client";
import { academicTerms } from "../prisma/seed/academic-terms";
import {
    advisorTermChoices,
    filterRoster,
    paginateRoster,
    ROSTER_PAGE_SIZE,
    safeStudentsReturn,
    sortRoster,
    type RosterRow,
} from "./advisor-roster";

function row(partial: Partial<RosterRow> & Pick<RosterRow, "id" | "firstName" | "lastName">): RosterRow {
    return {
        bannerId: null,
        planId: partial.status ? partial.id : null,
        status: null,
        submittedAt: null,
        reviewedAt: null,
        ...partial,
    };
}

test("the advisor term window defaults to the next term students can submit", () => {
    const choices = advisorTermChoices(academicTerms.map((term, index) => ({ ...term, id: String(index) })), new Date("2026-11-06T15:00:00.000Z"));
    assert.deepEqual(choices.terms.map((term) => `${term.season} ${term.year}`), ["FALL 2026", "SPRING 2027"]);
    assert.equal(choices.terms.find((term) => term.id === choices.defaultTermId)?.season, TermSeason.SPRING);
    assert.equal(choices.terms.find((term) => term.id === choices.defaultTermId)?.year, 2027);
});

test("needs review first puts the oldest submitted plan ahead of later statuses", () => {
    const rows = [
        row({ id: "d", firstName: "Avery", lastName: "Cole", status: "DRAFT", planId: "d" }),
        row({ id: "s2", firstName: "Riley", lastName: "Brooks", status: "SUBMITTED", planId: "s2", submittedAt: 20 }),
        row({ id: "s1", firstName: "Jordan", lastName: "Hale", status: "SUBMITTED", planId: "s1", submittedAt: 10 }),
        row({ id: "n", firstName: "Taylor", lastName: "Morgan" }),
        row({ id: "a", firstName: "Casey", lastName: "Parker", status: "APPROVED", planId: "a", reviewedAt: 5 }),
        row({ id: "r", firstName: "Alex", lastName: "Rivera", status: "RETURNED", planId: "r", reviewedAt: 30 }),
    ];
    assert.deepEqual(sortRoster(rows, "review").map((item) => item.id), ["s1", "s2", "r", "d", "a", "n"]);
    assert.deepEqual(sortRoster(rows, "name").map((item) => item.lastName), ["Brooks", "Cole", "Hale", "Morgan", "Parker", "Rivera"]);
});

test("search matches a name or student id and pagination stays on the server page size", () => {
    const rows = [
        row({ id: "1", firstName: "Jordan", lastName: "Hale", bannerId: "950111111", status: "SUBMITTED", planId: "1" }),
        row({ id: "2", firstName: "Avery", lastName: "Cole", bannerId: "950222222", status: "DRAFT", planId: "2" }),
    ];
    assert.deepEqual(filterRoster(rows, { q: "  hale " }).map((item) => item.id), ["1"]);
    assert.deepEqual(filterRoster(rows, { q: "950222222" }).map((item) => item.id), ["2"]);
    assert.deepEqual(filterRoster(rows, { status: "SUBMITTED" }).map((item) => item.id), ["1"]);
    assert.deepEqual(filterRoster(rows, { status: "none" }).map((item) => item.id), []);
    const many = Array.from({ length: 25 }, (_, index) => row({
        id: String(index).padStart(2, "0"),
        firstName: "Student",
        lastName: String(index).padStart(2, "0"),
    }));
    const page = paginateRoster(many, 2);
    assert.equal(ROSTER_PAGE_SIZE, 20);
    assert.equal(page.pages, 2);
    assert.equal(page.rows.length, 5);
    assert.equal(page.rows[0]?.id, "20");
});

test("a return path stays inside the students roster", () => {
    assert.equal(safeStudentsReturn("/advisor/students?term=spring"), "/advisor/students?term=spring");
    assert.equal(safeStudentsReturn("https://example.test/advisor/students"), "/advisor/students");
    assert.equal(safeStudentsReturn("/student/planner"), "/advisor/students");
});
