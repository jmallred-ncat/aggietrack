-- DropForeignKey
ALTER TABLE "RecommendedTermCourse" DROP CONSTRAINT "RecommendedTermCourse_courseId_fkey";

-- AddForeignKey
ALTER TABLE "RecommendedTermCourse" ADD CONSTRAINT "RecommendedTermCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
