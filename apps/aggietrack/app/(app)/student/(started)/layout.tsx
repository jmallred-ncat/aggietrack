import { getStudentProfile, hasConfirmedStart } from "@/lib/student";
import { redirect } from "next/navigation";

export default async function StartedStudentLayout({ children }: { children: React.ReactNode }) {
    const profile = await getStudentProfile();
    if (!hasConfirmedStart(profile)) {
        redirect("/student/progress");
    }

    return children;
}
