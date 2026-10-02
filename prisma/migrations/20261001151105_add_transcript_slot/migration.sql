-- DropForeignKey
ALTER TABLE "RecommendedTermCourse" DROP CONSTRAINT "RecommendedTermCourse_courseId_fkey";

-- AlterTable
ALTER TABLE "CoursePrerequisite" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TranscriptEntry" ADD COLUMN     "recommendedTermCourseId" TEXT;

-- CreateIndex
CREATE INDEX "TranscriptEntry_recommendedTermCourseId_idx" ON "TranscriptEntry"("recommendedTermCourseId");

-- AddForeignKey
ALTER TABLE "RecommendedTermCourse" ADD CONSTRAINT "RecommendedTermCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptEntry" ADD CONSTRAINT "TranscriptEntry_recommendedTermCourseId_fkey" FOREIGN KEY ("recommendedTermCourseId") REFERENCES "RecommendedTermCourse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
