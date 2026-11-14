import assert from "node:assert/strict";
import { test } from "node:test";
import { courses } from "../prisma/seed/courses";
import { gecCourses } from "../prisma/seed/gec";
import { cstCatalogCourses } from "../prisma/seed/cst-catalog";
import { mgmtCourses } from "../prisma/seed/mgmt";
import { elet2025 } from "../prisma/seed/elet-2025";
import { info2025 } from "../prisma/seed/info-2025";
import type { CurriculumSeed } from "../prisma/seed/curriculum";
import { loggedRequirementCredits, type LoggedEntry, type LoggedGroup } from "./logged-credits";
import { plannedAttempts } from "./frozen-transcript";
import { testStudents } from "./test-students";

const PROGRAM_TOTAL = 120;
const allCourses = [...courses, ...gecCourses, ...cstCatalogCourses, ...mgmtCourses];

function courseId(subject: string, number: string) {
    return `${subject} ${number}`;
}

function creditsFor(subject: string, number: string) {
    const course = allCourses.find((item) => item.subject === subject && item.number === number);
    assert.ok(course, `${subject} ${number} is in the course seed`);
    return course.credits;
}

function groupsFromSeed(curriculum: CurriculumSeed): LoggedGroup[] {
    return curriculum.groups.map((group) => ({
        id: group.name,
        name: group.name,
        minCredits: group.minCredits,
        sortOrder: group.sortOrder,
        courseIds: (group.courses ?? []).map((course) => courseId(course.subject, course.number)),
    }));
}

let nextTimestamp = Date.UTC(2024, 0, 1);

function completed(subject: string, number: string, groupId: string | null = null, grade: string = "B"): LoggedEntry {
    return {
        courseId: courseId(subject, number),
        credits: creditsFor(subject, number),
        status: "COMPLETED",
        grade,
        createdAt: new Date(nextTimestamp++),
        groupId,
    };
}

test("Information Technology and Electronics Technology list different groups", () => {
    const info = loggedRequirementCredits(groupsFromSeed(info2025), []);
    const elet = loggedRequirementCredits(groupsFromSeed(elet2025), []);

    assert.deepEqual(info.groups.map((group) => group.name), info2025.groups.map((group) => group.name));
    assert.deepEqual(elet.groups.map((group) => group.name), elet2025.groups.map((group) => group.name));
    assert.notDeepEqual(info.groups.map((group) => group.name), elet.groups.map((group) => group.name));
    assert.equal(info.groups.find((group) => group.name === "Mathematics")?.requiredCredits, 11);
    assert.equal(elet.groups.find((group) => group.name === "Mathematics")?.requiredCredits, 15);
    assert.equal(info.groups.find((group) => group.name === "Scientific Reasoning")?.requiredCredits, 7);
    assert.equal(elet.groups.find((group) => group.name === "Physics")?.requiredCredits, 8);
    assert.equal(info.groups.some((group) => group.name === "Physics"), false);
    assert.equal(elet.groups.some((group) => group.name === "Scientific Reasoning"), false);
});

test("required credits match the seed and add up to the program total", () => {
    for (const curriculum of [info2025, elet2025]) {
        const summary = loggedRequirementCredits(groupsFromSeed(curriculum), []);
        assert.deepEqual(
            summary.groups.map((group) => [group.name, group.requiredCredits]),
            [...curriculum.groups]
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((group) => [group.name, group.minCredits]),
        );
        const required = summary.groups.reduce((total, group) => total + group.requiredCredits, 0);
        assert.equal(required, PROGRAM_TOTAL);
    }
});

test("groups stay in sort order even when the input is shuffled", () => {
    const shuffled = [...groupsFromSeed(info2025)].reverse();
    const summary = loggedRequirementCredits(shuffled, []);
    assert.deepEqual(
        summary.groups.map((group) => group.name),
        [...info2025.groups].sort((a, b) => a.sortOrder - b.sortOrder).map((group) => group.name),
    );
});

