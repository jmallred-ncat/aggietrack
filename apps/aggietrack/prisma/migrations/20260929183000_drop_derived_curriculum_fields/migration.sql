-- RecommendedTerm.season is fall on odd sequences and spring on even sequences.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "RecommendedTerm"
    WHERE ("sequence" % 2 = 1 AND "season"::text <> 'FALL')
       OR ("sequence" % 2 = 0 AND "season"::text <> 'SPRING')
  ) THEN
    RAISE EXCEPTION 'RecommendedTerm.season is not determined by sequence';
  END IF;
END $$;

ALTER TABLE "RecommendedTerm" DROP COLUMN "season";

-- A group that lists its courses does not also store a subject rule.
UPDATE "RequirementGroup" AS "group"
SET "subject" = NULL
WHERE "subject" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "RequirementItem" AS item
    WHERE item."groupId" = "group"."id"
  );

ALTER TABLE "RequirementGroup" DROP COLUMN "kind";

DROP TYPE "RequirementKind";
