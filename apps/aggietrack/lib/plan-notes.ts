import type { UserRole } from "./generated/prisma/client";
import { planNoteRoleLabel } from "./plan-status";

export const NOTE_MAX_LENGTH = 2000;
export const NOTE_PAGE_SIZE = 20;

const knownKinds = ["NOTE", "RETURN", "SUBMISSION", "APPROVAL"] as const;
export type PlanNoteKindName = (typeof knownKinds)[number];

export type NoteViewer = { id: string; role: string };

export type NotePlanAccess = {
    id: string;
    studentUserId: string;
    advisorId: string | null;
};

export function planNoteDenial(viewer: NoteViewer, plan: NotePlanAccess | null) {
    if (!plan) return "This plan does not exist or you do not have access to it.";
    if (viewer.role === "STUDENT" && viewer.id === plan.studentUserId) return null;
    if (viewer.role === "ADVISOR" && plan.advisorId === viewer.id) return null;
    return "This plan does not exist or you do not have access to it.";
}

export function checkedNoteBody(raw: string, purpose: "note" | "comment") {
    const body = raw.trim();
    const empty = purpose === "comment"
        ? "Explain what the student needs to change."
        : "Write a note before posting.";
    const tooLong = purpose === "comment"
        ? "Keep your comment to 2,000 characters or fewer."
        : "Keep your note to 2,000 characters or fewer.";
    if (!body) return { ok: false as const, error: empty };
    if ([...body].length > NOTE_MAX_LENGTH) return { ok: false as const, error: tooLong };
    return { ok: true as const, body };
}

export function planEventLabel(kind: string) {
    if (kind === "SUBMISSION") return "Plan submitted for review";
    if (kind === "APPROVAL") return "Plan approved";
    return null;
}

export function sortPlanNotes<T extends { createdAt: Date | string; id: string }>(notes: readonly T[]) {
    return [...notes].sort((left, right) => {
        const time = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
        if (time !== 0) return time;
        return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
    });
}

export function noteCursor(note: { createdAt: Date | string; id: string }) {
    const date = note.createdAt instanceof Date ? note.createdAt : new Date(note.createdAt);
    return `${date.toISOString()}|${note.id}`;
}

export function parseNoteCursor(value: string) {
    const split = value.indexOf("|");
    if (split <= 0) return null;
    const createdAt = new Date(value.slice(0, split));
    const id = value.slice(split + 1);
    if (!id || Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id };
}

export function earlierNoteWhere(cursor: { createdAt: Date; id: string }) {
    return {
        OR: [
            { createdAt: { lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { lt: cursor.id } },
        ],
    };
}

export type PresentedNote = {
    id: string;
    body: string;
    createdAt: string;
    authorName: string;
    roleLabel: string;
    eventLabel: string | null;
    badge: string | null;
    /** Set only when the row has no user-written message. Free text stays a note. */
    eventAction: PlanNoteEventAction | null;
};

export type PlanNoteEventAction = "submitted" | "approved" | "changes";

const PLAN_NOTE_TIME_ZONE = "America/New_York";

export function planNotesAudienceDescription(audience: "student" | "advisor") {
    return audience === "advisor"
        ? "You and the student can read these notes."
        : "You and your advisor can read these notes.";
}

/** Empty workflow rows are events. A written body, including text that looks like a caption, stays a note. */
export function planNoteEventAction(kind: string, body: string): PlanNoteEventAction | null {
    if (body.trim().length > 0) return null;
    if (kind === "SUBMISSION") return "submitted";
    if (kind === "APPROVAL") return "approved";
    if (kind === "RETURN") return "changes";
    return null;
}

export function planNoteEventPhrase(action: PlanNoteEventAction) {
    if (action === "submitted") return "submitted the plan";
    if (action === "approved") return "approved the plan";
    return "requested changes";
}

function noteInstant(value: Date | string | null | undefined) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
}

function zonedYear(date: Date) {
    return new Intl.DateTimeFormat("en-US", {
        timeZone: PLAN_NOTE_TIME_ZONE,
        year: "numeric",
    }).format(date);
}

