import { TermSeason } from "../../lib/generated/prisma/client";

export type TermSeed = {
  season: TermSeason;
  year: number;
  /** Classes begin (NCAT registrar / catalog) */
  startsOn: Date;
  /** Last day of finals, or session end (NCAT) */
  endsOn: Date;
};

/** Noon UTC so calendar days stay stable across timezones. */
function day(year: number, month: number, date: number) {
  return new Date(Date.UTC(year, month - 1, date, 12, 0, 0));
}

/**
 * Academic terms for the prototype.
 *
 * Expected: Fall / Spring / Summer / Summer I / Summer II.
 * Many summer courses run in first or second session only, so I and II stay.
 * Summer (no suffix) is NCAT’s dual / full summer session.
 *
 * Available: NCAT registrar & undergraduate catalog calendars only.
 * Estimated terms are omitted — gaps before Summer 2024 are intentional.
 */
export const academicTerms: TermSeed[] = [
  { season: TermSeason.FALL, year: 2020, startsOn: day(2020, 8, 19), endsOn: day(2020, 12, 11) },
  { season: TermSeason.FALL, year: 2021, startsOn: day(2021, 8, 18), endsOn: day(2021, 12, 10) },
  { season: TermSeason.FALL, year: 2022, startsOn: day(2022, 8, 17), endsOn: day(2022, 12, 9) },
  { season: TermSeason.SPRING, year: 2023, startsOn: day(2023, 1, 9), endsOn: day(2023, 5, 12) },
  { season: TermSeason.SPRING, year: 2024, startsOn: day(2024, 1, 16), endsOn: day(2024, 5, 10) },
  { season: TermSeason.SUMMER, year: 2024, startsOn: day(2024, 5, 20), endsOn: day(2024, 8, 2) },
  { season: TermSeason.SUMMER_I, year: 2024, startsOn: day(2024, 5, 20), endsOn: day(2024, 6, 25) },
  { season: TermSeason.SUMMER_II, year: 2024, startsOn: day(2024, 6, 27), endsOn: day(2024, 8, 2) },
  { season: TermSeason.FALL, year: 2024, startsOn: day(2024, 8, 21), endsOn: day(2024, 12, 13) },
  { season: TermSeason.SPRING, year: 2025, startsOn: day(2025, 1, 13), endsOn: day(2025, 5, 9) },
  { season: TermSeason.SUMMER, year: 2025, startsOn: day(2025, 5, 19), endsOn: day(2025, 8, 1) },
  { season: TermSeason.SUMMER_I, year: 2025, startsOn: day(2025, 5, 19), endsOn: day(2025, 6, 24) },
  { season: TermSeason.SUMMER_II, year: 2025, startsOn: day(2025, 6, 26), endsOn: day(2025, 8, 1) },
  { season: TermSeason.FALL, year: 2025, startsOn: day(2025, 8, 20), endsOn: day(2025, 12, 12) },
  { season: TermSeason.SPRING, year: 2026, startsOn: day(2026, 1, 12), endsOn: day(2026, 5, 8) },
  { season: TermSeason.SUMMER, year: 2026, startsOn: day(2026, 5, 18), endsOn: day(2026, 7, 31) },
  { season: TermSeason.SUMMER_I, year: 2026, startsOn: day(2026, 5, 18), endsOn: day(2026, 6, 23) },
  { season: TermSeason.SUMMER_II, year: 2026, startsOn: day(2026, 6, 25), endsOn: day(2026, 7, 31) },
  { season: TermSeason.FALL, year: 2026, startsOn: day(2026, 8, 19), endsOn: day(2026, 12, 11) },
  { season: TermSeason.SPRING, year: 2027, startsOn: day(2027, 1, 11), endsOn: day(2027, 5, 7) },
  { season: TermSeason.SUMMER, year: 2027, startsOn: day(2027, 5, 17), endsOn: day(2027, 7, 30) },
  { season: TermSeason.SUMMER_I, year: 2027, startsOn: day(2027, 5, 17), endsOn: day(2027, 6, 22) },
  { season: TermSeason.SUMMER_II, year: 2027, startsOn: day(2027, 6, 24), endsOn: day(2027, 7, 30) },
];
