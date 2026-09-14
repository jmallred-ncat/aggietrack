import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

function firstString(value: string | string[] | undefined) {
    return typeof value === "string" ? value : undefined;
}

export default async function ResetPasswordPage({
    searchParams,
}: {
    searchParams: Promise<{ token?: string | string[]; error?: string | string[] }>;
}) {
    const params = await searchParams;

    return (
        <ResetPasswordForm
            token={firstString(params.token)}
            error={firstString(params.error)}
        />
    );
}
