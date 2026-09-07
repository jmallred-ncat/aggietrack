import Link from "next/link";

const navigation = [
    { href: "/about", label: "About" },
    { href: "/features", label: "Features" },
]

export default function PublicLayout({ children }: { children: React.ReactNode }) {
    return <div className="h-full xl:pt-6 flex flex-col flex-1 w-full">
        <header className="flex items-center justify-between px-4 py-2 max-w-7xl mx-auto w-full not-typeset">
            <Link href="/">
                <h1 className="text-2xl font-bold">AggieTrack</h1>
            </Link>
            <nav className="flex items-center gap-4">
                <ul className="flex items-center gap-4">
                    {navigation.map((item) => (
                        <li key={item.href}>
                            <Link href={item.href}>{item.label}</Link>
                        </li>
                    ))}
                </ul>
                <ul className="flex items-center gap-4">
                    <li>
                        <Link href="/login">Login</Link>
                    </li>
                    <li>
                        <Link href="/register">Register</Link>
                    </li>
                </ul>
            </nav>
        </header>
        <main className="flex flex-1 w-full max-w-7xl mx-auto flex-col px-4 py-2">
            {children}
        </main>
    </div>;
}