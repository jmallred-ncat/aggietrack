import { countNoun, planDate } from "./plan-status";

export type AdvisorPlanOrder = {
    id: string;
    status: string;
    submittedAt?: Date | string | number | null;
    reviewedAt?: Date | string | number | null;
    updatedAt?: Date | string | number | null;
};

function millis(value: Date | string | number | null | undefined) {
    if (value == null) return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    const date = value instanceof Date ? value : new Date(value);
    const ms = date.getTime();
    return Number.isNaN(ms) ? null : ms;
}

function newestFirst(left: number | null, right: number | null) {
    return (right ?? 0) - (left ?? 0);
}

/** Waiting plans first, oldest submission first, then returned plans, then the rest. */
export function sortAdvisorPlans<T extends AdvisorPlanOrder>(plans: readonly T[]) {
    const rank = (status: string) => (status === "SUBMITTED" ? 0 : status === "RETURNED" ? 1 : 2);
    return [...plans].sort((a, b) => {
        const byStatus = rank(a.status) - rank(b.status);
        if (byStatus !== 0) return byStatus;
        if (a.status === "SUBMITTED") {
            const left = millis(a.submittedAt);
            const right = millis(b.submittedAt);
            if (left == null && right == null) return a.id.localeCompare(b.id);
            if (left == null) return 1;
            if (right == null) return -1;
            return left - right || a.id.localeCompare(b.id);
        }
        if (a.status === "RETURNED") {
            const byReview = newestFirst(millis(a.reviewedAt) ?? millis(a.updatedAt), millis(b.reviewedAt) ?? millis(b.updatedAt));
            return byReview || a.id.localeCompare(b.id);
        }
        return newestFirst(millis(a.updatedAt), millis(b.updatedAt)) || a.id.localeCompare(b.id);
    });
}

function dated(value: Date | string | number | null | undefined) {
    if (value == null) return null;
    if (typeof value === "number") return Number.isFinite(value) ? new Date(value) : null;
    return value;
}

/** Date only, in the same words as the students roster. No clock and no status code. */
export function advisorPlanUpdatedLabel(plan: AdvisorPlanOrder) {
    if (plan.status === "SUBMITTED") {
        const submitted = planDate(dated(plan.submittedAt));
        return submitted ? `Submitted ${submitted}` : "Submitted";
    }
    if (plan.status === "RETURNED") {
        const returned = planDate(dated(plan.reviewedAt ?? plan.updatedAt));
        return returned ? `Returned ${returned}` : "Returned";
    }
    if (plan.status === "APPROVED") {
        const reviewed = planDate(dated(plan.reviewedAt ?? plan.updatedAt));
        return reviewed ? `Reviewed ${reviewed}` : "Reviewed";
    }
    const updated = planDate(dated(plan.updatedAt));
    return updated ? `Updated ${updated}` : "Not submitted";
}

export function advisorPlansSummary(total: number, waiting: number) {
    return `${countNoun(total, "plan")} · ${waiting} waiting for review`;
}
