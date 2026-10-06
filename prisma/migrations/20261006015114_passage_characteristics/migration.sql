/*
  Warnings:

  - Added the required column `characteristics` to the `PassageAnalysis` table without a default value. This is not possible if the table is not empty.
  - Added the required column `coreAnalysis` to the `PassageAnalysis` table without a default value. This is not possible if the table is not empty.
  - Added the required column `predictedTitle` to the `PassageAnalysis` table without a default value. This is not possible if the table is not empty.
  - Added the required column `topicSentenceKo` to the `PassageAnalysis` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
-- Existing rows get placeholder defaults; the seed script (re-run via
-- /api/admin/seed) overwrites them with real content right after this
-- migration applies.
ALTER TABLE "PassageAnalysis" ADD COLUMN     "characteristics" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "coreAnalysis" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "idioms" JSONB,
ADD COLUMN     "predictedTitle" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "topicSentenceKo" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "sentences" DROP DEFAULT;
