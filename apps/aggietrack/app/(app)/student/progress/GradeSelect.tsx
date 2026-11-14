"use client";

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { completionGradeChoices, completionGradeLabel, isCompletionGrade } from "@/lib/completion-menu";
import { Grade } from "@/lib/generated/prisma/browser";

const gradeOptions = completionGradeChoices();

export function GradeSelect({
    value,
    onChange,
    disabled,
    size = "sm",
    placeholder = "Grade",
    label,
    className,
}: {
    value: Grade | null;
    onChange: (grade: Grade) => void;
    disabled?: boolean;
    size?: "sm" | "default";
    placeholder?: string;
    /** Accessible name, such as "Grade for CST 130". */
    label?: string;
    className?: string;
}) {
    return (
        <Select
            value={value ?? undefined}
            onValueChange={(newValue) => {
                if (newValue && isCompletionGrade(newValue)) {
                    onChange(newValue);
                }
            }}
            disabled={disabled}
        >
            <SelectTrigger size={size} aria-label={label} className={className}>
                <SelectValue placeholder={placeholder}>
                    {value ? completionGradeLabel(value) : placeholder}
                </SelectValue>
            </SelectTrigger>
            <SelectContent className="min-w-48">
                <SelectGroup>
                    {gradeOptions.map((grade) => (
                        <SelectItem key={grade.value} value={grade.value}>
                            {grade.label}
                        </SelectItem>
                    ))}
                </SelectGroup>
            </SelectContent>
        </Select>
    );
}
