import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

export type SlotChoice = {
    id: string;
    dateHeading: string;
    startTime: string;
    durationLabel: string;
    accessibleName: string;
};

export type SlotGroup = {
    heading: string;
    dateTime: string;
    slots: SlotChoice[];
};

export function SlotPicker({
    groups,
    selected,
    onSelect,
    disabled = false,
    stickyHeadings = false,
}: {
    groups: SlotGroup[];
    selected?: string;
    onSelect: (id: string) => void;
    disabled?: boolean;
    stickyHeadings?: boolean;
}) {
    return (
        <div className="space-y-6">
            {groups.map((group) => (
                <div key={group.heading} className="space-y-2">
                    <h3
                        className={`text-base font-semibold text-foreground ${stickyHeadings ? "sticky top-0 z-10 bg-background py-1" : ""}`}
                    >
                        <time dateTime={group.dateTime}>{group.heading}</time>
                    </h3>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2">
                        {group.slots.map((slot) => (
                            <Button
                                key={slot.id}
                                type="button"
                                variant={selected === slot.id ? "default" : "outline"}
                                disabled={disabled}
                                aria-label={slot.accessibleName}
                                onClick={() => onSelect(slot.id)}
                                className={`
                                    group min-h-16 w-full flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-3 text-center
                                    ${selected === slot.id
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border-border bg-background hover:border-primary hover:bg-muted"
                                    }
                                    ${disabled ? "opacity-50 pointer-events-none" : ""}
                                    focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50
                                `}
                            >
                                <span className="whitespace-nowrap text-lg font-semibold leading-tight tabular-nums" aria-hidden="true">
                                    {slot.startTime}
                                </span>
                                <span
                                    className={`text-sm ${selected === slot.id ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"}`}
                                    aria-hidden="true"
                                >
                                    {slot.durationLabel}
                                </span>
                            </Button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
