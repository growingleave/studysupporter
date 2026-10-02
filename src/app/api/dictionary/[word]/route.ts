import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isValidWord, lookupWord } from "@/lib/dictionary";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ word: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const raw = decodeURIComponent((await params).word || "").trim().toLowerCase();

  if (!isValidWord(raw)) {
    return NextResponse.json({ error: "유효하지 않은 단어입니다." }, { status: 400 });
  }

  const cached = await prisma.word.findUnique({ where: { word: raw } });
  // Only trust the cache once it has a Korean meaning - rows cached before
  // that feature existed (or from a failed earlier lookup) need a refetch.
  if (cached?.koreanMeaning) {
    return NextResponse.json({
      word: cached.word,
      resolvedWord: cached.resolvedWord,
      koreanMeaning: cached.koreanMeaning,
      definitions: JSON.parse(cached.definition),
      synonyms: JSON.parse(cached.synonyms),
      antonyms: JSON.parse(cached.antonyms),
    });
  }

  const entry = await lookupWord(raw);
  if (!entry) {
    return NextResponse.json({ error: "사전에서 단어를 찾을 수 없습니다." }, { status: 404 });
  }

  const resolvedWord = entry.word !== raw ? entry.word : null;

  await prisma.word
    .upsert({
      where: { word: raw },
      update: {
        resolvedWord,
        definition: JSON.stringify(entry.definitions),
        synonyms: JSON.stringify(entry.synonyms),
        antonyms: JSON.stringify(entry.antonyms),
        koreanMeaning: entry.koreanMeaning,
      },
      create: {
        word: raw,
        resolvedWord,
        definition: JSON.stringify(entry.definitions),
        synonyms: JSON.stringify(entry.synonyms),
        antonyms: JSON.stringify(entry.antonyms),
        koreanMeaning: entry.koreanMeaning,
      },
    })
    .catch(() => null); // benign race: another request already wrote this word

  return NextResponse.json({ ...entry, word: raw, resolvedWord });
}
