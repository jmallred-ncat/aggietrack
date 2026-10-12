-- CreateEnum
CREATE TYPE "PlannedTermStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED');

-- CreateTable
CREATE TABLE "PlannedTerm" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "status" "PlannedTermStatus" NOT NULL DEFAULT 'DRAFT',
    "registrationPin" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "registeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannedTerm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlannedTerm_studentId_idx" ON "PlannedTerm"("studentId");

-- CreateIndex
CREATE INDEX "PlannedTerm_status_idx" ON "PlannedTerm"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PlannedTerm_studentId_termId_key" ON "PlannedTerm"("studentId", "termId");

-- AddForeignKey
ALTER TABLE "PlannedTerm" ADD CONSTRAINT "PlannedTerm_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedTerm" ADD CONSTRAINT "PlannedTerm_termId_fkey" FOREIGN KEY ("termId") REFERENCES "AcademicTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Keep existing planned courses by grouping them onto one plan per student and term.
INSERT INTO "PlannedTerm" ("id", "studentId", "termId", "status", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "studentId", "termId", 'DRAFT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "PlannedCourse"
GROUP BY "studentId", "termId";

-- AlterTable
ALTER TABLE "PlannedCourse" ADD COLUMN "plannedTermId" TEXT;

UPDATE "PlannedCourse" AS course
SET "plannedTermId" = term."id"
FROM "PlannedTerm" AS term
WHERE term."studentId" = course."studentId"
  AND term."termId" = course."termId";

ALTER TABLE "PlannedCourse" ALTER COLUMN "plannedTermId" SET NOT NULL;

-- DropForeignKey
ALTER TABLE "PlannedCourse" DROP CONSTRAINT "PlannedCourse_studentId_fkey";

-- DropForeignKey
ALTER TABLE "PlannedCourse" DROP CONSTRAINT "PlannedCourse_termId_fkey";

-- DropIndex
DROP INDEX "PlannedCourse_studentId_courseId_termId_key";

-- DropIndex
DROP INDEX "PlannedCourse_studentId_termId_idx";

-- AlterTable
ALTER TABLE "PlannedCourse" DROP COLUMN "studentId",
DROP COLUMN "termId";

-- CreateIndex
CREATE INDEX "PlannedCourse_courseId_idx" ON "PlannedCourse"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "PlannedCourse_plannedTermId_courseId_key" ON "PlannedCourse"("plannedTermId", "courseId");

-- AddForeignKey
ALTER TABLE "PlannedCourse" ADD CONSTRAINT "PlannedCourse_plannedTermId_fkey" FOREIGN KEY ("plannedTermId") REFERENCES "PlannedTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
