-- CreateEnum
CREATE TYPE "RequirementSlot" AS ENUM ('PROGRAM_CORE', 'SUPPORTING_REQUIRED', 'RELATED_POOL', 'GEN_ED_POOL', 'TECHNICAL_ELECTIVE', 'FREE_ELECTIVE');

-- DropIndex
DROP INDEX "RequirementGroup_catalogYearId_idx";

-- AlterTable
ALTER TABLE "RequirementGroup" ADD COLUMN "slot" "RequirementSlot";

-- Backfill existing groups before enforcing the required field. Names are used
-- only for this one-time classification of historical major-core rows.
UPDATE "RequirementGroup"
SET "slot" = (
  CASE
    WHEN "kind" = 'ALL_OF' AND "name" = 'CST Major Core' THEN 'PROGRAM_CORE'
    WHEN "kind" = 'ALL_OF' THEN 'SUPPORTING_REQUIRED'
    WHEN "kind" = 'CREDITS_FROM_POOL' AND "subject" IS NOT NULL THEN 'RELATED_POOL'
    WHEN "kind" = 'CREDITS_FROM_POOL' THEN 'GEN_ED_POOL'
    WHEN "kind" = 'SUBJECT_ELECTIVE' THEN 'TECHNICAL_ELECTIVE'
    WHEN "kind" = 'FREE_ELECTIVE' THEN 'FREE_ELECTIVE'
  END
)::"RequirementSlot";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "RequirementGroup"
    GROUP BY "catalogYearId"
    HAVING COUNT(*) FILTER (WHERE "slot" = 'PROGRAM_CORE') <> 1
  ) THEN
    RAISE EXCEPTION 'Each catalog year must have exactly one program core';
  END IF;
END $$;

ALTER TABLE "RequirementGroup" ALTER COLUMN "slot" SET NOT NULL;

-- CreateIndex
CREATE INDEX "RequirementGroup_catalogYearId_slot_idx" ON "RequirementGroup"("catalogYearId", "slot");
