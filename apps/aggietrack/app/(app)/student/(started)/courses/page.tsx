import { getCurriculumCourseSections } from "@/lib/catalog";
import { CATALOG_BROWSER_LABEL } from "@/lib/course-search";
import { getPlannerAddContext } from "@/lib/planned-term";
import { requireStudentProfile } from "@/lib/student";
import type { Metadata } from "next";
import { CourseBrowser } from "./course-browser";

export const metadata: Metadata = {
    title: CATALOG_BROWSER_LABEL,
};

export default async function CoursesPage() {
    const profile = await requireStudentProfile();
    const [sections, planner] = await Promise.all([
        getCurriculumCourseSections(),
        getPlannerAddContext(),
    ]);

    return (
        <CourseBrowser
            profile={profile}
            sections={sections}
            planningTerms={planner.terms}
            placements={planner.placements}
            satisfiedCourseIds={planner.satisfiedCourseIds}
            plannedCourses={planner.plannedCourses}
        />
    );
}
