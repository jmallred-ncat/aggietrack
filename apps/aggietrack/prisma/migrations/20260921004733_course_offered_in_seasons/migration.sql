-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "offeredIn" "TermSeason"[] DEFAULT ARRAY[]::"TermSeason"[];
