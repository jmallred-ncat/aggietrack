import type { ScheduleConfig, ScheduleReview } from "./advising-schedule";

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
    pendingLabel?: string | null;
    sourceLabel?: string;
    inventory?: "this" | "manual" | "other";
};

export type StudentAdvisingView = {
    advisorName: string | null;
    sessionMinutes: number | null;
    slots: OpenSlotChoice[];
    upcoming: MeetingCard[];
    canceled: MeetingCard[];
    earlier: MeetingCard[];
};

export type AdvisorTermChoice = {
    id: string;
    label: string;
    startsOn: string | null;
    endsOn: string | null;
    runLabel: string | null;
};

export type AdvisorAvailabilityModel = {
    terms: AdvisorTermChoice[];
    selectedTermId: string | null;
    status: "draft" | "published" | "changes" | null;
    statusLabel: string | null;
    statusHelper: string | null;
    config: ScheduleConfig;
    publishedDuration: number | null;
    datesUnavailable: boolean;
    runLabel: string | null;
    revision: string;
    openTimes: AvailabilityRow[];
};

export type AdvisorAppointmentsView = {
    durationMinutes: number;
    rows: AvailabilityRow[];
    upcoming: MeetingCard[];
    canceled: MeetingCard[];
    earlier: MeetingCard[];
    availability: AdvisorAvailabilityModel;
};

export type MeetingFailure = {
    ok: false;
    code: string;
    title: string;
    description: string;
    sessionId?: string;
    review?: ScheduleReview;
    field?: string;
};

export type MeetingResult = { ok: true; sessionId?: string; studentName?: string } | MeetingFailure;

export type UpcomingAdvising = {
    id: string;
    personName: string;
    dateLabel: string;
    timeLabel: string;
    iso: string;
    durationLabel: string;
};
