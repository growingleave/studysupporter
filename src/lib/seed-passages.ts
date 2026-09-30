import fs from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";

export type SeedPassage = {
  id: number;
  title: string;
  englishText: string;
  analysis: {
    topic: string;
    fullTranslation: string;
    summaryTranslation?: string;
    keySentence: string;
  };
};

export function readSeedPassages(): SeedPassage[] {
  const dir = path.join(process.cwd(), "prisma", "seed", "passages");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  return files.map(
    (file) => JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8")) as SeedPassage
  );
}

export async function seedPassages(prisma: PrismaClient): Promise<number[]> {
  const passages = readSeedPassages();
  const seededIds: number[] = [];

  for (const data of passages) {
    await prisma.passage.upsert({
      where: { id: data.id },
      update: {
        title: data.title,
        englishText: data.englishText,
      },
      create: {
        id: data.id,
        title: data.title,
        englishText: data.englishText,
      },
    });

    await prisma.passageAnalysis.upsert({
      where: { passageId: data.id },
      update: {
        topic: data.analysis.topic,
        fullTranslation: data.analysis.fullTranslation,
        summaryTranslation: data.analysis.summaryTranslation,
        keySentence: data.analysis.keySentence,
      },
      create: {
        passageId: data.id,
        topic: data.analysis.topic,
        fullTranslation: data.analysis.fullTranslation,
        summaryTranslation: data.analysis.summaryTranslation,
        keySentence: data.analysis.keySentence,
      },
    });

    seededIds.push(data.id);
  }

  return seededIds;
}
