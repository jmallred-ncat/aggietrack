-- Repair canceled sessions that still occupy a slot. Safe to run more than once.
-- Drop NOT NULL first. The canonical 20261108180000 file updates before that drop, so it
-- fails when a canceled row already exists. This later file cannot run until that earlier
-- migration has finished. A database in that failed state needs the preflight below.
-- This file never inserts a slot, so a removed time stays removed.
-- It reopens only a future, well-formed, canceled-only slot that does not overlap another
-- time or a confirmed session. Every canceled link is cleared. Confirmed links stay.
-- Compare instants in UTC. availability timestamps are stored without a time zone.

ALTER TABLE "MeetingSession" ALTER COLUMN "availabilityId" DROP NOT NULL;

UPDATE "MeetingAvailability" AS slot
SET "status" = 'OPEN',
    "updatedAt" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
WHERE slot."status" = 'BOOKED'
  AND slot."startsAt" > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
  AND slot."endsAt" > slot."startsAt"
  AND slot."durationMinutes" IN (15, 20, 30, 45, 60)
  AND slot."endsAt" = slot."startsAt" + (slot."durationMinutes" * INTERVAL '1 minute')
  AND EXISTS (
    SELECT 1
    FROM "MeetingSession" canceled
    WHERE canceled."availabilityId" = slot."id"
      AND canceled."status" = 'CANCELED'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "MeetingSession" other
    WHERE other."availabilityId" = slot."id"
      AND other."status" <> 'CANCELED'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "MeetingAvailability" overlap
    WHERE overlap."advisorId" = slot."advisorId"
      AND overlap."id" <> slot."id"
      AND overlap."startsAt" < slot."endsAt"
      AND overlap."endsAt" > slot."startsAt"
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "MeetingSession" confirmed
    WHERE confirmed."advisorId" = slot."advisorId"
      AND confirmed."status" = 'CONFIRMED'
      AND confirmed."startsAt" < slot."endsAt"
      AND confirmed."endsAt" > slot."startsAt"
  );

UPDATE "MeetingSession"
SET "availabilityId" = NULL,
    "updatedAt" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
WHERE "status" = 'CANCELED'
  AND "availabilityId" IS NOT NULL;

-- Preflight, read only, before migrate deploy on a database that may already have meetings.
-- initial-empty: meeting tables are absent. Production's first deploy of this branch is this case.
--   The canonical file then runs against tables just created empty, so its update matches nothing.
-- blocked-failed-release: 20261108180000 is recorded and unfinished. Resolve it as rolled back,
--   run this file's statements once by hand, then migrate deploy. Deploy before that hand repair
--   tries the canonical file again and fails the same way. This file cannot pass a failed migration.
-- blocked-canceled-before-release: that migration is not finished, availabilityId is still required,
--   and a canceled row holds a slot. Run this file's statements once by hand, then migrate deploy.
-- ok: deploy. The canonical file is already finished, or it will match no canceled row.
-- Do not edit _prisma_migrations.checksum. Prisma 7.10 deploy does not provide that repair.
