import type { TermSeason } from "./generated/prisma/client";

const seasonLabels: Record<TermSeason, string> = {
    FALL: "Fall",
    SPRING: "Spring",
    SUMMER: "Summer",
    SUMMER_I: "Summer I",
    SUMMER_II: "Summer II",
};

const seasonOrder: TermSeason[] = ["FALL", "SPRING", "SUMMER", "SUMMER_I", "SUMMER_II"];

export function academicTermLabel(term: { season: TermSeason; year: number }) {
    return `${seasonLabels[term.season]} ${term.year}`;
}

type DatedTerm = {
    season: TermSeason;
    startsOn: Date;
    endsOn: Date;
};

/** Fall or spring when one is underway. Otherwise the shortest session that contains today, such as Summer I inside the full summer term. */
export function semesterInSession<T extends DatedTerm>(terms: readonly T[], now = new Date()) {
    const active = terms.filter((term) => term.startsOn <= now && term.endsOn >= now);
    const semester = active.find((term) => term.season === "FALL" || term.season === "SPRING");
    if (semester) {
        return semester;
    }

    return [...active].sort(
        (a, b) => (a.endsOn.getTime() - a.startsOn.getTime()) - (b.endsOn.getTime() - b.startsOn.getTime()),
    )[0] ?? null;
}

/**
 * Catalog rows store summer as SUMMER. Summer I and Summer II plans count as that session.
 * An empty list means the catalog did not say, so the course is not blocked.
 */
export function courseOfferedInSeason(offeredIn: readonly TermSeason[], season: TermSeason) {
    if (offeredIn.length === 0 || offeredIn.includes(season)) {
        return true;
    }

    return (season === "SUMMER_I" || season === "SUMMER_II") && offeredIn.includes("SUMMER");
}

export function offeredSeasonsLabel(offeredIn: readonly TermSeason[]) {
    const labels = seasonOrder
        .filter((season) => offeredIn.includes(season))
        .map((season) => seasonLabels[season]);

    return new Intl.ListFormat("en", { style: "long", type: "disjunction" }).format(labels);
}

export function notOfferedInTermMessage(code: string, termLabel: string, offeredIn: readonly TermSeason[]) {
    return `${code} is not offered in ${termLabel}. It is offered in ${offeredSeasonsLabel(offeredIn)}.`;
}
