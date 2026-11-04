"use client";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function SignedOutAlert({ message }: { message: string }) {
    const [visible, setVisible] = useState(true);
    if (!visible) return null;

    return (
        <Alert className="mb-4">
            <AlertTitle>You were signed out</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
            <AlertAction>
                <Button type="button" variant="outline" size="sm" onClick={() => setVisible(false)}>
                    Dismiss
                </Button>
            </AlertAction>
        </Alert>
    );
}
