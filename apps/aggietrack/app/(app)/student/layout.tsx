import { homePathForRole } from "@/lib/roles";
import { getSessionUser, getStudentProfile } from "@/lib/student";
import { redirect } from "next/navigation";

export default async function StudentSectionLayout({ children }: { children: React.ReactNode }) {
    const user = await getSessionUser();

    if (user.role !== "STUDENT") {
        redirect(homePathForRole(user.role));
    }

    const profile = await getStudentProfile();
    if (!profile) {
        redirect("/onboarding");
    }

    return children;
}
