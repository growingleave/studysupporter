import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isValidWord, parseDefinitions } from "@/lib/dictionary";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const entries = await prisma.userVocabulary.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { passage: { select: { id: true, title: true } } },
  });

  const words = await prisma.word.findMany({
    where: { word: { in: entries.map((e) => e.word) } },
  });
  const wordMap = new Map(words.map((w) => [w.word, w]));

  return NextResponse.json(
    entries.map((e) => {
      const cached = wordMap.get(e.word);
      return {
        word: e.word,
        passage: e.passage,
        createdAt: e.createdAt,
        koreanMeaning: cached?.koreanMeaning ?? null,
        definitions: cached ? parseDefinitions(cached.definition) ?? [] : [],
      };
    })
  );
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const word = typeof body?.word === "string" ? body.word.trim().toLowerCase() : "";
  const passageId = Number.isInteger(body?.passageId) ? (body.passageId as number) : undefined;

  if (!isValidWord(word)) {
    return NextResponse.json({ error: "유효하지 않은 단어입니다." }, { status: 400 });
  }

  await prisma.userVocabulary.upsert({
    where: { userId_word: { userId: session.user.id, word } },
    update: { passageId },
    create: { userId: session.user.id, word, passageId },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const word = typeof body?.word === "string" ? body.word.trim().toLowerCase() : "";

  if (!isValidWord(word)) {
    return NextResponse.json({ error: "유효하지 않은 단어입니다." }, { status: 400 });
  }

  await prisma.userVocabulary
    .delete({ where: { userId_word: { userId: session.user.id, word } } })
    .catch(() => null);

  return NextResponse.json({ ok: true });
}
