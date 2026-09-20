-- Departments are seeded reference data so students can search CST
-- or "Computer Systems Technology" without stuffing that into Program.name.

CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");
CREATE UNIQUE INDEX "Department_abbreviation_key" ON "Department"("abbreviation");

INSERT INTO "Department" ("id", "name", "abbreviation", "isActive", "sortOrder", "createdAt", "updatedAt")
VALUES
    (gen_random_uuid()::text, 'Computer Systems Technology', 'CST', true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

ALTER TABLE "Program" ADD COLUMN "shortName" TEXT;
ALTER TABLE "Program" ADD COLUMN "departmentId" TEXT;

UPDATE "Program"
SET "shortName" = 'INFO'
WHERE "code" = '0432' AND "shortName" IS NULL;

UPDATE "Program"
SET "shortName" = 'ELET'
WHERE "code" = '0340' AND "shortName" IS NULL;

UPDATE "Program"
SET "departmentId" = (SELECT id FROM "Department" WHERE abbreviation = 'CST')
WHERE "departmentId" IS NULL;

ALTER TABLE "Program" ALTER COLUMN "departmentId" SET NOT NULL;

ALTER TABLE "Program" ADD CONSTRAINT "Program_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Program_departmentId_idx" ON "Program"("departmentId");
CREATE INDEX "Program_shortName_idx" ON "Program"("shortName");
