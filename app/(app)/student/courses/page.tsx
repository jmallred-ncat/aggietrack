import { getCurriculumCourseSections } from "@/lib/catalog";
import { requireStudentProfile } from "@/lib/student";
import { CourseBrowser } from "./course-browser";

export default async function CoursesPage() {
    const profile = await requireStudentProfile();
    const sections = await getCurriculumCourseSections();

    return <CourseBrowser profile={profile} sections={sections} />;
}
