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

/** Date and time+zone each stay on one line. A narrow width may wrap only between those two. */
export function MeetingStamp({ value }: { value: string }) {
    if (!value) return null;
    const split = value.lastIndexOf(", ");
    if (split < 0) return <span className="whitespace-nowrap">{value}</span>;
    return (
        <>
            <span className="whitespace-nowrap">{value.slice(0, split)}</span>
            {", "}
            <span className="whitespace-nowrap">{value.slice(split + 2)}</span>
        </>
    );
}
