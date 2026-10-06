/*
  Warnings:

  - You are about to drop the column `fullTranslation` on the `PassageAnalysis` table. All the data in the column will be lost.
  - You are about to drop the column `keySentence` on the `PassageAnalysis` table. All the data in the column will be lost.
  - Added the required column `sentences` to the `PassageAnalysis` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
-- Existing rows get an empty array as a placeholder; the seed script
-- (re-run via /api/admin/seed) overwrites them with real content right
-- after this migration applies.
ALTER TABLE "PassageAnalysis" DROP COLUMN "fullTranslation",
DROP COLUMN "keySentence",
ADD COLUMN     "sentences" JSONB NOT NULL DEFAULT '[]';