function formatNoteTime(date: Date, includeYear: boolean) {
    return new Intl.DateTimeFormat("en-US", {
        timeZone: PLAN_NOTE_TIME_ZONE,
        month: "short",
        day: "numeric",
        ...(includeYear ? { year: "numeric" as const } : {}),
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
    }).format(date);
}

/** Eastern clock time. The year is included only when it differs from `now` in America/New_York. */
export function planNoteTimestamp(value: Date | string | null | undefined, now: Date = new Date()) {
    const date = noteInstant(value);
    if (!date) return null;
    return formatNoteTime(date, zonedYear(date) !== zonedYear(now));
}

/** Full Eastern date, including the year, for the time element's title. */
export function planNoteTimestampTitle(value: Date | string | null | undefined) {
    const date = noteInstant(value);
    if (!date) return null;
    return formatNoteTime(date, true);
}

export function presentPlanNote(note: {
    id: string;
    body: string;
    kind: string;
    createdAt: Date;
    authorName: string;
    authorRole: string;
}): PresentedNote {
    const kind = knownKinds.includes(note.kind as PlanNoteKindName) ? note.kind as PlanNoteKindName : "NOTE";
    return {
        id: note.id,
        body: note.body,
        createdAt: note.createdAt.toISOString(),
        authorName: note.authorName.trim() || "Former user",
        roleLabel: planNoteRoleLabel(note.authorRole),
        eventLabel: planEventLabel(kind),
        badge: kind === "RETURN" ? "Changes requested" : null,
        eventAction: planNoteEventAction(kind, note.body),
    };
}

export function pagePlanNotes<T extends { createdAt: Date; id: string }>(rows: readonly T[], pageSize = NOTE_PAGE_SIZE) {
    const hasEarlier = rows.length > pageSize;
    const page = [...rows.slice(0, pageSize)].reverse();
    return {
        notes: page,
        earlierCursor: hasEarlier && page[0] ? noteCursor(page[0]) : null,
    };
}

export function submissionRequestId(planId: string, revision: number) {
    return `submission:${planId}:${revision}`;
}

type NoteWriter = {
    planNote: {
        findUnique: (args: {
            where: { authorId_requestId: { authorId: string; requestId: string } };
        }) => Promise<{ id: string; plannedTermId: string } | null>;
        create: (args: { data: {
            plannedTermId: string;
            authorId: string;
            authorName: string;
            authorRole: UserRole;
            kind: PlanNoteKindName;
            body: string;
            requestId: string;
        } }) => Promise<{ id: string }>;
    };
};

export async function appendPlanNote(
    tx: NoteWriter,
    input: {
        plan: NotePlanAccess | null;
        viewer: NoteViewer;
        authorName: string;
        body: string;
        requestId: string;
        kind?: PlanNoteKindName;
    },
) {
    const denial = planNoteDenial(input.viewer, input.plan);
    if (denial || !input.plan) {
        return { success: false as const, error: denial ?? "This plan does not exist or you do not have access to it.", code: "forbidden" as const };
    }
    const checked = input.kind && input.kind !== "NOTE"
        ? { ok: true as const, body: input.body.trim() }
        : checkedNoteBody(input.body, "note");
    if (!checked.ok) return { success: false as const, error: checked.error, code: "invalid" as const };
    if (!input.requestId || input.requestId.length > 80) {
        return { success: false as const, error: "Note could not be posted. Your text has been kept.", code: "invalid" as const };
    }
    const existing = await tx.planNote.findUnique({
        where: { authorId_requestId: { authorId: input.viewer.id, requestId: input.requestId } },
    });
    if (existing) {
        if (existing.plannedTermId !== input.plan.id) {
            return { success: false as const, error: "Note could not be posted. Your text has been kept.", code: "invalid" as const };
        }
        return { success: true as const, noteId: existing.id, idempotent: true as const };
    }
    const role: UserRole = input.viewer.role === "ADVISOR" ? "ADVISOR" : "STUDENT";
    const note = await tx.planNote.create({
        data: {
            plannedTermId: input.plan.id,
            authorId: input.viewer.id,
            authorName: input.authorName.trim() || "Former user",
            authorRole: role,
            kind: input.kind ?? "NOTE",
            body: checked.body,
            requestId: input.requestId,
        },
    });
    return { success: true as const, noteId: note.id };
}
