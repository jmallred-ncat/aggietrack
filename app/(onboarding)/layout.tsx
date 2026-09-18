import { getSessionUser } from "@/lib/student";
import { redirect } from "next/navigation";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
    const user = await getSessionUser();
    if (!user) {
        redirect("/");
    }
    return (
        <div className="bg-sidebar min-h-screen p-4 flex flex-col">
            <main className="bg-background rounded-lg shadow flex-1 flex flex-col">
                {children}
            </main>
        </div >
    );
}