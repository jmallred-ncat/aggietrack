-- CreateTable
CREATE TABLE "PrerequisiteGroup" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "isConcurrent" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrerequisiteGroup_pkey" PRIMARY KEY ("id")
);

-- Each existing requirement becomes its own AND group with one option.
INSERT INTO "PrerequisiteGroup" ("id", "courseId", "isConcurrent", "sortOrder", "createdAt", "updatedAt")
SELECT
    "id",
    "courseId",
    "isConcurrent",
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "CoursePrerequisite";

-- AlterTable
ALTER TABLE "CoursePrerequisite" ADD COLUMN "groupId" TEXT;
ALTER TABLE "CoursePrerequisite" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "CoursePrerequisite" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "CoursePrerequisite" SET "groupId" = "id";

ALTER TABLE "CoursePrerequisite" ALTER COLUMN "groupId" SET NOT NULL;

ALTER TABLE "CoursePrerequisite" DROP CONSTRAINT "CoursePrerequisite_courseId_fkey";
DROP INDEX "CoursePrerequisite_courseId_requiresId_key";
ALTER TABLE "CoursePrerequisite" DROP COLUMN "courseId";
ALTER TABLE "CoursePrerequisite" DROP COLUMN "isConcurrent";

-- AddForeignKey
ALTER TABLE "PrerequisiteGroup" ADD CONSTRAINT "PrerequisiteGroup_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoursePrerequisite" ADD CONSTRAINT "CoursePrerequisite_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "PrerequisiteGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "CoursePrerequisite_groupId_requiresId_key" ON "CoursePrerequisite"("groupId", "requiresId");
CREATE INDEX "PrerequisiteGroup_courseId_idx" ON "PrerequisiteGroup"("courseId");
CREATE INDEX "CoursePrerequisite_requiresId_idx" ON "CoursePrerequisite"("requiresId");
