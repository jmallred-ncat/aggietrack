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

export const advisorCancelNamedSuccess = (studentName: string) => `Session canceled. ${studentName} can see your note.`;
export const advisorCancelSavedSuccess = "Session canceled. Your note was saved.";

/** A real person who can read the note. The personName placeholder is not a recipient. */
export function identifiedRecipientName(studentName: string | null | undefined): string | null {
    const name = studentName?.replace(/\s+/g, " ").trim() ?? "";
    if (!name || name.toLowerCase() === "former user") return null;
    return name;
}

/** Named only when the saved note has an identified recipient. Otherwise say the note was saved. */
export function advisorCancelSuccess(studentName: string | null | undefined): string {
    const name = identifiedRecipientName(studentName);
    return name ? advisorCancelNamedSuccess(name) : advisorCancelSavedSuccess;
}

export function meetingSuccessText(
    result: MeetingResult,
    success: string | ((result: Extract<MeetingResult, { ok: true }>) => string | null),
): string | null {
    if (!result.ok) return null;
    return typeof success === "function" ? success(result) : success;
}
