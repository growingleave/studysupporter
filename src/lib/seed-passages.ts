import fs from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";

export type SeedSentence = {
  en: string;
  ko: string;
  isKey?: boolean;
  label?: string; // e.g. "예시: 할로윈", "실험 시작", "내용 전환"
  labelType?: "major" | "minor"; // major: 내용이 완전히 바뀜, minor: 가벼운 전환
};

export type SeedIdiom = {
  expression: string; // 숙어/비유/상징 표현 (영어)
  meaning: string; // 실제 의미 (한국어)
};

export type SeedCharacteristic = {
  label: string; // e.g. "난이도", "어휘 수준", "예상 문제 유형"
  description: string;
};

export type SeedPassage = {
  id: number;
  title: string;
  englishText: string;
  analysis: {
    topic: string;
    topicSentenceKo: string;
    predictedTitle: string;
    sentences: SeedSentence[];
    idioms?: SeedIdiom[];
    coreAnalysis: string;
    characteristics: SeedCharacteristic[];
    summaryTranslation?: string;
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
        topicSentenceKo: data.analysis.topicSentenceKo,
        predictedTitle: data.analysis.predictedTitle,
        sentences: data.analysis.sentences,
        idioms: data.analysis.idioms ?? [],
        coreAnalysis: data.analysis.coreAnalysis,
        characteristics: data.analysis.characteristics,
        summaryTranslation: data.analysis.summaryTranslation,
      },
      create: {
        passageId: data.id,
        topic: data.analysis.topic,
        topicSentenceKo: data.analysis.topicSentenceKo,
        predictedTitle: data.analysis.predictedTitle,
        sentences: data.analysis.sentences,
        idioms: data.analysis.idioms ?? [],
        coreAnalysis: data.analysis.coreAnalysis,
        characteristics: data.analysis.characteristics,
        summaryTranslation: data.analysis.summaryTranslation,
      },
    });

    seededIds.push(data.id);
  }

  return seededIds;
}
