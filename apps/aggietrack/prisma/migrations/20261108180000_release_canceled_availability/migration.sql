-- A canceled session keeps its start, end, and event history.
-- Clearing this link lets the same open time be booked again or removed.
-- PostgreSQL unique indexes treat NULL as distinct, so many canceled rows can release the same slot.

UPDATE "MeetingSession"
SET "availabilityId" = NULL
WHERE "status" = 'CANCELED'
  AND "availabilityId" IS NOT NULL;

ALTER TABLE "MeetingSession" ALTER COLUMN "availabilityId" DROP NOT NULL;
