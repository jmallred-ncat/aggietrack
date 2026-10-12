"use client";

import { authReactClient } from "@/lib/auth-client";
import { SignOutIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { Button } from "../ui/button";

export default function LogOutButton() {
    const router = useRouter();
    async function handleLogout() {
        await authReactClient.signOut({
            fetchOptions: {
                onSuccess: () => {
                    router.replace("/")
                }
            }
        });
    }

    return (
        <Button
            nativeButton={true}
            variant="destructive"
            className="w-full not-typeset bg-red-500 text-white dark:bg-red-700"
            onClick={handleLogout}
        >
            <SignOutIcon weight="duotone" />
            Log Out
        </Button>
    )
}