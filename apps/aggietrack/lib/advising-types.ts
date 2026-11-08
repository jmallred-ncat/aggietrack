export type MeetingInstant = {
    dateLabel: string;
    timeLabel: string;
    iso: string;
    full: string;
};

export type MeetingNotice = {
    id: string;
    name: string;
    roleLabel: string;
    phrase: string;
    support: string | null;
    body: string | null;
    dateLabel: string;
    timeLabel: string;
    iso: string;
    from?: MeetingInstant | null;
    to?: MeetingInstant | null;
};

export type MeetingCard = {
    id: string;
    personName: string;
    statusLabel: "Confirmed" | "Canceled" | "Past" | "Status unavailable";
    statusTone: "default" | "outline";
    dateLabel: string;
    timeLabel: string;
    fullTimestamp: string;
    iso: string;
    durationMinutes: number;
    durationLabel: string;
    zoomUrl: string | null;
    canChange: boolean;
    started: boolean;
    notices: MeetingNotice[];
};

export type OpenSlotChoice = {
    id: string;
    dateHeading: string;
    slotLabel: string;
    accessibleName: string;
    fullTimestamp: string;
    durationMinutes: number;
    durationLabel: string;
    iso: string;
};

export type AvailabilityRow = {
    id: string;
    dateLabel: string;
    timeLabel: string;
    fullTimestamp: string;
    durationLabel: string;
    durationMinutes: number;
    dateValue: string;
    startValue: string;
    statusLabel: "Open" | "Booked" | "Status unavailable";
    statusTone: "default" | "outline";
    studentName: string | null;
    sessionId: string | null;
    canChange: boolean;
};

export type StudentAdvisingView = {
    advisorName: string | null;
    sessionMinutes: number | null;
    slots: OpenSlotChoice[];
    upcoming: MeetingCard[];
    canceled: MeetingCard[];
    earlier: MeetingCard[];
};

export type AdvisorAppointmentsView = {
    durationMinutes: number;
    rows: AvailabilityRow[];
    upcoming: MeetingCard[];
    canceled: MeetingCard[];
    earlier: MeetingCard[];
};

export type MeetingFailure = {
    ok: false;
    code: string;
    title: string;
    description: string;
    sessionId?: string;
};

export type MeetingResult = { ok: true; sessionId?: string } | MeetingFailure;

export type UpcomingAdvising = {
    id: string;
    personName: string;
    dateLabel: string;
    timeLabel: string;
    iso: string;
    durationLabel: string;
};
