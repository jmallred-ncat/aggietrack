import { Button } from "@/components/ui/button";

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
    variant = "page",
}: {
    groups: SlotGroup[];
    selected?: string;
    onSelect: (id: string, event: React.MouseEvent<HTMLButtonElement>) => void;
    disabled?: boolean;
    stickyHeadings?: boolean;
    variant?: "page" | "dialog";
}) {
    const gridClass = variant === "dialog" 
        ? "grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-2"
        : "grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2";
    
    const stickyHeadingBg = variant === "dialog" ? "bg-[color-mix(in_oklab,hsl(var(--muted))_30%,hsl(var(--background)))]" : "bg-background";
    
    return (
        <div className="space-y-6">
            {groups.map((group) => (
                <div key={group.heading} className="space-y-2">
                    <h3
                        className={`text-base font-semibold text-foreground ${stickyHeadings ? `sticky -top-2 z-10 ${stickyHeadingBg} py-1` : ""}`}
                    >
                        <time dateTime={group.dateTime}>{group.heading}</time>
                    </h3>
                    <div className={gridClass}>
                        {group.slots.map((slot) => (
                            <Button
                                key={slot.id}
                                type="button"
                                variant={selected === slot.id ? "default" : "outline"}
                                disabled={disabled}
                                aria-label={slot.accessibleName}
                                aria-pressed={selected === slot.id}
                                onClick={(event) => onSelect(slot.id, event)}
                                className={`
                                    group min-h-16 w-full flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-3 text-center
                                    ${selected === slot.id
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border-border bg-background hover:border-primary hover:bg-muted"
                                    }
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
