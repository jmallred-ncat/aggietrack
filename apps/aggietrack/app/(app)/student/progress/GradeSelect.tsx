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
                if (newValue && isCompletionGrade(newValue)) {
                    onChange(newValue);
                }
            }}
            disabled={disabled}
        >
            <SelectTrigger size={size} className="w-[4.5rem]">
                <SelectValue placeholder={placeholder}>
                    {value ? completionGradeLabel(value) : placeholder}
                </SelectValue>
            </SelectTrigger>
            <SelectContent>
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
