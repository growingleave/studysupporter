import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

type SeedPassage = {
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

async function main() {
  const dir = path.join(__dirname, "seed", "passages");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), "utf-8");
    const data = JSON.parse(raw) as SeedPassage;

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

    console.log(`Seeded passage #${data.id}: ${data.title}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
