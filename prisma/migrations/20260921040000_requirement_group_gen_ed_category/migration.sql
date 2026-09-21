-- AlterTable
ALTER TABLE "RequirementGroup" ADD COLUMN "genEdCategory" "GenEdTag",
ADD COLUMN "requiredGenEdTag" "GenEdTag";

-- Backfill program-opted gen-ed pools only. University GEC categories without a
-- matching group stay as CourseAttribute tags, not extra requirement rows.
UPDATE "RequirementGroup"
SET "genEdCategory" = (
  CASE "name"
    WHEN 'Global Awareness' THEN 'GLOBAL_AWARENESS'
    WHEN 'African American Studies' THEN 'AFRICAN_AMERICAN'
    WHEN 'Social/Behavioral Sciences' THEN 'SOCIAL_BEHAVIORAL'
    WHEN 'Scientific Reasoning with Lab' THEN 'SCIENTIFIC_REASONING'
    WHEN 'Scientific Reasoning' THEN 'SCIENTIFIC_REASONING'
    WHEN 'Written Communication' THEN 'WRITTEN_COMMUNICATION'
    WHEN 'Humanities and Fine Arts' THEN 'HUMANITIES_FINE_ARTS'
  END
)::"GenEdTag"
WHERE "slot" = 'GEN_ED_POOL';

UPDATE "RequirementGroup"
SET "requiredGenEdTag" = 'SCIENTIFIC_REASONING_LAB'
WHERE "slot" = 'GEN_ED_POOL'
  AND "name" IN ('Scientific Reasoning with Lab');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "RequirementGroup"
    WHERE "slot" = 'GEN_ED_POOL'
      AND "genEdCategory" IS NULL
  ) THEN
    RAISE EXCEPTION 'Every gen-ed pool must have a category before unique is applied';
  END IF;
END $$;

-- CreateIndex
CREATE UNIQUE INDEX "RequirementGroup_catalogYearId_genEdCategory_key" ON "RequirementGroup"("catalogYearId", "genEdCategory");
