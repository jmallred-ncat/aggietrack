-- Additive only. Existing plan rows keep their status and gain revision 0.

ALTER TYPE "PlannedTermStatus" ADD VALUE 'RETURNED';

ALTER TABLE "PlannedTerm" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;

CREATE TYPE "PlanNoteKind" AS ENUM ('NOTE', 'RETURN', 'SUBMISSION', 'APPROVAL');

CREATE TABLE "PlanNote" (
    "id" TEXT NOT NULL,
    "plannedTermId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorRole" "UserRole" NOT NULL,
    "kind" "PlanNoteKind" NOT NULL DEFAULT 'NOTE',
    "body" TEXT NOT NULL,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlanNote_authorId_requestId_key" ON "PlanNote"("authorId", "requestId");

CREATE INDEX "PlanNote_plannedTermId_createdAt_id_idx" ON "PlanNote"("plannedTermId", "createdAt", "id");

ALTER TABLE "PlanNote" ADD CONSTRAINT "PlanNote_plannedTermId_fkey" FOREIGN KEY ("plannedTermId") REFERENCES "PlannedTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlanNote" ADD CONSTRAINT "PlanNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
