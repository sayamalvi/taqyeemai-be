/*
  Warnings:

  - Added the required column `interviewProbability` to the `Analysis` table without a default value. This is not possible if the table is not empty.
  - Added the required column `missingSkills` to the `Analysis` table without a default value. This is not possible if the table is not empty.
  - Added the required column `recruiterConcerns` to the `Analysis` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Analysis" ADD COLUMN     "interviewProbability" INTEGER NOT NULL,
ADD COLUMN     "missingSkills" JSONB NOT NULL,
ADD COLUMN     "recruiterConcerns" JSONB NOT NULL,
ALTER COLUMN "scoreBreakdown" DROP NOT NULL;
