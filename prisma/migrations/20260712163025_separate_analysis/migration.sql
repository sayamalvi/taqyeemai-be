/*
  Warnings:

  - You are about to drop the column `parsedData` on the `ResumeVersion` table. All the data in the column will be lost.
  - Added the required column `parsedData` to the `Analysis` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rawText` to the `ResumeVersion` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Analysis" ADD COLUMN     "parsedData" JSONB NOT NULL;

-- AlterTable
ALTER TABLE "ResumeVersion" DROP COLUMN "parsedData",
ADD COLUMN     "rawText" TEXT NOT NULL;
