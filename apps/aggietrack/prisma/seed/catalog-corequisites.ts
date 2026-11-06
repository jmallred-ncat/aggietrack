import { courseKey, type CourseRef } from "./courses";
import type { PrerequisiteGroupSeed } from "./prerequisite-text";

/** A directed catalog corequisite, such as `CST-122>CST-112`. */
export function catalogCorequisiteEdge(course: CourseRef, option: CourseRef) {
    return `${courseKey(course)}>${courseKey(option)}`;
}

/** Directions written in catalog corequisite text. A seed-only reverse link is absent. */
export function catalogCorequisiteEdges(groups: readonly PrerequisiteGroupSeed[]) {
    const edges = new Set<string>();
    for (const group of groups) {
        if (!group.isConcurrent) continue;
        for (const option of group.options) {
            edges.add(catalogCorequisiteEdge(group.course, option));
        }
    }
    return edges;
}
