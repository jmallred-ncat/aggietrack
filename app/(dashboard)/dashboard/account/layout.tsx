import { getSessionUser } from "@/lib/student";
import AccountNavigation from "./AccountNavigation";
import { signOut } from "./sign-out";

export default async function ProfileLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const user = await getSessionUser();

    return (
        <div>
            <section className="border-b border-border pb-2">
                <header>
                    <h1>Hello, {user.firstName}!</h1>
                    <span className="text-sm text-muted-foreground leading-tight inline-block">You are currently signed in as <span className="font-bold">{user.email}.</span>
                        <br /> Not you? <form action={signOut} className="inline">
                            <button type="submit" className="underline font-medium cursor-pointer">
                                Sign out
                            </button>
                        </form>.
                    </span>
                </header>
                <AccountNavigation />
            </section>
            {children}
        </div>
    )
}