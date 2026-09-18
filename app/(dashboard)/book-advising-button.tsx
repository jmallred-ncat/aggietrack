"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function BookAdvisingButton() {
    return (
        <Button
            nativeButton={false}
            variant="outline"
            className="mb-6 w-full py-6 font-bold text-sm dark:border-transparent dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/80"
            render={<Link href="/dashboard/advising" />}
        >
            Book Advising
        </Button>
    );
}
