import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PassageViewer } from "@/components/passage-viewer";

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

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">
        {passage.id}. {passage.title}
      </h1>
      <PassageViewer
        passageId={passage.id}
        englishText={passage.englishText}
        analysis={passage.analysis}
        initialStarred={!!starred}
      />
    </main>
  );
}