test("earned credits stay at 0 until a completed entry is logged", () => {
    const groups = groupsFromSeed(info2025);
    const empty = loggedRequirementCredits(groups, []);
    assert.equal(empty.hasCompletedEntries, false);
    assert.ok(empty.groups.every((group) => group.earnedCredits === 0));

    const inProgress: LoggedEntry = {
        ...completed("MATH", "110"),
        status: "IN_PROGRESS",
    };
    const stillEmpty = loggedRequirementCredits(groups, [inProgress, { ...completed("CST", "120"), status: "FAILED" }, { ...completed("ENGL", "100"), status: "WITHDRAWN" }]);
    assert.equal(stillEmpty.hasCompletedEntries, false);
    assert.ok(stillEmpty.groups.every((group) => group.earnedCredits === 0));

    const logged = loggedRequirementCredits(groups, [completed("MATH", "110")]);
    assert.equal(logged.hasCompletedEntries, true);
    assert.equal(logged.groups.find((group) => group.name === "Mathematics")?.earnedCredits, 4);
    assert.equal(logged.groups.find((group) => group.name === "CST Major Core")?.earnedCredits, 0);

    const removed = loggedRequirementCredits(groups, []);
    assert.equal(removed.hasCompletedEntries, false);
    assert.equal(removed.groups.find((group) => group.name === "Mathematics")?.earnedCredits, 0);
});

test("adding and removing completed entries updates only the groups that list them", () => {
    const groups = groupsFromSeed(info2025);
    const withMath = loggedRequirementCredits(groups, [completed("MATH", "110")]);
    const withBoth = loggedRequirementCredits(groups, [completed("MATH", "110"), completed("CST", "120")]);
    const mathOnly = loggedRequirementCredits(groups, [completed("MATH", "110")]);

    assert.equal(withMath.groups.find((group) => group.name === "Mathematics")?.earnedCredits, 4);
    assert.equal(withBoth.groups.find((group) => group.name === "Mathematics")?.earnedCredits, 4);
    assert.equal(withBoth.groups.find((group) => group.name === "CST Major Core")?.earnedCredits, 3);
    assert.equal(mathOnly.groups.find((group) => group.name === "CST Major Core")?.earnedCredits, 0);
    assert.equal(mathOnly.groups.find((group) => group.name === "Mathematics")?.earnedCredits, 4);
});

test("a handbook slot adds its credits to that group, including a course the group does not list", () => {
    const groups = groupsFromSeed(info2025);
    const summary = loggedRequirementCredits(groups, [completed("CST", "212", "Technical Electives")]);
    assert.equal(summary.groups.find((group) => group.name === "Technical Electives")?.earnedCredits, creditsFor("CST", "212"));
    assert.equal(summary.groups.find((group) => group.name === "CST Major Core")?.earnedCredits, 0);
});

test("the log does not apply a minimum grade or stop one course from filling two groups", () => {
    const groups: LoggedGroup[] = [
        { id: "core", name: "Core", minCredits: 6, sortOrder: 1, courseIds: ["CST 120"] },
        { id: "also", name: "Also core", minCredits: 3, sortOrder: 2, courseIds: ["CST 120"] },
    ];
    const passingEntry: LoggedEntry = { 
        courseId: "CST 120", 
        credits: 3, 
        status: "COMPLETED", 
        grade: "B",
        createdAt: new Date(nextTimestamp++),
        groupId: null 
    };
    const summary = loggedRequirementCredits(groups, [passingEntry, passingEntry]);
    // With retake logic, same course counts once even if listed twice
    assert.equal(summary.groups.find((group) => group.id === "core")?.earnedCredits, 3);
    assert.equal(summary.groups.find((group) => group.id === "also")?.earnedCredits, 3);
});

