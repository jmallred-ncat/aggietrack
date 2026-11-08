-- A canceled session keeps its start, end, and event history.
-- Clearing this link lets the same open time be booked again or removed.
-- PostgreSQL unique indexes treat NULL as distinct, so many canceled rows can release the same slot.
-- Drop NOT NULL first. Setting the column to NULL while it is still required fails when any canceled row exists.

ALTER TABLE "MeetingSession" ALTER COLUMN "availabilityId" DROP NOT NULL;

UPDATE "MeetingSession"
SET "availabilityId" = NULL
WHERE "status" = 'CANCELED'
  AND "availabilityId" IS NOT NULL;
