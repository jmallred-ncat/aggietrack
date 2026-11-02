"use client";

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Grade } from "@/lib/generated/prisma/browser";

const gradeOptions = [
    { value: Grade.A, label: "A" },
    { value: Grade.A_MINUS, label: "A-" },
    { value: Grade.B_PLUS, label: "B+" },
    { value: Grade.B, label: "B" },
    { value: Grade.B_MINUS, label: "B-" },
    { value: Grade.C_PLUS, label: "C+" },
    { value: Grade.C, label: "C" },
    { value: Grade.C_MINUS, label: "C-" },
    { value: Grade.D_PLUS, label: "D+" },
    { value: Grade.D, label: "D" },
    { value: Grade.F, label: "F" },
    { value: Grade.P, label: "P" },
    { value: Grade.TR, label: "TR" },
    { value: Grade.W, label: "W" },
    { value: Grade.I, label: "I" },
] as const;

export function GradeSelect({
    value,
    onChange,
    disabled,
    size = "sm",
}: {
    value: Grade | null;
    onChange: (grade: Grade) => void;
    disabled?: boolean;
    size?: "sm" | "default";
}) {
    return (
        <Select
            value={value ?? undefined}
            onValueChange={(newValue) => {
                if (newValue && Object.values(Grade).includes(newValue as Grade)) {
                    onChange(newValue as Grade);
                }
            }}
            disabled={disabled}
        >
            <SelectTrigger size={size} className="w-[4.5rem]">
                <SelectValue placeholder="Grade" />
            </SelectTrigger>
            <SelectContent>
                <SelectGroup>
                    {gradeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectGroup>
            </SelectContent>
        </Select>
    );
}
