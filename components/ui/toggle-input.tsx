"use client"

import * as React from "react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

function ToggleInputGroup({
    value,
    defaultValue,
    onValueChange,
    ...props
}: Omit<React.ComponentProps<typeof ToggleGroup>, "value" | "defaultValue" | "onValueChange"> & {
    /** The selected option. Empty when nothing is chosen. */
    value?: string
    defaultValue?: string
    onValueChange?: (value: string) => void
}) {
    return (
        <ToggleGroup
            {...(value !== undefined
                ? { value: value ? [value] : [] }
                : { defaultValue: defaultValue ? [defaultValue] : [] })}
            onValueChange={(groupValue) => {
                if (groupValue.length === 0) {
                    onValueChange?.("")
                    return
                }
                const next = groupValue.find((item) => item !== value) ?? groupValue[0]
                onValueChange?.(next ?? "")
            }}
            {...props}
        />
    )
}

function ToggleInput(props: React.ComponentProps<typeof ToggleGroupItem>) {
    return <ToggleGroupItem {...props} />
}

export { ToggleInput, ToggleInputGroup }
