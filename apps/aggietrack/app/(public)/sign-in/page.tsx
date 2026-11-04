import LoginForm from "@/components/auth/LoginForm";
import SignedOutAlert from "@/components/auth/SignedOutAlert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signedOutReasonMessage } from "@/lib/idle-timeout";

function firstString(value: string | string[] | undefined) {
    return typeof value === "string" ? value : undefined;
}

export default async function SignInPage({
    searchParams,
}: {
    searchParams: Promise<{ reason?: string | string[] }>;
}) {
    const params = await searchParams;
    const message = signedOutReasonMessage(firstString(params.reason));

    return (
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
            {message ? <SignedOutAlert message={message} /> : null}
            <Card>
                <CardHeader>
                    <CardTitle>Sign in</CardTitle>
                    <CardDescription>Use your email and password to continue.</CardDescription>
                </CardHeader>
                <CardContent>
                    <LoginForm submitLabel="Sign in" />
                </CardContent>
            </Card>
        </div>
    );
}
