import { homePathForRole } from "@/lib/roles";
import { getSessionUser } from "@/lib/student";
import { redirect } from "next/navigation";

export default async function AdminSectionLayout({ children }: { children: React.ReactNode }) {
    const user = await getSessionUser();

    if (user.role !== "ADMIN") {
        redirect(homePathForRole(user.role));
    }

    return children;
}
