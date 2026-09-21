import { getStudentProfile } from "@/lib/student";

export default async function ProfilePage() {
    const profile = await getStudentProfile();
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