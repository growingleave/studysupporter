import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const [passages, starred] = await Promise.all([
    prisma.passage.findMany({
      orderBy: { id: "asc" },
      select: { id: true, title: true },
    }),
    prisma.starredPassage.findMany({
      where: { userId: session.user.id },
      select: { passageId: true },
    }),
  ]);

  const starredIds = new Set(starred.map((s) => s.passageId));

  return NextResponse.json(
    passages.map((p) => ({ ...p, starred: starredIds.has(p.id) }))
  );
}
