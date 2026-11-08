# AGT-17 implementation map

The review contract is [agt-17-design-rules.md](./agt-17-design-rules.md). This note maps that contract to the code. Items 185–200 in the contract are implementation defaults, not a claim that James chose them.

## Where the behavior lives

- Student page: `apps/aggietrack/app/(app)/student/(started)/advising/page.tsx`
- Advisor page: `apps/aggietrack/app/(app)/advisor/appointments/page.tsx`
- Screens: `apps/aggietrack/components/advising/`
- Writes: `apps/aggietrack/lib/advising-meetings.ts` and `apps/aggietrack/app/(app)/advising-actions.ts`
- Eastern time: `apps/aggietrack/lib/advising-time.ts`
- Zoom allowlist: `apps/aggietrack/lib/advising-zoom.ts`
- Schema: `apps/aggietrack/prisma/advising.prisma`
- Migration: `apps/aggietrack/prisma/migrations/20261108120000_advisor_meetings/migration.sql`

`AdvisingAppointment` and `AdvisingNote` are unchanged. The migration only adds tables.

## Decisions that the contract does not spell out

- A time that is not one of the 15-minute choices between 7:00 AM and 9:00 PM is rejected with **Choose a listed time**. The select cannot offer those times. The contract’s validation list has no sentence for a tampered value.
- A new booking that overlaps another confirmed session for the same student or advisor is rejected with **That time overlaps another session**. A taken or removed slot still uses **That time is no longer open**. Reschedule failures use **Session could not be rescheduled**.
- Windows are stored as the individual slots they create. Edit and remove act on one open slot. A booked slot is not editable.
- The book-section sentence uses the advisor’s current saved length. Each slot and session shows the length stored on that row.
- The full timestamp keeps the clock and zone in one `whitespace-nowrap` span. The date before that span can wrap, including inside a dialog sentence.
- Meeting alerts stack **Dismiss message** under the title. The shared alert corner is only wide enough for one short button, and these titles are longer.
- The advisor reschedule dialog loads open times when it opens. A controlled dialog does not get that load from `onOpenChange`.
- Confirmed-session overlap uses a PostgreSQL `tsrange` exclusion constraint. Prisma’s `DateTime` is `timestamp` without time zone, and `tstzrange` is not immutable in an index. Deployment needs the `btree_gist` extension.
- Overlap copy for a fresh booking, the listed-time sentence, and **Edit this time** are the sentences used where the contract had no exact string.

## Evidence

`/advising-evidence` renders the real shell and boards with fictional data. It calls `notFound()` when `NODE_ENV` is `production`, so it is not a public backdoor. Those screenshots are fixtures. They do not prove a booking survived refresh or that another account was refused. That proof is `lib/advising-meetings.test.ts` against an isolated database.
