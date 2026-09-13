import { auth } from "@/lib/auth";
import type { User } from "@/lib/generated/prisma/client";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function Dashboard() {
    const session = await auth.api.getSession({
        headers: await headers()
    })

    if (!session) {
        return redirect("/");
    }

    const user = session.user as User;

    return <div className="flex flex-col gap-16">
        <section>
            <h1 className="text-5xl font-bold">Welcome, {user.name}!</h1>

        </section>
        <section>
            User Dashboard goes here
        </section>
    </div>;
}