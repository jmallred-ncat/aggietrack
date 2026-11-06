-- A catalog corequisite is enforced. A reverse link stored for the course browser is not.
-- Existing lab rows keep today's lab-requires-lecture behavior until the catalog seed rewrites every group.
ALTER TABLE "PrerequisiteGroup" ADD COLUMN "fromCatalog" BOOLEAN NOT NULL DEFAULT false;

UPDATE "PrerequisiteGroup" AS requirement
SET "fromCatalog" = true
FROM "Course" AS course
WHERE requirement."courseId" = course."id"
  AND requirement."isConcurrent" = true
  AND course."isLab" = true;
