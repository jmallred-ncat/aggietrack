-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN "startConfirmedAt" TIMESTAMP(3);

-- Students who already recorded coursework have a known start.
UPDATE "StudentProfile" AS profile
SET "startConfirmedAt" = CURRENT_TIMESTAMP
WHERE EXISTS (
    SELECT 1
    FROM "TranscriptEntry" AS entry
    WHERE entry."studentId" = profile."id"
);
