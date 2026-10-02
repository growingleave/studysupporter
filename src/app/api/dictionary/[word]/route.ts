import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isValidWord, lookupWord, parseDefinitions, serializeDefinitions } from "@/lib/dictionary";

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
  const cachedDefinitions = cached ? parseDefinitions(cached.definition) : null;

  // Only trust the cache once it has a Korean meaning and matches the
  // current schema version - older rows need a refetch.
  if (cached?.koreanMeaning && cachedDefinitions) {
    return NextResponse.json({
      word: cached.word,
      koreanMeaning: cached.koreanMeaning,
      definitions: cachedDefinitions,
    });
  }

  const entry = await lookupWord(raw);
  if (!entry) {
    return NextResponse.json({ error: "사전에서 단어를 찾을 수 없습니다." }, { status: 404 });
  }

  const resolvedWord = entry.word !== raw ? entry.word : null;
  const definitionJson = serializeDefinitions(entry.definitions);

  await prisma.word
    .upsert({
      where: { word: raw },
      update: {
        resolvedWord,
        definition: definitionJson,
        synonyms: "[]",
        antonyms: "[]",
        koreanMeaning: entry.koreanMeaning,
      },
      create: {
        word: raw,
        resolvedWord,
        definition: definitionJson,
        synonyms: "[]",
        antonyms: "[]",
        koreanMeaning: entry.koreanMeaning,
      },
    })
    .catch(() => null); // benign race: another request already wrote this word

  return NextResponse.json({ word: raw, koreanMeaning: entry.koreanMeaning, definitions: entry.definitions });
}
