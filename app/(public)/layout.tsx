import LoginDialog from "@/components/auth/LoginDialog";
import RegisterDialog from "@/components/auth/RegisterDialog";
import { ButtonGroup } from "@/components/ui/button-group";
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
                <ButtonGroup>
                    <LoginDialog />
                    <RegisterDialog />
                </ButtonGroup>
            </nav>
        </header>
        <main className="flex flex-1 w-full max-w-7xl mx-auto flex-col px-4 py-2 pb-16">
            {children}
        </main>
        <footer className="border-t py-4 not-typeset">
            <div className="flex flex-col md:flex-row md:items-center justify-center md:gap-4 container mx-auto w-full text-sm px-4">
                <Link href="#">Privacy Policy</Link>
                <Link href="#">Terms of Service</Link>
                <Link href="#">Contact</Link>
            </div>
            <p className="text-center text-sm text-muted-foreground mt-4">© {new Date().getFullYear()} AggieTrack. All rights reserved.</p>
        </footer>
    </div>;
}