test("one entry counts once for a group it matches as both a listed course and a slot", () => {
    const groups: LoggedGroup[] = [
        { id: "math", name: "Mathematics", minCredits: 11, sortOrder: 1, courseIds: ["MATH 110"] },
    ];
    const summary = loggedRequirementCredits(groups, [{
        courseId: "MATH 110",
        credits: 4,
        status: "COMPLETED",
        grade: "B",
        createdAt: new Date(nextTimestamp++),
        groupId: "math",
    }]);
    assert.equal(summary.groups[0]?.earnedCredits, 4);
});

test("a catalog year with no groups has nothing to list", () => {
    const summary = loggedRequirementCredits([], [completed("MATH", "110")]);
    assert.deepEqual(summary.groups, []);
    assert.equal(summary.hasCompletedEntries, true);
});

test("failed courses do not count as earned credits", () => {
    const groups = groupsFromSeed(info2025);
    const failed: LoggedEntry = {
        courseId: courseId("CST", "120"),
        credits: creditsFor("CST", "120"),
        status: "FAILED",
        grade: "F",
        createdAt: new Date(nextTimestamp++),
        groupId: null,
    };
    const summary = loggedRequirementCredits(groups, [completed("CST", "130"), failed]);
    assert.equal(summary.groups.find((group) => group.name === "CST Major Core")?.earnedCredits, 3, "only completed CST 130 should count");
    assert.equal(summary.hasCompletedEntries, true);
});

test("repeat: failed course then passed counts once with passing grade", () => {
    const groups = groupsFromSeed(info2025);
    const failed: LoggedEntry = {
        courseId: courseId("CST", "112"),
        credits: creditsFor("CST", "112"),
        status: "FAILED",
        grade: "F",
        createdAt: new Date(nextTimestamp++),
        groupId: null,
    };
    const passed = completed("CST", "112");
    const summary = loggedRequirementCredits(groups, [failed, passed]);
    assert.equal(summary.groups.find((group) => group.name === "CST Major Core")?.earnedCredits, creditsFor("CST", "112"), "should count once for the passing attempt");
    assert.equal(summary.hasCompletedEntries, true);
});

test("multiple passing attempts of the same course count once (most recent)", () => {
    const groups: LoggedGroup[] = [
        { id: "core", name: "Core", minCredits: 6, sortOrder: 1, courseIds: ["CST 120"] },
    ];
    const first = completed("CST", "120", null, "C");
    const second = completed("CST", "120", null, "A");
    const summary = loggedRequirementCredits(groups, [first, second]);
    assert.equal(summary.groups[0]?.earnedCredits, 3, "counts once, most recent attempt");
});

test("reset state: Taylor has CST 112 F and B, should count once (14 earned for CST Major Core)", () => {
    const groups = groupsFromSeed(info2025);
    const taylor = testStudents.find((s) => s.email === "it.retake-f-to-pass@example.test");
    assert.ok(taylor, "Taylor test student exists");
    
    const attempts = plannedAttempts(taylor);
    const entries: LoggedEntry[] = attempts.map((attempt, index) => ({
        courseId: courseId(attempt.subject, attempt.number),
        credits: attempt.entered?.credits ?? creditsFor(attempt.subject, attempt.number),
        status: attempt.status,
        grade: attempt.grade,
        createdAt: new Date(Date.UTC(2024, 0, index + 1)),
        groupId: null,
    }));
    
    const summary = loggedRequirementCredits(groups, entries);
    const groupNames = summary.groups.map((g) => g.name).join(", ");
    const cstCore = summary.groups.find((group) => group.name === "CST Major Core");
    assert.ok(cstCore, `CST Major Core group should exist. Available: ${groupNames}`);
    assert.equal(cstCore.earnedCredits, 14, `Taylor: CST Major Core should have 14 earned credits (CST 112 counted once). Got ${cstCore.earnedCredits}`);
});

