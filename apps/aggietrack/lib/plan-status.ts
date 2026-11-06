const planStatusLabels = {
    DRAFT: "Draft",
    SUBMITTED: "Waiting for review",
    APPROVED: "Approved",
    RETURNED: "Changes requested",
} as const;

export type KnownPlanStatus = keyof typeof planStatusLabels;

export function plannedTermStatusLabel(status: string) {
    if (status in planStatusLabels) return planStatusLabels[status as KnownPlanStatus];
    return "Status unavailable";
}

export function plannedTermStatusVariant(status: string): "default" | "secondary" | "outline" {
    if (status === "APPROVED") return "default";
    if (status === "DRAFT" || status === "SUBMITTED") return "secondary";
    return "outline";
}

/** Draft and returned plans can change courses. Submitted and approved plans cannot. */
export function planCoursesLocked(status: string) {
    return status !== "DRAFT" && status !== "RETURNED";
}

export function planNoteRoleLabel(role: string) {
    if (role === "STUDENT") return "Student";
    if (role === "ADVISOR") return "Advisor";
    if (role === "ADMIN") return "Admin";
    return "Team member";
}

export function catalogYearLabel(year: number | null | undefined) {
    if (year == null || !Number.isFinite(year)) return "Not set";
    return `${year}\u2013${year + 1}`;
}

export function planTimestamp(value: Date | string | null | undefined) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
    }).format(date);
}

export function countNoun(count: number, singular: string, plural = `${singular}s`) {
    return `${count} ${count === 1 ? singular : plural}`;
}

export function personName(user: { firstName?: string | null; lastName?: string | null; name?: string | null } | null | undefined) {
    const joined = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
    return joined || user?.name?.trim() || "Former user";
}

export function personInitials(name: string) {
    const parts = name.split(/\s+/).filter(Boolean);
    const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
    return letters || "A";
}
