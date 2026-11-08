import type { AdvisorAppointmentsView, MeetingCard, OpenSlotChoice, StudentAdvisingView } from "./advising-types";

const confirmed: MeetingCard = {
    id: "session-confirmed",
    personName: "Sarah Martinez",
    statusLabel: "Confirmed",
    statusTone: "default",
    dateLabel: "Tuesday, November 10, 2026",
    timeLabel: "2:00–2:30 PM EST",
    fullTimestamp: "Tuesday, November 10, 2026, 2:00–2:30 PM EST",
    iso: "2026-11-10T19:00:00.000Z",
    durationMinutes: 30,
    durationLabel: "30 minutes",
    zoomUrl: null,
    canChange: true,
    started: false,
    notices: [
        {
            id: "booked",
            name: "Avery Cole",
            roleLabel: "Student",
            phrase: "Avery Cole booked this session.",
            support: null,
            body: "I want to talk about my spring plan.",
            timeLabel: "9:00 AM EST",
            iso: "2026-11-08T14:00:00.000Z",
        },
    ],
};

const slot = (id: string, label: string, minutes: number, accessible: string): OpenSlotChoice => ({
    id,
    dateHeading: "Tuesday, November 10, 2026",
    slotLabel: label,
    accessibleName: accessible,
    fullTimestamp: `Tuesday, November 10, 2026, ${label} EST`,
    durationMinutes: minutes,
    durationLabel: `${minutes} minutes`,
    iso: "2026-11-10T19:00:00.000Z",
});

export const studentOpen: StudentAdvisingView = {
    advisorName: "Sarah Martinez",
    sessionMinutes: 30,
    slots: [
        slot("slot-30", "2:00–2:30 PM", 30, "Tuesday, November 10, 2:00 to 2:30 PM Eastern Time"),
        slot("slot-20", "3:00–3:20 PM", 20, "Tuesday, November 10, 3:00 to 3:20 PM Eastern Time"),
    ],
    upcoming: [],
    canceled: [],
    earlier: [],
};

export const studentBooked: StudentAdvisingView = {
    ...studentOpen,
    slots: [],
    upcoming: [confirmed],
};

export const studentUnassigned: StudentAdvisingView = {
    advisorName: null,
    sessionMinutes: null,
    slots: [],
    upcoming: [],
    canceled: [],
    earlier: [],
};

export const studentCanceled: StudentAdvisingView = {
    advisorName: "Sarah Martinez",
    sessionMinutes: 30,
    slots: studentOpen.slots,
    upcoming: [],
    canceled: [{
        ...confirmed,
        id: "session-canceled",
        statusLabel: "Canceled",
        statusTone: "outline",
        canChange: false,
        notices: [
            ...confirmed.notices,
            {
                id: "canceled",
                name: "Sarah Martinez",
                roleLabel: "Advisor",
                phrase: "Sarah Martinez canceled this session.",
                support: null,
                body: "I have a faculty meeting at that time. Please book another open time.",
                timeLabel: "10:15 AM EST",
                iso: "2026-11-08T15:15:00.000Z",
            },
        ],
    }],
    earlier: [],
};

export const studentRescheduled: StudentAdvisingView = {
    ...studentBooked,
    upcoming: [{
        ...confirmed,
        timeLabel: "3:00–3:20 PM EST",
        fullTimestamp: "Tuesday, November 10, 2026, 3:00–3:20 PM EST",
        iso: "2026-11-10T20:00:00.000Z",
        durationMinutes: 20,
        durationLabel: "20 minutes",
        notices: [
            ...confirmed.notices,
            {
                id: "moved",
                name: "Sarah Martinez",
                roleLabel: "Advisor",
                phrase: "Sarah Martinez rescheduled this session.",
                support: "From Tuesday, November 10, 2026, 2:00–2:30 PM EST to Tuesday, November 10, 2026, 3:00–3:20 PM EST.",
                body: "A faculty meeting now overlaps the original time. Please use this new time.",
                timeLabel: "10:40 AM EST",
                iso: "2026-11-08T15:40:00.000Z",
            },
        ],
    }],
};

export const studentZoom: StudentAdvisingView = {
    ...studentBooked,
    upcoming: [{
        ...confirmed,
        zoomUrl: "https://ncat.zoom.us/j/123456789012345?pwd=abcdefghijklmnopqrstuvwxyz",
        notices: [
            ...confirmed.notices,
            {
                id: "zoom",
                name: "Sarah Martinez",
                roleLabel: "Advisor",
                phrase: "Sarah Martinez added a Zoom link.",
                support: null,
                body: null,
                timeLabel: "11:00 AM EST",
                iso: "2026-11-08T16:00:00.000Z",
            },
        ],
    }],
};

export const studentLong: StudentAdvisingView = {
    advisorName: "Alexandria Montgomery-Worthington",
    sessionMinutes: 45,
    slots: [],
    upcoming: [{
        ...confirmed,
        personName: "Alexandria Montgomery-Worthington",
        durationMinutes: 45,
        durationLabel: "45 minutes",
        timeLabel: "2:00–2:45 PM EST",
        fullTimestamp: "Tuesday, November 10, 2026, 2:00–2:45 PM EST",
        zoomUrl: "https://ncat.zoom.us/j/123456789012345?pwd=a-very-long-meeting-password-that-must-wrap-inside-the-card-without-widening-the-page",
    }],
    canceled: [],
    earlier: [],
};

export const advisorAvailability: AdvisorAppointmentsView = {
    durationMinutes: 30,
    rows: [
        {
            id: "open-30",
            dateLabel: "Tuesday, November 10, 2026",
            timeLabel: "2:00–2:30 PM EST",
            fullTimestamp: "Tuesday, November 10, 2026, 2:00–2:30 PM EST",
            durationLabel: "30 minutes",
            durationMinutes: 30,
            dateValue: "2026-11-10",
            startValue: "14:00",
            statusLabel: "Open",
            statusTone: "outline",
            studentName: null,
            sessionId: null,
            canChange: true,
        },
        {
            id: "booked-20",
            dateLabel: "Tuesday, November 10, 2026",
            timeLabel: "3:00–3:20 PM EST",
            fullTimestamp: "Tuesday, November 10, 2026, 3:00–3:20 PM EST",
            durationLabel: "20 minutes",
            durationMinutes: 20,
            dateValue: "2026-11-10",
            startValue: "15:00",
            statusLabel: "Booked",
            statusTone: "default",
            studentName: "Avery Cole",
            sessionId: "session-confirmed",
            canChange: false,
        },
    ],
    upcoming: [{
        ...confirmed,
        personName: "Avery Cole",
    }],
    canceled: [],
    earlier: [],
};

export const advisorEmpty: AdvisorAppointmentsView = {
    durationMinutes: 30,
    rows: [],
    upcoming: [],
    canceled: [],
    earlier: [],
};
