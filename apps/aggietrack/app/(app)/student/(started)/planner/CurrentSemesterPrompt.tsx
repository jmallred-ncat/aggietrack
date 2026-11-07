"use client";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { runAfterConfirmCloses } from "@/lib/completion-menu";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { declineCurrentSemester, planCurrentSemester } from "./actions";
import { TermChoiceDialog, TermChoicePending } from "./term-choice-dialog";

const termChoiceToast = "term-choice";

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
    const next = nextLabel || "Next term";

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
            <TermChoiceDialog
                open={open}
                termLabel={termLabel}
                nextLabel={nextLabel}
                pending={pending}
                onDismiss={() => setOpen(false)}
                onPlanCurrent={() => choose(true)}
                onPlanNext={() => choose(false)}
            />

            {saving ? (
                <TermChoicePending />
            ) : open ? null : (
                <Card>
                    <CardHeader>
                        <CardTitle>Which term do you want to plan?</CardTitle>
                        <CardDescription>You can switch terms anytime.</CardDescription>
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
                                {next}
                            </Button>
                            <Button disabled={pending} onClick={() => choose(true)}>
                                {termLabel}
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
