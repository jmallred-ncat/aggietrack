"use client";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { XIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";

export function DismissibleAlert({
    title,
    children,
    action,
    onDismiss,
}: {
    title: string;
    children: ReactNode;
    action?: ReactNode;
    onDismiss: () => void;
}) {
    return (
        <Alert>
            <AlertTitle>{title}</AlertTitle>
            <AlertDescription>
                <div className="text-sm text-balance">{children}</div>
                {action ? <div className="mt-3">{action}</div> : null}
            </AlertDescription>
            <AlertAction>
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Dismiss message" onClick={onDismiss}>
                    <XIcon />
                </Button>
            </AlertAction>
        </Alert>
    );
}
