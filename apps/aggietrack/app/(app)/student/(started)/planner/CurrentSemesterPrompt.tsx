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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DismissibleAlert } from "@/components/dismissible-alert";
import { runAfterConfirmCloses } from "@/lib/completion-menu";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { declineCurrentSemester, planCurrentSemester } from "./actions";

function declineButtonLabel(nextLabel: string) {
    const several = !nextLabel || nextLabel.includes(",") || nextLabel.includes(" and ");
    return several ? "Plan the next terms" : "Plan the next term";
}

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
    const closingForSave = useRef(false);
    const [open, setOpen] = useState(true);
    const [phase, setPhase] = useState<"asking" | "saving" | "error" | "later">("asking");
    const [choice, setChoice] = useState<boolean | null>(null);
    const [pending, startTransition] = useTransition();
    const declineLabel = declineButtonLabel(nextLabel);

    function save(takingCourses: boolean) {
        startTransition(async () => {
            try {
                const result = takingCourses
                    ? await planCurrentSemester(termId)
                    : await declineCurrentSemester(termId);
                if (!result.success) {
                    setPhase("error");
                    return;
                }
                router.refresh();
            } catch {
                setPhase("error");
            }
        });
    }

    function begin(takingCourses: boolean) {
        setChoice(takingCourses);
        closingForSave.current = true;
        runAfterConfirmCloses(
            () => {
                setOpen(false);
                setPhase("saving");
            },
            () => save(takingCourses),
            (start) => {
                window.setTimeout(start, 0);
            },
        );
    }

    function closeWithoutSaving() {
        setOpen(false);
        if (closingForSave.current) {
            closingForSave.current = false;
            return;
        }
        setPhase("later");
    }

    return (
        <div className="flex flex-col gap-4">
            <AlertDialog open={open} onOpenChange={(next) => { if (!next) closeWithoutSaving(); }}>
                <AlertDialogContent className="max-w-md sm:max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you taking courses in {termLabel}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Choose the term you want to plan. You can change this later.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="sm:flex-wrap">
                        <Button type="button" variant="ghost" onClick={closeWithoutSaving}>
                            Not now
                        </Button>
                        <Button type="button" variant="outline" onClick={() => begin(false)}>
                            {declineLabel}
                        </Button>
                        <Button type="button" onClick={() => begin(true)}>
                            Plan {termLabel}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {phase === "saving" ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Opening your planner</CardTitle>
                        <CardDescription>Saving your term choice…</CardDescription>
                    </CardHeader>
                </Card>
            ) : null}

            {phase === "error" ? (
                <DismissibleAlert
                    title="Term choice not saved"
                    onDismiss={() => setPhase("later")}
                    action={
                        <Button type="button" size="sm" disabled={pending || choice === null} onClick={() => { if (choice !== null) begin(choice); }}>
                            Try again
                        </Button>
                    }
                >
                    Try again. Your plan has not changed.
                </DismissibleAlert>
            ) : null}

            {phase === "error" || phase === "later" ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Are you taking courses in {termLabel}?</CardTitle>
                        <CardDescription>Choose the term you want to plan. You can change this later.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                        <Button type="button" disabled={pending} onClick={() => begin(true)}>
                            Plan {termLabel}
                        </Button>
                        <Button type="button" variant="outline" disabled={pending} onClick={() => begin(false)}>
                            {declineLabel}
                        </Button>
                    </CardContent>
                </Card>
            ) : null}
        </div>
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
            aria-busy={pending}
            onClick={() => {
                startTransition(async () => {
                    try {
                        const result = await planCurrentSemester(termId);
                        if (!result.success) {
                            toast.error("Term choice not saved", { description: "Try again. Your plan has not changed." });
                            return;
                        }
                        router.refresh();
                    } catch {
                        toast.error("Term choice not saved", { description: "Try again. Your plan has not changed." });
                    }
                });
            }}
        >
            {pending ? "Saving…" : `Plan ${termLabel} instead`}
        </Button>
    );
}
