export function MeetingTime({
    dateLabel,
    timeLabel,
    iso,
    full,
    className = "text-sm",
}: {
    dateLabel: string;
    timeLabel: string;
    iso: string;
    full: string;
    className?: string;
}) {
    return (
        <time dateTime={iso} title={full} className={className}>
            <span className="whitespace-nowrap">{dateLabel}</span>
            {", "}
            <span className="whitespace-nowrap">{timeLabel}</span>
        </time>
    );
}

/** Keeps the clock and zone on one line. The date before the last comma may wrap. */
export function MeetingStamp({ value }: { value: string }) {
    if (!value) return null;
    const split = value.lastIndexOf(", ");
    if (split < 0) return <span className="whitespace-nowrap">{value}</span>;
    return (
        <>
            {value.slice(0, split)}
            {", "}
            <span className="whitespace-nowrap">{value.slice(split + 2)}</span>
        </>
    );
}
