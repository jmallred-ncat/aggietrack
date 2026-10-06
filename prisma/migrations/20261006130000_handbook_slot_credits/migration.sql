-- Handbook slots can state their own credit load and label.
ALTER TABLE "RecommendedTermCourse" ADD COLUMN "credits" INTEGER;
ALTER TABLE "RecommendedTermCourse" ADD COLUMN "label" TEXT;
ALTER TABLE "RecommendedTermCourse" ADD COLUMN "requiresLab" BOOLEAN NOT NULL DEFAULT false;
