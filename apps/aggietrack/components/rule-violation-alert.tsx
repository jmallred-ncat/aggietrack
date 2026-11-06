"use client";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function RuleViolationAlert({
    title,
    violations,
    onDismiss,
}: {
    title: string;
    violations: string[];
    onDismiss?: () => void;
}) {
    const key = violations.join("\n");
    const [hiddenKey, setHiddenKey] = useState<string | null>(null);
    if (violations.length === 0 || hiddenKey === key) return null;

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
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        setHiddenKey(key);
                        onDismiss?.();
                    }}
                >
                    Dismiss message
                </Button>
            </AlertAction>
        </Alert>
    );
}
