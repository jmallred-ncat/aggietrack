"use client";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { runAfterConfirmCloses } from "@/lib/completion-menu";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { declineCurrentSemester, planCurrentSemester } from "./actions";

const termChoiceToast = "term-choice";

function declineLabel(nextLabel: string, several: boolean) {
    if (several || !nextLabel) return "Plan the next terms";
    return "Plan the next term";
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
    const [pending, startTransition] = useTransition();
    const [open, setOpen] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastChoice, setLastChoice] = useState<boolean | null>(null);
    const next = nextLabel || "the next term";
    const several = nextLabel.includes(",");
    const accept = `Plan ${termLabel}`;
    const decline = declineLabel(nextLabel, several);

    function choose(takingCourses: boolean) {
        setError(null);
        setLastChoice(takingCourses);
        runAfterConfirmCloses(
            () => {
                setOpen(false);
                setSaving(true);
                toast.loading("Saving your term choice…", { id: termChoiceToast });
            },
            () => {
                startTransition(async () => {
                    let result: { success: boolean; error?: string };
                    try {
                        result = takingCourses
                            ? await planCurrentSemester(termId)
                            : await declineCurrentSemester(termId);
                    } catch {
                        setSaving(false);
                        setError("Try again. Your plan has not changed.");
                        toast.error("Term choice not saved", {
                            id: termChoiceToast,
                            description: "Try again. Your plan has not changed.",
                        });
                        return;
                    }
                    if (!result.success) {
                        setSaving(false);
                        setError("Try again. Your plan has not changed.");
                        toast.error("Term choice not saved", {
                            id: termChoiceToast,
                            description: "Try again. Your plan has not changed.",
                        });
                        return;
                    }
                    toast.success("Opening your planner", { id: termChoiceToast });
                    router.refresh();
                });
            },
            (save) => {
                window.setTimeout(save, 0);
            },
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <AlertDialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) setOpen(false); }}>
                <AlertDialogContent className="max-w-md sm:max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you taking courses in {termLabel}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Choose the term you want to plan. You can change this later.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <Button variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
                            Not now
                        </Button>
                        <Button variant="outline" disabled={pending} onClick={() => choose(false)}>
                            {decline}
                        </Button>
                        <Button disabled={pending} onClick={() => choose(true)}>
                            {accept}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {saving ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Opening your planner</CardTitle>
                        <CardDescription>Saving your term choice…</CardDescription>
                    </CardHeader>
                </Card>
            ) : open ? null : (
                <Card>
                    <CardHeader>
                        <CardTitle>Are you taking courses in {termLabel}?</CardTitle>
                        <CardDescription>
                            {termLabel} is the semester in session, and there is no plan for it yet. Plan {termLabel} if you are taking courses now. If you are not, the planner opens {next}.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        {error ? (
                            <Alert variant="destructive">
                                <AlertTitle>Term choice not saved</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="mt-2"
                                    onClick={() => { if (lastChoice !== null) choose(lastChoice); }}
                                >
                                    Try again
                                </Button>
                                <AlertAction>
                                    <Button type="button" size="sm" variant="ghost" aria-label="Dismiss message" onClick={() => setError(null)}>
                                        Dismiss message
                                    </Button>
                                </AlertAction>
                            </Alert>
                        ) : null}
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Button variant="outline" disabled={pending} onClick={() => choose(false)}>
                                {decline}
                            </Button>
                            <Button disabled={pending} onClick={() => choose(true)}>
                                {accept}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
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
            onClick={() => {
                toast.loading("Saving your term choice…", { id: termChoiceToast });
                startTransition(async () => {
                    try {
                        const result = await planCurrentSemester(termId);
                        if (!result.success) {
                            toast.error("Term choice not saved", {
                                id: termChoiceToast,
                                description: "Try again. Your plan has not changed.",
                            });
                            return;
                        }
                        toast.success("Opening your planner", { id: termChoiceToast });
                        router.refresh();
                    } catch {
                        toast.error("Term choice not saved", {
                            id: termChoiceToast,
                            description: "Try again. Your plan has not changed.",
                        });
                    }
                });
            }}
        >
            Plan {termLabel} instead
        </Button>
    );
}
