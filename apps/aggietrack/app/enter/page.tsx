import { homePathForRole } from "@/lib/roles";
import { getSessionUser, getStudentProfile } from "@/lib/student";
import { redirect } from "next/navigation";

export default async function EnterPage() {
    const user = await getSessionUser();

    if (user.role === "STUDENT") {
        const profile = await getStudentProfile();
        if (!profile) {
            redirect("/onboarding");
        }
    }

    redirect(homePathForRole(user.role));
}
