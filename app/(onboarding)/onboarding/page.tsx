import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { getSessionUser, getStudentProfile } from "@/lib/student";
import Link from "next/link";
import { redirect } from "next/navigation";
import { StudentProfileForm } from "./StudentProfileForm";


export default async function OnboardingPage() {
    const user = await getSessionUser();

    if (user.role !== "STUDENT") {
        return redirect("/dashboard");
    }

    const profile = await getStudentProfile(user.id);

    if (profile) return redirect("/dashboard");

    const hasPrograms = await prisma.program.count() > 0;

    if (!hasPrograms) return (
        <div className="flex flex-col flex-1 items-center justify-center px-4 md:px-6 lg:px-8">
            <h2>Nothing to see here...</h2>
            <p className="max-w-prose text-balance text-center leading-tight text-muted-foreground">Programs have not been added to the system yet. We are actively working on it and will be ready soon.</p>
            <p className="max-w-prose text-balance text-sm text-center leading-tight text-muted-foreground">You will not be able to continue until programs are added.</p>
            <Button nativeButton={false} className="mt-4" render={(<Link href="/" className="not-typeset">Take me Home</Link>)} />
        </div>
    );

    return (
        <div className="px-4 md:px-6 lg:px-8 flex-1 flex flex-col space-y-16 py-8 md:pt-0">
            <header className="container not-typeset mx-auto max-w-screen-lg">
                <h1 className="text-3xl md:text-4xl font-bold leading-tight text-balance md:pt-12">Your Degree, Perfectly Planned</h1>
                <p className="text-lg text-muted-foreground text-balance mt-2">
                    Let's set up your student profile to start planning your degree.
                </p>
            </header>
            <section className="flex-1 flex flex-col">
                <StudentProfileForm user={user} />
            </section>
        </div>
    );
}