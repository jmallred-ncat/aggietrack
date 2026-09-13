-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'ADVISOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "TermSeason" AS ENUM ('FALL', 'SPRING', 'SUMMER');

-- CreateEnum
CREATE TYPE "Grade" AS ENUM ('A', 'A_MINUS', 'B_PLUS', 'B', 'B_MINUS', 'C_PLUS', 'C', 'C_MINUS', 'D_PLUS', 'D', 'F', 'W', 'I', 'P', 'TR');

-- CreateEnum
CREATE TYPE "TranscriptSource" AS ENUM ('NCAT', 'TRANSFER', 'AP', 'CLEP');

-- CreateEnum
CREATE TYPE "TranscriptStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'WITHDRAWN', 'FAILED');

-- CreateEnum
CREATE TYPE "RequirementKind" AS ENUM ('ALL_OF', 'CREDITS_FROM_POOL', 'SUBJECT_ELECTIVE', 'FREE_ELECTIVE');

-- CreateEnum
CREATE TYPE "GenEdTag" AS ENUM ('WRITTEN_COMMUNICATION', 'HUMANITIES_FINE_ARTS', 'SOCIAL_BEHAVIORAL', 'GLOBAL_AWARENESS', 'AFRICAN_AMERICAN', 'SCIENTIFIC_REASONING', 'SCIENTIFIC_REASONING_LAB');

