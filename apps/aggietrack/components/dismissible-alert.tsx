"use client";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useState, type ReactNode } from "react";

export function DismissibleAlert({
    title,
    description,
    action,
    stacked = false,
}: {
    title: string;
    description: string;
    action?: ReactNode;
    stacked?: boolean;
}) {
    const [open, setOpen] = useState(true);
    if (!open) return null;
    const dismiss = (
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
            Dismiss message
        </Button>
    );

    if (stacked) {
        return (
            <Alert className="mt-4">
                <AlertTitle className="text-pretty">{title}</AlertTitle>
                <AlertDescription className="text-pretty">{description}</AlertDescription>
                <div className="mt-2 flex flex-wrap gap-2">
                    {action}
                    {dismiss}
                </div>
            </Alert>
        );
    }

    return (
        <Alert className="mt-4">
            <AlertTitle>{title}</AlertTitle>
            <AlertDescription>{description}</AlertDescription>
            <AlertAction>
                {action}
                {dismiss}
            </AlertAction>
        </Alert>
    );
}
