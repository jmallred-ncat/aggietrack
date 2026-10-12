-- AlterTable
ALTER TABLE "TranscriptEntry" ADD COLUMN     "number" TEXT,
ADD COLUMN     "subject" TEXT,
ADD COLUMN     "title" TEXT,
ALTER COLUMN "courseId" DROP NOT NULL;

-- A row names a catalog course or a free elective the catalog does not list.
ALTER TABLE "TranscriptEntry" ADD CONSTRAINT "TranscriptEntry_course_or_unlisted_check" CHECK (
    (
        "courseId" IS NOT NULL
        AND "subject" IS NULL
        AND "number" IS NULL
        AND "title" IS NULL
    )
    OR (
        "courseId" IS NULL
        AND "subject" IS NOT NULL
        AND "number" IS NOT NULL
        AND "title" IS NOT NULL
    )
);
