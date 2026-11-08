-- Additive. Existing MeetingAvailability and MeetingSession rows keep their times and history.
-- Existing open times default to MANUAL so a semester publish cannot delete them.
-- Draft rows are advisor configuration only. This migration does not create bookable times.

CREATE TYPE "MeetingSlotSource" AS ENUM ('MANUAL', 'MANUAL_WINDOW', 'TERM_PATTERN', 'TERM_OVERRIDE');

ALTER TABLE "MeetingAvailability" ADD COLUMN "source" "MeetingSlotSource" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "MeetingAvailability" ADD COLUMN "termId" TEXT;

CREATE INDEX "MeetingAvailability_advisorId_termId_startsAt_idx" ON "MeetingAvailability"("advisorId", "termId", "startsAt");

ALTER TABLE "MeetingAvailability" ADD CONSTRAINT "MeetingAvailability_termId_fkey" FOREIGN KEY ("termId") REFERENCES "AcademicTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AdvisorTermSchedule" (
    "id" TEXT NOT NULL,
    "advisorId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdvisorTermSchedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdvisorTermDraft" (
    "id" TEXT NOT NULL,
    "advisorId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdvisorTermDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdvisorTermSchedule_advisorId_termId_key" ON "AdvisorTermSchedule"("advisorId", "termId");
CREATE INDEX "AdvisorTermSchedule_advisorId_idx" ON "AdvisorTermSchedule"("advisorId");
CREATE UNIQUE INDEX "AdvisorTermDraft_advisorId_termId_key" ON "AdvisorTermDraft"("advisorId", "termId");
CREATE INDEX "AdvisorTermDraft_advisorId_idx" ON "AdvisorTermDraft"("advisorId");

ALTER TABLE "AdvisorTermSchedule" ADD CONSTRAINT "AdvisorTermSchedule_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdvisorTermSchedule" ADD CONSTRAINT "AdvisorTermSchedule_termId_fkey" FOREIGN KEY ("termId") REFERENCES "AcademicTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdvisorTermDraft" ADD CONSTRAINT "AdvisorTermDraft_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdvisorTermDraft" ADD CONSTRAINT "AdvisorTermDraft_termId_fkey" FOREIGN KEY ("termId") REFERENCES "AcademicTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
