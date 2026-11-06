"use client";

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { completionGradeChoices, completionGradeLabel, isCompletionGrade } from "@/lib/completion-menu";
import { Grade } from "@/lib/generated/prisma/browser";
import { cn } from "@/lib/utils";

const gradeOptions = completionGradeChoices();

export function GradeSelect({
    id,
    value,
    onChange,
    disabled,
    size = "sm",
    placeholder = "Grade",
    courseCode,
    attempt,
    className,
}: {
    id?: string;
    value: Grade | null;
    onChange: (grade: Grade) => void;
    disabled?: boolean;
    size?: "sm" | "default";
    placeholder?: string;
    courseCode?: string;
    attempt?: number;
    className?: string;
}) {
    const accessibleName = courseCode
        ? attempt
            ? `Grade for ${courseCode}, attempt ${attempt}`
            : `Grade for ${courseCode}`
        : undefined;

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
            <SelectTrigger id={id} size={size} aria-label={accessibleName} className={cn("w-[4.5rem]", className)}>
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
