import { getSessionUser, getStudentProfile } from "@/lib/student";

export default async function ProfilePage() {
    const user = await getSessionUser();
    const profile = await getStudentProfile(user.id);
    return (
        <div>
            <section>
                <header className="container max-w-prose text-balance">
                    <h1>Account</h1>
                </header>
            </section>
        </div>
    )
}