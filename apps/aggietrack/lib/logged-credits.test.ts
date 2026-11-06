import assert from "node:assert/strict";
import { test } from "node:test";
import { courses } from "../prisma/seed/courses";
import { elet2025 } from "../prisma/seed/elet-2025";
import { info2025 } from "../prisma/seed/info-2025";
import type { CurriculumSeed } from "../prisma/seed/curriculum";
import { loggedRequirementCredits, type LoggedEntry, type LoggedGroup } from "./logged-credits";

const PROGRAM_TOTAL = 120;

function courseId(subject: string, number: string) {
    return `${subject} ${number}`;
}

function creditsFor(subject: string, number: string) {
    const course = courses.find((item) => item.subject === subject && item.number === number);
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

function completed(subject: string, number: string, groupId: string | null = null): LoggedEntry {
    return {
        courseId: courseId(subject, number),
        credits: creditsFor(subject, number),
        status: "COMPLETED",
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
    const failedButCompleted: LoggedEntry = { courseId: "CST 120", credits: 3, status: "COMPLETED", groupId: null };
    const summary = loggedRequirementCredits(groups, [failedButCompleted, failedButCompleted]);
    assert.equal(summary.groups.find((group) => group.id === "core")?.earnedCredits, 6);
    assert.equal(summary.groups.find((group) => group.id === "also")?.earnedCredits, 6);
});

test("one entry counts once for a group it matches as both a listed course and a slot", () => {
    const groups: LoggedGroup[] = [
        { id: "math", name: "Mathematics", minCredits: 11, sortOrder: 1, courseIds: ["MATH 110"] },
    ];
    const summary = loggedRequirementCredits(groups, [{
        courseId: "MATH 110",
        credits: 4,
        status: "COMPLETED",
        groupId: "math",
    }]);
    assert.equal(summary.groups[0]?.earnedCredits, 4);
});

test("a catalog year with no groups has nothing to list", () => {
    const summary = loggedRequirementCredits([], [completed("MATH", "110")]);
    assert.deepEqual(summary.groups, []);
    assert.equal(summary.hasCompletedEntries, true);
});
