import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function LoginPage() {
    return (
        <div>
            <h1>Login</h1>

            <section>
                <header>
                    <span>This is a placeholder section to simulate a login form to direct you to the user dashboard</span>
                </header>

                <div>
                    <Button nativeButton={false} render={<Link href="/dashboard" className="not-typeset">Complete Login Form</Link>} />
                </div>
            </section>
        </div>
    );
}