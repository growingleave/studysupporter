import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseDefinitions } from "@/lib/dictionary";
import { MyPageTabs } from "@/components/mypage-tabs";

export default async function MyPagePage() {
  const session = await auth();
  const userId = session!.user.id;

  const [vocabEntries, starredEntries] = await Promise.all([
    prisma.userVocabulary.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { passage: { select: { id: true, title: true } } },
    }),
    prisma.starredPassage.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { passage: { select: { id: true, title: true } } },
    }),
  ]);

  const words = await prisma.word.findMany({
    where: { word: { in: vocabEntries.map((v) => v.word) } },
  });
  const wordMap = new Map(words.map((w) => [w.word, w]));

  const vocab = vocabEntries.map((v) => {
    const cached = wordMap.get(v.word);
    return {
      word: v.word,
      passageId: v.passage?.id ?? null,
      passageTitle: v.passage?.title ?? null,
      koreanMeaning: cached?.koreanMeaning ?? null,
      definitions: cached ? parseDefinitions(cached.definition) ?? [] : [],
    };
  });

  const starred = starredEntries.map((s) => s.passage);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">마이페이지</h1>
      <MyPageTabs vocab={vocab} starred={starred} />
    </main>
  );
}
