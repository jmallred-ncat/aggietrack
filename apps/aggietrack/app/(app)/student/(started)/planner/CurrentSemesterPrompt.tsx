"use client";

import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { declineCurrentSemester, planCurrentSemester } from "./actions";

export default function CurrentSemesterPrompt({
    termId,
    termLabel,
    nextLabel,
}: {
    termId: string;
    termLabel: string;
    nextLabel: string;
}) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const next = nextLabel || "the next term";
    const several = nextLabel.includes(",");

    function choose(takingCourses: boolean) {
        setError(null);
        startTransition(async () => {
            const result = takingCourses
                ? await planCurrentSemester(termId)
                : await declineCurrentSemester(termId);
            if (!result.success) {
                setError(result.error);
                return;
            }
            router.refresh();
        });
    }

    return (
        <AlertDialog open onOpenChange={() => { }}>
            <AlertDialogContent className="max-w-md sm:max-w-md">
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you taking courses in {termLabel}?</AlertDialogTitle>
                    <AlertDialogDescription>
                        {termLabel} is the semester in session, and there is no plan for it yet. Plan {termLabel} if you are taking courses now. If you are not, the planner opens {next}.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                <AlertDialogFooter>
                    <Button variant="outline" disabled={pending} onClick={() => choose(false)}>
                        {several || !nextLabel ? "No, plan the next terms" : `No, plan ${nextLabel}`}
                    </Button>
                    <Button disabled={pending} onClick={() => choose(true)}>
                        Yes, plan {termLabel}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

export function PlanCurrentSemesterButton({
    termId,
    termLabel,
}: {
    termId: string;
    termLabel: string;
}) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();

    return (
        <Button
            variant="link"
            className="h-auto px-0"
            disabled={pending}
            onClick={() => {
                startTransition(async () => {
                    const result = await planCurrentSemester(termId);
                    if (result.success) {
                        router.refresh();
                    }
                });
            }}
        >
            Plan {termLabel} instead
        </Button>
    );
}
