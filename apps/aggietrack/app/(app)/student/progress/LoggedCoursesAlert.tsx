"use client";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useState } from "react";

export function LoggedCoursesAlert() {
    const [open, setOpen] = useState(true);
    if (!open) {
        return null;
    }

    return (
        <Alert className="mt-4">
            <AlertTitle>Add completed courses</AlertTitle>
            <AlertDescription>
                <p>Earned credits stay at 0 until you log a course as complete. A course that is still in progress does not count.</p>
                <p className="mt-2">
                    <Link href="/student/courses" className="font-medium text-foreground underline underline-offset-3">Courses</Link>
                </p>
            </AlertDescription>
            <AlertAction>
                <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                    Dismiss
                </Button>
            </AlertAction>
        </Alert>
    );
}
