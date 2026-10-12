-- AlterTable
ALTER TABLE "RecommendedTermCourse" ALTER COLUMN "courseId" DROP NOT NULL;
ALTER TABLE "RecommendedTermCourse" ADD COLUMN "requirementGroupId" TEXT;
ALTER TABLE "RecommendedTermCourse" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "RecommendedTermCourse" ADD CONSTRAINT "RecommendedTermCourse_requirementGroupId_fkey" FOREIGN KEY ("requirementGroupId") REFERENCES "RequirementGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "RecommendedTermCourse_requirementGroupId_idx" ON "RecommendedTermCourse"("requirementGroupId");

-- A row is either a named course or an undecided requirement group.
ALTER TABLE "RecommendedTermCourse" ADD CONSTRAINT "RecommendedTermCourse_course_or_group_check" CHECK (
  ("courseId" IS NOT NULL AND "requirementGroupId" IS NULL)
  OR ("courseId" IS NULL AND "requirementGroupId" IS NOT NULL)
);
