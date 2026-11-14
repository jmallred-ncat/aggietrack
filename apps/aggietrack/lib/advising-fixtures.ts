import { emptySchedule } from "./advising-schedule";
import type { AdvisorAppointmentsView, AdvisorAvailabilityModel, MeetingCard, OpenSlotChoice, StudentAdvisingView } from "./advising-types";

const blankAvailability: AdvisorAvailabilityModel = {
    terms: [{ id: "fall-2026", label: "Fall 2026", startsOn: "2026-08-19", endsOn: "2026-12-11", runLabel: "Fall 2026 runs Wednesday, August 19, 2026\u2013Friday, December 11, 2026." }],
    selectedTermId: "fall-2026",
    status: null,
    statusLabel: null,
    statusHelper: null,
    config: emptySchedule({ startsOn: "2026-08-19", endsOn: "2026-12-11" }),
    publishedDuration: 30,
    datesUnavailable: false,
    runLabel: "Fall 2026 runs Wednesday, August 19, 2026\u2013Friday, December 11, 2026.",
    revision: "0",
    openTimes: [],
};

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
            dateLabel: "Sunday, November 8, 2026",
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
    hasTimesOutsideHorizon: false,
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
    hasTimesOutsideHorizon: false,
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
                dateLabel: "Sunday, November 8, 2026",
                timeLabel: "10:15 AM EST",
                iso: "2026-11-08T15:15:00.000Z",
            },
        ],
    }],
    earlier: [],
    hasTimesOutsideHorizon: false,
};

export const studentRescheduled: StudentAdvisingView = {
    ...studentBooked,
    upcoming: [{
        ...confirmed,
        id: "session-moved",
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
                support: null,
                body: "A faculty meeting now overlaps the original time. Please use this new time.",
                dateLabel: "Sunday, November 8, 2026",
                timeLabel: "10:40 AM EST",
                iso: "2026-11-08T15:40:00.000Z",
                from: {
                    dateLabel: "Tuesday, November 10, 2026",
                    timeLabel: "2:00–2:30 PM EST",
                    iso: "2026-11-10T19:00:00.000Z",
                    full: "Tuesday, November 10, 2026, 2:00–2:30 PM EST",
                },
                to: {
                    dateLabel: "Tuesday, November 10, 2026",
                    timeLabel: "3:00–3:20 PM EST",
                    iso: "2026-11-10T20:00:00.000Z",
                    full: "Tuesday, November 10, 2026, 3:00–3:20 PM EST",
                },
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
                dateLabel: "Sunday, November 8, 2026",
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
    hasTimesOutsideHorizon: false,
};

export const advisorAvailability: AdvisorAppointmentsView = {
    durationMinutes: 30,
    availability: blankAvailability,
    rows: [
        {
            id: "booked-30",
            dateLabel: "Tuesday, November 10, 2026",
            timeLabel: "2:00–2:30 PM EST",
            fullTimestamp: "Tuesday, November 10, 2026, 2:00–2:30 PM EST",
            durationLabel: "30 minutes",
            durationMinutes: 30,
            dateValue: "2026-11-10",
            startValue: "14:00",
            statusLabel: "Booked",
            statusTone: "default",
            studentName: "Avery Cole",
            sessionId: "session-confirmed",
            canChange: false,
        },
        {
            id: "open-20",
            dateLabel: "Tuesday, November 10, 2026",
            timeLabel: "3:00–3:20 PM EST",
            fullTimestamp: "Tuesday, November 10, 2026, 3:00–3:20 PM EST",
            durationLabel: "20 minutes",
            durationMinutes: 20,
            dateValue: "2026-11-10",
            startValue: "15:00",
            statusLabel: "Open",
            statusTone: "outline",
            studentName: null,
            sessionId: null,
            canChange: true,
        },
    ],
    upcoming: [{
        ...confirmed,
        personName: "Avery Cole",
    }],
    canceled: [],
    earlier: [],
};

export const studentPast: StudentAdvisingView = {
    advisorName: "Sarah Martinez",
    sessionMinutes: 30,
    slots: [],
    upcoming: [],
    canceled: [],
    earlier: [{
        ...confirmed,
        id: "session-past",
        statusLabel: "Past",
        statusTone: "outline",
        canChange: false,
        started: false,
        dateLabel: "Tuesday, October 20, 2026",
        timeLabel: "2:00–2:30 PM EDT",
        fullTimestamp: "Tuesday, October 20, 2026, 2:00–2:30 PM EDT",
        iso: "2026-10-20T18:00:00.000Z",
    }],
    hasTimesOutsideHorizon: false,
};

export const advisorZoom: AdvisorAppointmentsView = {
    ...advisorAvailability,
    upcoming: [{
        ...advisorAvailability.upcoming[0]!,
        zoomUrl: "https://ncat.zoom.us/j/123456789012345?pwd=abcdefghijklmnopqrstuvwxyz",
    }],
};

export const advisorEmpty: AdvisorAppointmentsView = {
    durationMinutes: 30,
    availability: { ...blankAvailability, openTimes: [] },
    rows: [],
    upcoming: [],
    canceled: [],
    earlier: [],
};
