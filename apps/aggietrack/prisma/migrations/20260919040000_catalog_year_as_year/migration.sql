-- Catalog identity is the academic-year start (2020 → 2020–2021).
-- Backfill from label, then drop the redundant date/label columns.

ALTER TABLE "CatalogYear" ADD COLUMN "year" INTEGER;

UPDATE "CatalogYear"
SET "year" = CAST(split_part("label", '-', 1) AS INTEGER);

ALTER TABLE "CatalogYear" ALTER COLUMN "year" SET NOT NULL;

DROP INDEX "CatalogYear_programId_label_key";

ALTER TABLE "CatalogYear"
DROP COLUMN "label",
DROP COLUMN "effectiveFrom",
DROP COLUMN "effectiveTo";

CREATE UNIQUE INDEX "CatalogYear_programId_year_key" ON "CatalogYear"("programId", "year");
