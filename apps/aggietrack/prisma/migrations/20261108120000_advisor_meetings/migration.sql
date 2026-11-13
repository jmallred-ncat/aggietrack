-- Additive only. Existing AdvisingAppointment and AdvisingNote rows are not read or rewritten.
-- Overlap for confirmed sessions is enforced in the database so two concurrent bookings cannot both commit.
-- Deployment needs the btree_gist extension. Neon and PostgreSQL 16 provide it.
-- A later `prisma migrate diff` will not see these exclusion constraints in the Prisma schema.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE "MeetingSlotStatus" AS ENUM ('OPEN', 'BOOKED');
CREATE TYPE "MeetingSessionStatus" AS ENUM ('CONFIRMED', 'CANCELED');
CREATE TYPE "MeetingEventKind" AS ENUM ('BOOKED', 'CANCELED', 'RESCHEDULED', 'ZOOM_ADDED', 'ZOOM_UPDATED', 'ZOOM_REMOVED');

CREATE TABLE "AdvisorMeetingSettings" (
    "advisorId" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdvisorMeetingSettings_pkey" PRIMARY KEY ("advisorId")
);

CREATE TABLE "MeetingAvailability" (
    "id" TEXT NOT NULL,
    "advisorId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "status" "MeetingSlotStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MeetingAvailability_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeetingSession" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "advisorId" TEXT NOT NULL,
    "availabilityId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "status" "MeetingSessionStatus" NOT NULL DEFAULT 'CONFIRMED',
    "topic" TEXT,
    "zoomUrl" TEXT,
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MeetingSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeetingEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorRole" "UserRole" NOT NULL,
    "kind" "MeetingEventKind" NOT NULL,
    "body" TEXT,
    "fromStartsAt" TIMESTAMP(3),
    "fromEndsAt" TIMESTAMP(3),
    "toStartsAt" TIMESTAMP(3),
    "toEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MeetingEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MeetingSession_availabilityId_key" ON "MeetingSession"("availabilityId");
CREATE INDEX "MeetingAvailability_advisorId_startsAt_idx" ON "MeetingAvailability"("advisorId", "startsAt");
CREATE INDEX "MeetingAvailability_advisorId_status_startsAt_idx" ON "MeetingAvailability"("advisorId", "status", "startsAt");
CREATE INDEX "MeetingSession_studentId_status_startsAt_idx" ON "MeetingSession"("studentId", "status", "startsAt");
CREATE INDEX "MeetingSession_advisorId_status_startsAt_idx" ON "MeetingSession"("advisorId", "status", "startsAt");
CREATE INDEX "MeetingEvent_sessionId_createdAt_id_idx" ON "MeetingEvent"("sessionId", "createdAt", "id");

ALTER TABLE "AdvisorMeetingSettings" ADD CONSTRAINT "AdvisorMeetingSettings_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingAvailability" ADD CONSTRAINT "MeetingAvailability_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingSession" ADD CONSTRAINT "MeetingSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingSession" ADD CONSTRAINT "MeetingSession_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MeetingSession" ADD CONSTRAINT "MeetingSession_availabilityId_fkey" FOREIGN KEY ("availabilityId") REFERENCES "MeetingAvailability"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MeetingEvent" ADD CONSTRAINT "MeetingEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MeetingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Prisma stores DateTime as timestamp without time zone. tsrange stays immutable.
-- tstzrange would cast through the session TimeZone and PostgreSQL rejects that in an index.
ALTER TABLE "MeetingSession" ADD CONSTRAINT "MeetingSession_student_no_overlap"
EXCLUDE USING gist (
    "studentId" WITH =,
    tsrange("startsAt", "endsAt", '[)') WITH &&
) WHERE ("status" = 'CONFIRMED');

ALTER TABLE "MeetingSession" ADD CONSTRAINT "MeetingSession_advisor_no_overlap"
EXCLUDE USING gist (
    "advisorId" WITH =,
    tsrange("startsAt", "endsAt", '[)') WITH &&
) WHERE ("status" = 'CONFIRMED');
