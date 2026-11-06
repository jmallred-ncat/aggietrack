"use client";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useState, type ReactNode } from "react";

export function DismissibleAlert({
    title,
    description,
    action,
}: {
    title: string;
    description: string;
    action?: ReactNode;
}) {
    const [open, setOpen] = useState(true);
    if (!open) return null;

    return (
        <Alert className="mt-4">
            <AlertTitle>{title}</AlertTitle>
            <AlertDescription>{description}</AlertDescription>
            <AlertAction>
                {action}
                <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                    Dismiss message
                </Button>
            </AlertAction>
        </Alert>
    );
}
