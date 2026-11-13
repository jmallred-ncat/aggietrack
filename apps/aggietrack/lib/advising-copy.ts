import type { MeetingResult, OpenSlotChoice } from "@/lib/advising-types";

export function groupOpenSlots(slots: readonly OpenSlotChoice[]) {
    const groups: { heading: string; slots: OpenSlotChoice[] }[] = [];
    for (const slot of slots) {
        const current = groups.at(-1);
        if (current?.heading === slot.dateHeading) current.slots.push(slot);
        else groups.push({ heading: slot.dateHeading, slots: [slot] });
    }
    return groups;
}

export const advisorCancelSavedSuccess = "Session canceled. Your note was saved.";
export const advisorRescheduleSuccess = "Session rescheduled";
export const advisorChangeNoteHelper = "Required. Add a note explaining this change.";
export const advisorCancelLabel = "Why are you canceling?";
export const advisorRescheduleLabel = "Why are you rescheduling?";
export const studentBookingNoteHelper = "Your advisor can read this note.";

/** A stored name does not show that the student can still read the note. */
export function advisorCancelSuccess(): string {
    return advisorCancelSavedSuccess;
}

export function meetingSuccessText(
    result: MeetingResult,
    success: string | ((result: Extract<MeetingResult, { ok: true }>) => string | null),
): string | null {
    if (!result.ok) return null;
    return typeof success === "function" ? success(result) : success;
}
