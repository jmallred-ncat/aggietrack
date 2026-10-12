-- CreateEnum
CREATE TYPE "StudentStanding" AS ENUM ('FRESHMAN', 'SOPHOMORE', 'JUNIOR', 'SENIOR');

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN "standing" "StudentStanding";
