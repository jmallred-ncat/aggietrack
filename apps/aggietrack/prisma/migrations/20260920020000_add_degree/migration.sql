-- Award level is a closed set; named degrees are seeded reference data
-- so admins can attach programs without a code change.

CREATE TYPE "DegreeLevel" AS ENUM ('BACCALAUREATE', 'MASTERS', 'DOCTORAL', 'CERTIFICATE');

CREATE TABLE "Degree" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "level" "DegreeLevel" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Degree_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Degree_name_key" ON "Degree"("name");
CREATE UNIQUE INDEX "Degree_abbreviation_key" ON "Degree"("abbreviation");
CREATE INDEX "Degree_level_isActive_idx" ON "Degree"("level", "isActive");

INSERT INTO "Degree" ("id", "name", "abbreviation", "level", "isActive", "sortOrder", "createdAt", "updatedAt")
VALUES
    (gen_random_uuid()::text, 'Bachelor of Science', 'B.S.', 'BACCALAUREATE', true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Bachelor of Arts', 'B.A.', 'BACCALAUREATE', true, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Master of Science', 'M.S.', 'MASTERS', true, 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Master of Arts', 'M.A.', 'MASTERS', true, 40, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Master of Arts in Teaching', 'M.A.T.', 'MASTERS', true, 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Master of Arts in Education', 'M.A.Ed.', 'MASTERS', true, 60, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Master of Business Administration', 'M.B.A.', 'MASTERS', true, 70, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Master of Accountancy', 'M.Acc.', 'MASTERS', true, 80, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Master of Social Work', 'M.S.W.', 'MASTERS', true, 90, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Master of School Administration', 'M.S.A.', 'MASTERS', true, 100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Doctor of Philosophy', 'Ph.D.', 'DOCTORAL', true, 110, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Doctor of Nursing Practice', 'D.N.P.', 'DOCTORAL', true, 120, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Undergraduate Certificate', 'Cert.', 'CERTIFICATE', true, 130, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Post-Baccalaureate Certificate', 'P.B.C.', 'CERTIFICATE', true, 140, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Post-Master''s Certificate', 'P.M.C.', 'CERTIFICATE', true, 150, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

ALTER TABLE "Program" ADD COLUMN "degreeId" TEXT;

UPDATE "Program" AS program
SET "degreeId" = degree.id
FROM "Degree" AS degree
WHERE program."degreeId" IS NULL
  AND (
      (degree.abbreviation = 'B.S.' AND program.name ~ ',[[:space:]]*B\.S\.?$')
      OR (degree.abbreviation = 'B.A.' AND program.name ~ ',[[:space:]]*B\.A\.?$')
      OR (degree.abbreviation = 'M.S.' AND program.name ~ ',[[:space:]]*M\.S\.?$')
      OR (degree.abbreviation = 'M.A.' AND program.name ~ ',[[:space:]]*M\.A\.?$')
      OR (degree.abbreviation = 'M.A.T.' AND program.name ~ ',[[:space:]]*M\.A\.T\.?$')
      OR (degree.abbreviation = 'M.A.Ed.' AND program.name ~ ',[[:space:]]*M\.A\.Ed\.?$')
      OR (degree.abbreviation = 'M.B.A.' AND program.name ~ ',[[:space:]]*M\.B\.A\.?$')
      OR (degree.abbreviation = 'M.Acc.' AND program.name ~ ',[[:space:]]*M\.Acc\.?$')
      OR (degree.abbreviation = 'M.S.W.' AND program.name ~ ',[[:space:]]*M\.S\.W\.?$')
      OR (degree.abbreviation = 'M.S.A.' AND program.name ~ ',[[:space:]]*M\.S\.A\.?$')
      OR (degree.abbreviation = 'Ph.D.' AND program.name ~ ',[[:space:]]*Ph\.D\.?$')
      OR (degree.abbreviation = 'D.N.P.' AND program.name ~ ',[[:space:]]*D\.N\.P\.?$')
  );

UPDATE "Program"
SET "degreeId" = (SELECT id FROM "Degree" WHERE abbreviation = 'B.S.')
WHERE "degreeId" IS NULL;

UPDATE "Program"
SET name = regexp_replace(name, ',[[:space:]]*(B\.S\.?|B\.A\.?|M\.S\.?|M\.A\.T\.?|M\.A\.Ed\.?|M\.A\.?|M\.B\.A\.?|M\.Acc\.?|M\.S\.W\.?|M\.S\.A\.?|Ph\.D\.?|D\.N\.P\.?)$', '')
WHERE name ~ ',[[:space:]]*(B\.S\.?|B\.A\.?|M\.S\.?|M\.A\.T\.?|M\.A\.Ed\.?|M\.A\.?|M\.B\.A\.?|M\.Acc\.?|M\.S\.W\.?|M\.S\.A\.?|Ph\.D\.?|D\.N\.P\.?)$';

ALTER TABLE "Program" ALTER COLUMN "degreeId" SET NOT NULL;

ALTER TABLE "Program" ADD CONSTRAINT "Program_degreeId_fkey" FOREIGN KEY ("degreeId") REFERENCES "Degree"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Program_degreeId_idx" ON "Program"("degreeId");
CREATE UNIQUE INDEX "Program_name_degreeId_key" ON "Program"("name", "degreeId");
