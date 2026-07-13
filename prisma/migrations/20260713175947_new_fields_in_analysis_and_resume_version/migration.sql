/*
  Warnings:

  - Added the required column `source` to the `ResumeVersion` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Analysis" ADD COLUMN     "keywords" JSONB,
ADD COLUMN     "rewrites" JSONB,
ADD COLUMN     "strengths" JSONB;

-- AlterTable
ALTER TABLE "ResumeVersion" ADD COLUMN     "source" TEXT NOT NULL;
