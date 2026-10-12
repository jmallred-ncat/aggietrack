import { homePathForRole } from "@/lib/roles";
import { getSessionUser } from "@/lib/student";
import { redirect } from "next/navigation";

export default async function AdvisorSectionLayout({ children }: { children: React.ReactNode }) {
    const user = await getSessionUser();

    if (user.role !== "ADVISOR") {
        redirect(homePathForRole(user.role));
    }

    return children;
}
