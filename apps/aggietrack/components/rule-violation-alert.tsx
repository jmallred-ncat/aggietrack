"use client";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function RuleViolationAlert({
    title,
    violations,
    onDismiss,
}: {
    title: string;
    violations: string[];
    onDismiss: () => void;
}) {
    if (violations.length === 0) return null;

    return (
        <Alert className="mt-4">
            <AlertTitle>{title}</AlertTitle>
            <AlertDescription>
                <ul className="mt-1 list-disc space-y-1 pl-4">
                    {violations.map((violation) => (
                        <li key={violation}>{violation}</li>
                    ))}
                </ul>
            </AlertDescription>
            <AlertAction>
                <Button type="button" variant="outline" size="sm" onClick={onDismiss}>
                    Dismiss
                </Button>
            </AlertAction>
        </Alert>
    );
}
