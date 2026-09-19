import { getSessionUser, requireStudentProfile } from "@/lib/student";
import BannerIdForm from "./BannerIdForm";

export default async function ProfileSettingsPage() {
    const user = await getSessionUser();
    const profile = await
        requireStudentProfile(user.id);
    return (
        <div className="space-y-16">
            <section>
                <header className="container max-w-prose text-balance">
                    <h2>Profile</h2>
                    <p>
                        Manage your student profile information.
                    </p>
                </header>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-3 gap-x-8">
                {profile.bannerId && (
                    <>
                        <div>
                            <h3 className="mt-0">Banner ID</h3>
                        </div>

                        <div className="md:col-span-2">
                            <BannerIdForm user={user} bannerId={profile.bannerId} />
                        </div>
                    </>
                )}
                <div>
                    <h3>Program</h3>
                </div>

                <div className="md:col-span-2">
                    <p>{profile.catalogYear.program.name}</p>
                </div>

                <div>
                    <h3>Catalog Year</h3>
                </div>

                <div className="md:col-span-2">
                    <p className="flex items-center gap-x-2">{profile.catalogYear.label}</p>
                </div>

            </section>
        </div>
    )
}