/** A handbook elective row that does not yet name the course the student took. */
export function slotIsUnfilled(slot: { courseId: string; subject: string; number: string }) {
  return slot.courseId === "" && slot.subject === "" && slot.number === "";
}
