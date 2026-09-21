import { formatProgramName } from "@/lib/program";
import { requireStudentProfile } from "@/lib/student";
import BannerIdForm from "./BannerIdForm";

export default async function ProfileSettingsPage() {
    const profile = await requireStudentProfile();
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
                <div>
                    <h3 className="mt-0">Banner ID</h3>
                </div>

                <div className="md:col-span-2">
                    <BannerIdForm bannerId={profile.bannerId ?? ""} />
                </div>
                <div>
                    <h3>Program</h3>
                </div>

                <div className="md:col-span-2">
                    <p>{formatProgramName(profile.catalogYear.program)}</p>
                </div>

                <div>
                    <h3>Catalog Year</h3>
                </div>

                <div className="md:col-span-2">
                    <p className="flex items-center gap-x-2">{profile.catalogYear.year}</p>
                    <span className="text-xs text-muted-foreground max-w-md text-balance leading-tight inline-block w-full">Progress is calculated against this catalog year and cannot be changed on this page.</span>
                </div>

            </section>
        </div>
    )
}