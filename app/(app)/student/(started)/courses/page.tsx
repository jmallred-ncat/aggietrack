import { getCurriculumCourseSections } from "@/lib/catalog";
import { getPlannerAddContext } from "@/lib/planned-term";
import { requireStudentProfile } from "@/lib/student";
import { CourseBrowser } from "./course-browser";

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
            completedCourseIds={planner.completedCourseIds}
            plannedCourses={planner.plannedCourses}
        />
    );
}
