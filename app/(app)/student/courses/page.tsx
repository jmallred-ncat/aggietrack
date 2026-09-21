import { getCurriculumCourseSections } from "@/lib/catalog";
import { requireStudentProfile } from "@/lib/student";
import { CourseBrowser } from "./course-browser";

export default async function CoursesPage() {
    const profile = await requireStudentProfile();
    const program = profile.catalogYear.program;
    const sections = await getCurriculumCourseSections();

    return <CourseBrowser program={program} sections={sections} />;
}
