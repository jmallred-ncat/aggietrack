-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN "notTakingTermId" TEXT;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_notTakingTermId_fkey" FOREIGN KEY ("notTakingTermId") REFERENCES "AcademicTerm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