-- CreateTable
CREATE TABLE "AdvisingAppointment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "advisorId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvisingAppointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvisingNote" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "advisorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "visibleToStudent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvisingNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'STUDENT',
    "banned" BOOLEAN DEFAULT false,
    "banReason" TEXT,
    "banExpires" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "impersonatedBy" TEXT,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicTerm" (
    "id" TEXT NOT NULL,
    "season" "TermSeason" NOT NULL,
    "year" INTEGER NOT NULL,
    "startsOn" TIMESTAMP(3) NOT NULL,
    "endsOn" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "description" TEXT,
    "isLab" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseAttribute" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "catalogYearId" TEXT NOT NULL,
    "tag" "GenEdTag" NOT NULL,

    CONSTRAINT "CourseAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoursePrerequisite" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "requiresId" TEXT NOT NULL,
    "isConcurrent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CoursePrerequisite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "totalCredits" INTEGER NOT NULL DEFAULT 120,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogYear" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementGroup" (
    "id" TEXT NOT NULL,
    "catalogYearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "RequirementKind" NOT NULL,
    "minCredits" INTEGER NOT NULL,
    "minGrade" "Grade",
    "sortOrder" INTEGER NOT NULL,
    "subject" TEXT,
    "minNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequirementGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementItem" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,

    CONSTRAINT "RequirementItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendedTerm" (
    "id" TEXT NOT NULL,
    "catalogYearId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "season" "TermSeason" NOT NULL,

    CONSTRAINT "RecommendedTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendedTermCourse" (
    "id" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,

    CONSTRAINT "RecommendedTermCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bannerId" TEXT,
    "catalogYearId" TEXT NOT NULL,
    "advisorId" TEXT,
    "expectedGradTermId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranscriptEntry" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "termId" TEXT,
    "grade" "Grade",
    "status" "TranscriptStatus" NOT NULL,
    "source" "TranscriptSource" NOT NULL DEFAULT 'NCAT',
    "credits" INTEGER NOT NULL,
    "sourceInstitution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TranscriptEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannedCourse" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannedCourse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdvisingAppointment_studentId_idx" ON "AdvisingAppointment"("studentId");

-- CreateIndex
CREATE INDEX "AdvisingAppointment_advisorId_startsAt_idx" ON "AdvisingAppointment"("advisorId", "startsAt");

-- CreateIndex
CREATE INDEX "AdvisingNote_studentId_idx" ON "AdvisingNote"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicTerm_season_year_key" ON "AcademicTerm"("season", "year");

-- CreateIndex
CREATE INDEX "Course_subject_idx" ON "Course"("subject");

-- CreateIndex
CREATE UNIQUE INDEX "Course_subject_number_key" ON "Course"("subject", "number");

-- CreateIndex
CREATE INDEX "CourseAttribute_catalogYearId_tag_idx" ON "CourseAttribute"("catalogYearId", "tag");

-- CreateIndex
CREATE UNIQUE INDEX "CourseAttribute_courseId_catalogYearId_tag_key" ON "CourseAttribute"("courseId", "catalogYearId", "tag");

-- CreateIndex
CREATE UNIQUE INDEX "CoursePrerequisite_courseId_requiresId_key" ON "CoursePrerequisite"("courseId", "requiresId");

-- CreateIndex
CREATE UNIQUE INDEX "Program_code_key" ON "Program"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogYear_programId_label_key" ON "CatalogYear"("programId", "label");

-- CreateIndex
CREATE INDEX "RequirementGroup_catalogYearId_idx" ON "RequirementGroup"("catalogYearId");

-- CreateIndex
CREATE UNIQUE INDEX "RequirementItem_groupId_courseId_key" ON "RequirementItem"("groupId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "RecommendedTerm_catalogYearId_sequence_key" ON "RecommendedTerm"("catalogYearId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "RecommendedTermCourse_termId_courseId_key" ON "RecommendedTermCourse"("termId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_bannerId_key" ON "StudentProfile"("bannerId");

-- CreateIndex
CREATE INDEX "StudentProfile_advisorId_idx" ON "StudentProfile"("advisorId");

-- CreateIndex
CREATE INDEX "StudentProfile_catalogYearId_idx" ON "StudentProfile"("catalogYearId");

-- CreateIndex
CREATE INDEX "TranscriptEntry_studentId_status_idx" ON "TranscriptEntry"("studentId", "status");

-- CreateIndex
CREATE INDEX "TranscriptEntry_courseId_idx" ON "TranscriptEntry"("courseId");

-- CreateIndex
CREATE INDEX "PlannedCourse_studentId_termId_idx" ON "PlannedCourse"("studentId", "termId");

-- CreateIndex
CREATE UNIQUE INDEX "PlannedCourse_studentId_courseId_termId_key" ON "PlannedCourse"("studentId", "courseId", "termId");

-- AddForeignKey
ALTER TABLE "AdvisingAppointment" ADD CONSTRAINT "AdvisingAppointment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvisingAppointment" ADD CONSTRAINT "AdvisingAppointment_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvisingNote" ADD CONSTRAINT "AdvisingNote_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvisingNote" ADD CONSTRAINT "AdvisingNote_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAttribute" ADD CONSTRAINT "CourseAttribute_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseAttribute" ADD CONSTRAINT "CourseAttribute_catalogYearId_fkey" FOREIGN KEY ("catalogYearId") REFERENCES "CatalogYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoursePrerequisite" ADD CONSTRAINT "CoursePrerequisite_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoursePrerequisite" ADD CONSTRAINT "CoursePrerequisite_requiresId_fkey" FOREIGN KEY ("requiresId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogYear" ADD CONSTRAINT "CatalogYear_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementGroup" ADD CONSTRAINT "RequirementGroup_catalogYearId_fkey" FOREIGN KEY ("catalogYearId") REFERENCES "CatalogYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementItem" ADD CONSTRAINT "RequirementItem_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "RequirementGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementItem" ADD CONSTRAINT "RequirementItem_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendedTerm" ADD CONSTRAINT "RecommendedTerm_catalogYearId_fkey" FOREIGN KEY ("catalogYearId") REFERENCES "CatalogYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendedTermCourse" ADD CONSTRAINT "RecommendedTermCourse_termId_fkey" FOREIGN KEY ("termId") REFERENCES "RecommendedTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendedTermCourse" ADD CONSTRAINT "RecommendedTermCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_catalogYearId_fkey" FOREIGN KEY ("catalogYearId") REFERENCES "CatalogYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_expectedGradTermId_fkey" FOREIGN KEY ("expectedGradTermId") REFERENCES "AcademicTerm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptEntry" ADD CONSTRAINT "TranscriptEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptEntry" ADD CONSTRAINT "TranscriptEntry_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptEntry" ADD CONSTRAINT "TranscriptEntry_termId_fkey" FOREIGN KEY ("termId") REFERENCES "AcademicTerm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedCourse" ADD CONSTRAINT "PlannedCourse_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedCourse" ADD CONSTRAINT "PlannedCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedCourse" ADD CONSTRAINT "PlannedCourse_termId_fkey" FOREIGN KEY ("termId") REFERENCES "AcademicTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
