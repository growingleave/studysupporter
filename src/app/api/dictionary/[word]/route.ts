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
  if (cached) {
    return NextResponse.json({
      word: cached.word,
      definitions: JSON.parse(cached.definition),
      synonyms: JSON.parse(cached.synonyms),
      antonyms: JSON.parse(cached.antonyms),
    });
  }

  const entry = await lookupWord(raw);
  if (!entry) {
    return NextResponse.json({ error: "사전에서 단어를 찾을 수 없습니다." }, { status: 404 });
  }

  await prisma.word
    .create({
      data: {
        word: raw,
        definition: JSON.stringify(entry.definitions),
        synonyms: JSON.stringify(entry.synonyms),
        antonyms: JSON.stringify(entry.antonyms),
      },
    })
    .catch(() => null); // benign race: another request already cached this word

  return NextResponse.json(entry);
}
