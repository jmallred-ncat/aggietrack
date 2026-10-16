-- AlterTable
ALTER TABLE "user" ADD COLUMN "role" TEXT;
ALTER TABLE "user" ADD COLUMN "banned" BOOLEAN DEFAULT false;
ALTER TABLE "user" ADD COLUMN "banReason" TEXT;
ALTER TABLE "user" ADD COLUMN "banExpires" DATETIME;

-- AlterTable
ALTER TABLE "session" ADD COLUMN "impersonatedBy" TEXT;
