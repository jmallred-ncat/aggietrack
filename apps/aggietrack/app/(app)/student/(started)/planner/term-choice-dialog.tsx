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
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export { AlertDialog };

/** Row only when this dialog is at least 23rem wide (`@min-[23rem]`). The shared footer uses the viewport `sm` breakpoint, which is wider than the card. */
export const termChoiceContentClassName = [
    "@container not-typeset w-full max-w-[calc(100%-2rem)] gap-0 overflow-hidden p-0",
    "data-[size=default]:max-w-[calc(100%-2rem)] sm:max-w-md data-[size=default]:sm:max-w-md",
].join(" ");

export function TermChoicePanel({
    termLabel,
    nextLabel,
    pending,
    onDismiss,
    onPlanCurrent,
    onPlanNext,
}: {
    termLabel: string;
    nextLabel: string;
    pending: boolean;
    onDismiss: () => void;
    onPlanCurrent: () => void;
    onPlanNext: () => void;
}) {
    const next = nextLabel || "Next term";

    return (
        <>
            <AlertDialogHeader className="flex flex-col place-items-start items-start gap-2 grid-rows-none p-6 pb-4 text-left">
                <AlertDialogTitle className="text-lg font-semibold leading-tight">
                    Which term do you want to plan?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm text-muted-foreground">
                    You can switch terms anytime.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mx-0 mb-0 block rounded-b-xl border-t bg-muted/50 p-0 sm:flex-col">
                <div className="flex flex-col-reverse gap-2 px-6 py-4 @min-[23rem]:flex-row @min-[23rem]:justify-end">
                    <Button type="button" variant="ghost" className="h-auto min-h-8 w-full @min-[23rem]:w-auto" disabled={pending} onClick={onDismiss}>
                        Not now
                    </Button>
                    <Button type="button" variant="outline" className="h-auto min-h-8 w-full whitespace-normal @min-[23rem]:w-auto @min-[23rem]:max-w-full @min-[23rem]:min-w-0 @min-[23rem]:shrink" disabled={pending} onClick={onPlanNext}>
                        {next}
                    </Button>
                    <Button type="button" className="h-auto min-h-8 w-full @min-[23rem]:w-auto" disabled={pending} onClick={onPlanCurrent}>
                        {termLabel}
                    </Button>
                </div>
            </AlertDialogFooter>
        </>
    );
}

export function TermChoiceDialog({
    open,
    onDismiss,
    ...choice
}: {
    open: boolean;
    onDismiss: () => void;
} & Omit<Parameters<typeof TermChoicePanel>[0], "onDismiss">) {
    return (
        <AlertDialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onDismiss(); }}>
            <AlertDialogContent className={termChoiceContentClassName}>
                <TermChoicePanel {...choice} onDismiss={onDismiss} />
            </AlertDialogContent>
        </AlertDialog>
    );
}

export function TermChoicePending() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Opening your planner</CardTitle>
                <CardDescription>Saving your term choice…</CardDescription>
            </CardHeader>
        </Card>
    );
}
