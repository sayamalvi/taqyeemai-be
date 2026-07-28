/*
  Warnings:

  - You are about to drop the column `atsScore` on the `Analysis` table. All the data in the column will be lost.
  - You are about to drop the column `interviewProbability` on the `Analysis` table. All the data in the column will be lost.
  - Added the required column `resumeHealthScore` to the `Analysis` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Analysis" DROP COLUMN "atsScore",
DROP COLUMN "interviewProbability",
ADD COLUMN     "resumeHealthScore" DOUBLE PRECISION NOT NULL;
