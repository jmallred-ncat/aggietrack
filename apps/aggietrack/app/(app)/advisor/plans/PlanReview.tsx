"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { useState, useTransition } from "react";
import { approvePlannedTerm } from "./actions";

export default function PlanReview({ plannedTermId }: { plannedTermId: string }) {
    const [pin, setPin] = useState("");
    const [pending, startTransition] = useTransition();

    return (
        <form
            className="mt-4 flex flex-wrap items-center gap-2 not-typeset"
            onSubmit={(event) => {
                event.preventDefault();
                startTransition(async () => {
                    const result = await approvePlannedTerm(plannedTermId, pin);
                    if (!result.success) {
                        toast.add({ title: result.error });
                        return;
                    }
                    toast.add({ title: "Term plan approved" });
                });
            }}
        >
            <label className="sr-only" htmlFor={`pin-${plannedTermId}`}>Registration pin</label>
            <Input
                id={`pin-${plannedTermId}`}
                value={pin}
                placeholder="Registration pin"
                className="w-48 font-mono"
                onChange={(event) => setPin(event.target.value)}
                disabled={pending}
                autoComplete="off"
            />
            <Button type="submit" disabled={pending || pin.trim().length === 0}>
                Approve and add pin
            </Button>
        </form>
    );
}
