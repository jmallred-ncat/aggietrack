import { semesterInSession } from "./academic-term";
import type { TermSeason } from "./generated/prisma/client";

const summerSeasons: TermSeason[] = ["SUMMER", "SUMMER_I", "SUMMER_II"];

/** Same registration window the planner uses, without loading a student profile. */
function planningTargets(terms: readonly DatedTerm[], now: Date) {
    const semesters = terms.filter((term) => term.season === "FALL" || term.season === "SPRING");
    const current = semesters.find((term) => term.startsOn <= now && term.endsOn >= now);
    const anchor = current ?? semesters
        .filter((term) => term.endsOn < now)
        .sort((left, right) => right.endsOn.getTime() - left.endsOn.getTime())[0];
    if (!anchor) return [];
    if (anchor.season === "SPRING") {
        return [
            ...summerSeasons.map((season) => ({ season, year: anchor.year })),
            { season: "FALL" as const, year: anchor.year },
        ];
    }
    return [{ season: "SPRING" as const, year: anchor.year + 1 }];
}

export const ROSTER_PAGE_SIZE = 20;

export type RosterStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "RETURNED" | null;

export type RosterRow = {
    id: string;
    firstName: string;
    lastName: string;
    bannerId: string | null;
    planId: string | null;
    status: RosterStatus;
    submittedAt: number | null;
    reviewedAt: number | null;
};

type DatedTerm = {
    id: string;
    season: TermSeason;
    year: number;
    startsOn: Date;
    endsOn: Date;
};

export function advisorTermChoices<T extends DatedTerm>(terms: readonly T[], now = new Date()) {
    const open = new Set(planningTargets(terms, now).map((target) => `${target.season}:${target.year}`));
    const upcoming = terms.filter((term) => open.has(`${term.season}:${term.year}`) && term.startsOn > now);
    const semester = semesterInSession(terms, now);
    const window = semester
        ? [semester, ...upcoming.filter((term) => term.id !== semester.id)]
        : [...upcoming];
    const defaultTerm = window.find((term) => term.startsOn > now) ?? window[0] ?? null;
    return { terms: window, defaultTermId: defaultTerm?.id ?? null };
}

export function safeStudentsReturn(value: string | undefined) {
    if (!value || !value.startsWith("/advisor/students") || value.startsWith("//") || value.includes("://")) {
        return "/advisor/students";
    }
    return value;
}

function nameOrder(a: RosterRow, b: RosterRow) {
    return a.lastName.localeCompare(b.lastName)
        || a.firstName.localeCompare(b.firstName)
        || a.id.localeCompare(b.id);
}

export function filterRoster(rows: readonly RosterRow[], query: { q?: string; status?: string }) {
    const needle = query.q?.trim().toLowerCase() ?? "";
    return rows.filter((row) => {
        if (query.status === "none") {
            if (row.planId) return false;
        } else if (query.status && query.status !== "all" && row.status !== query.status) {
            return false;
        }
        if (!needle) return true;
        const name = `${row.firstName} ${row.lastName}`.toLowerCase();
        return name.includes(needle) || (row.bannerId?.toLowerCase().includes(needle) ?? false);
    });
}

export function sortRoster(rows: readonly RosterRow[], sort = "review") {
    const copy = [...rows];
    if (sort === "name-desc") return copy.sort((a, b) => nameOrder(b, a));
    if (sort === "name") return copy.sort(nameOrder);
    if (sort === "submitted") {
        return copy.sort((a, b) => {
            if (a.submittedAt == null && b.submittedAt == null) return nameOrder(a, b);
            if (a.submittedAt == null) return 1;
            if (b.submittedAt == null) return -1;
            return b.submittedAt - a.submittedAt || nameOrder(a, b);
        });
    }
    const rank = (row: RosterRow) => {
        if (row.status === "SUBMITTED") return 0;
        if (row.status === "RETURNED") return 1;
        if (row.status === "DRAFT") return 2;
        if (row.status === "APPROVED") return 3;
        return 4;
    };
    return copy.sort((a, b) => {
        const difference = rank(a) - rank(b);
        if (difference !== 0) return difference;
        if (a.status === "SUBMITTED" && b.status === "SUBMITTED") {
            return (a.submittedAt ?? 0) - (b.submittedAt ?? 0) || nameOrder(a, b);
        }
        if (a.status === "RETURNED" && b.status === "RETURNED") {
            return (b.reviewedAt ?? 0) - (a.reviewedAt ?? 0) || nameOrder(a, b);
        }
        return nameOrder(a, b);
    });
}

export function paginateRoster<T>(rows: readonly T[], page: number, pageSize = ROSTER_PAGE_SIZE) {
    const pages = Math.max(1, Math.ceil(rows.length / pageSize));
    const current = Math.min(Math.max(1, Number.isFinite(page) ? Math.trunc(page) : 1), pages);
    const start = (current - 1) * pageSize;
    return { page: current, pages, total: rows.length, rows: rows.slice(start, start + pageSize) };
}
