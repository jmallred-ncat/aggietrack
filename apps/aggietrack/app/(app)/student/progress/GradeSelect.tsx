"use client";

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Grade } from "@/lib/generated/prisma/browser";
import { gradeLabel } from "@/lib/enum-labels";

const gradeOptions = [
    Grade.A,
    Grade.A_MINUS,
    Grade.B_PLUS,
    Grade.B,
    Grade.B_MINUS,
    Grade.C_PLUS,
    Grade.C,
    Grade.C_MINUS,
    Grade.D_PLUS,
    Grade.D,
    Grade.F,
    Grade.P,
    Grade.TR,
    Grade.W,
    Grade.I,
] as const;

export function GradeSelect({
    value,
    onChange,
    disabled,
    size = "sm",
    placeholder = "Grade",
}: {
    value: Grade | null;
    onChange: (grade: Grade) => void;
    disabled?: boolean;
    size?: "sm" | "default";
    placeholder?: string;
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
                <SelectValue placeholder={placeholder}>
                    {value ? gradeLabel(value) : placeholder}
                </SelectValue>
            </SelectTrigger>
            <SelectContent>
                <SelectGroup>
                    {gradeOptions.map((grade) => (
                        <SelectItem key={grade} value={grade}>
                            {gradeLabel(grade)}
                        </SelectItem>
                    ))}
                </SelectGroup>
            </SelectContent>
        </Select>
    );
}
