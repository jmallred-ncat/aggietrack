"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { RuleViolationAlert } from "@/components/rule-violation-alert";
import { useState, useTransition } from "react";
import { approvePlannedTerm } from "./actions";

export default function PlanReview({ plannedTermId }: { plannedTermId: string }) {
    const [pin, setPin] = useState("");
    const [violations, setViolations] = useState<string[]>([]);
    const [pending, startTransition] = useTransition();

    return (
        <form
            className="mt-4 not-typeset"
            onSubmit={(event) => {
                event.preventDefault();
                startTransition(async () => {
                    const result = await approvePlannedTerm(plannedTermId, pin);
                    if (!result.success) {
                        if (result.violations && result.violations.length > 0) {
                            setViolations(result.violations);
                            return;
                        }
                        setViolations([]);
                        toast.add({ type: "error", title: result.error });
                        return;
                    }
                    setViolations([]);
                    toast.add({ title: "Term plan approved" });
                });
            }}
        >
            <RuleViolationAlert
                title="This plan cannot be approved"
                violations={violations}
                onDismiss={() => setViolations([])}
            />
            <div className="mt-4 flex flex-wrap items-center gap-2">
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
            </div>
        </form>
    );
}
