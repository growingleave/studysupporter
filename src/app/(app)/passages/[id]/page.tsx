import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  PassageViewer,
  type Analysis,
  type Sentence,
  type Idiom,
  type Characteristic,
} from "@/components/passage-viewer";

export default async function PassageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id)) notFound();

  const session = await auth();
  const userId = session!.user.id;

  const [passage, starred] = await Promise.all([
    prisma.passage.findUnique({ where: { id }, include: { analysis: true } }),
    prisma.starredPassage.findUnique({
      where: { userId_passageId: { userId, passageId: id } },
    }),
  ]);

  if (!passage) notFound();

  const analysis: Analysis | null = passage.analysis
    ? {
        topic: passage.analysis.topic,
        topicSentenceKo: passage.analysis.topicSentenceKo,
        predictedTitle: passage.analysis.predictedTitle,
        sentences: (passage.analysis.sentences as Sentence[] | null) ?? [],
        idioms: (passage.analysis.idioms as Idiom[] | null) ?? [],
        coreAnalysis: passage.analysis.coreAnalysis,
        characteristics: (passage.analysis.characteristics as Characteristic[] | null) ?? [],
        summaryTranslation: passage.analysis.summaryTranslation,
      }
    : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">
        {passage.id}. {passage.title}
      </h1>
      <PassageViewer
        passageId={passage.id}
        englishText={passage.englishText}
        analysis={analysis}
        initialStarred={!!starred}
      />
    </main>
  );
}
