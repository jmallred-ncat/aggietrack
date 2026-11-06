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

export type StudentNextStep = {
    title: string;
    body: string;
    action: string;
    href: string;
};

/** One next step, using the same status words as the planner badge. */
export function studentNextStep(plan: {
    termLabel: string;
    status: string;
    registered: boolean;
    href: string;
} | null): StudentNextStep {
    if (!plan) {
        return {
            title: "Next step",
            body: "Open the planner, add the courses for your next term, and submit that plan for review.",
            action: "Open the planner",
            href: "/student/planner",
        };
    }

    if (plan.status === "DRAFT") {
        return {
            title: "Next step",
            body: `Your ${plan.termLabel} plan is a draft. Add your courses and submit it for review.`,
            action: "Continue plan",
            href: plan.href,
        };
    }

    if (plan.status === "SUBMITTED") {
        return {
            title: "Next step",
            body: `Your ${plan.termLabel} plan is waiting for your advisor's review.`,
            action: "View plan",
            href: plan.href,
        };
    }

    if (plan.status === "RETURNED") {
        return {
            title: "Next step",
            body: `Changes requested for your ${plan.termLabel} plan. Read the comment, update your courses, and submit the plan again.`,
            action: "Update plan",
            href: plan.href,
        };
    }

    if (plan.status === "APPROVED" && plan.registered) {
        return {
            title: "Next step",
            body: `You confirmed registration for ${plan.termLabel}.`,
            action: "View plan",
            href: plan.href,
        };
    }

    if (plan.status === "APPROVED") {
        return {
            title: "Next step",
            body: `Your ${plan.termLabel} plan is approved. Register with your pin, then confirm in the planner.`,
            action: "Open approved plan",
            href: plan.href,
        };
    }

    return {
        title: "Next step",
        body: "Status unavailable. Open the planner to review this term.",
        action: "View plan",
        href: plan.href,
    };
}