test("reset state: Casey has CST 130 W, should not count (14 earned for CST Major Core)", () => {
    const groups = groupsFromSeed(info2025);
    const casey = testStudents.find((s) => s.email === "it.retake-c-to-a@example.test");
    assert.ok(casey, "Casey test student exists");
    
    const attempts = plannedAttempts(casey);
    const entries: LoggedEntry[] = attempts.map((attempt, index) => ({
        courseId: courseId(attempt.subject, attempt.number),
        credits: attempt.entered?.credits ?? creditsFor(attempt.subject, attempt.number),
        status: attempt.status,
        grade: attempt.grade,
        createdAt: new Date(Date.UTC(2024, 0, index + 1)),
        groupId: null,
    }));
    
    const summary = loggedRequirementCredits(groups, entries);
    const cstCore = summary.groups.find((group) => group.name === "CST Major Core");
    assert.equal(cstCore?.earnedCredits, 14, "Casey: CST Major Core should have 14 earned credits (W doesn't count)");
});

test("reset state: Alex has W/I/F attempts, none should count (16 earned for CST Major Core)", () => {
    const groups = groupsFromSeed(info2025);
    const alex = testStudents.find((s) => s.email === "it.diverse-grades@example.test");
    assert.ok(alex, "Alex test student exists");
    
    const attempts = plannedAttempts(alex);
    const entries: LoggedEntry[] = attempts.map((attempt, index) => ({
        courseId: courseId(attempt.subject, attempt.number),
        credits: attempt.entered?.credits ?? creditsFor(attempt.subject, attempt.number),
        status: attempt.status,
        grade: attempt.grade,
        createdAt: new Date(Date.UTC(2024, 0, index + 1)),
        groupId: null,
    }));
    
    const summary = loggedRequirementCredits(groups, entries);
    const cstCore = summary.groups.find((group) => group.name === "CST Major Core");
    assert.equal(cstCore?.earnedCredits, 16, "Alex: CST Major Core should have 16 earned credits (W/I/F don't count)");
});

test("student-entered retake: F followed by passing grade counts once", () => {
    const groups = groupsFromSeed(info2025);
    const failedEntry: LoggedEntry = {
        courseId: courseId("CST", "120"),
        credits: creditsFor("CST", "120"),
        status: "COMPLETED", // Student entered with F grade but COMPLETED status
        grade: "F",
        createdAt: new Date(Date.UTC(2024, 0, 1)),
        groupId: null,
    };
    const passingEntry: LoggedEntry = {
        courseId: courseId("CST", "120"),
        credits: creditsFor("CST", "120"),
        status: "COMPLETED",
        grade: "B",
        createdAt: new Date(Date.UTC(2024, 1, 1)),
        groupId: null,
    };
    
    const summary = loggedRequirementCredits(groups, [failedEntry, passingEntry]);
    const cstCore = summary.groups.find((group) => group.name === "CST Major Core");
    assert.equal(cstCore?.earnedCredits, 3, "F grade doesn't count, only passing attempt counts");
});

test("student-entered retake with FAILED status: F then passing grade counts once in requirement and overall", () => {
    const groups = groupsFromSeed(info2025);
    const failedEntry: LoggedEntry = {
        courseId: courseId("CST", "120"),
        credits: creditsFor("CST", "120"),
        status: "FAILED", // Properly marked as FAILED
        grade: "F",
        createdAt: new Date(Date.UTC(2024, 0, 1)),
        groupId: null,
    };
    const passingEntry: LoggedEntry = {
        courseId: courseId("CST", "120"),
        credits: creditsFor("CST", "120"),
        status: "COMPLETED",
        grade: "B",
        createdAt: new Date(Date.UTC(2024, 1, 1)),
        groupId: null,
    };
    
    const summary = loggedRequirementCredits(groups, [failedEntry, passingEntry]);
    const cstCore = summary.groups.find((group) => group.name === "CST Major Core");
    assert.equal(cstCore?.earnedCredits, 3, "FAILED F doesn't count, only passing attempt counts");
    assert.equal(summary.totalEarnedCredits, 3, "Overall should also count once");
});
