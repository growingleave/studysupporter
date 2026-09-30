import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const id = Number((await params).id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "잘못된 지문 ID입니다." }, { status: 400 });
  }

  const [passage, starred] = await Promise.all([
    prisma.passage.findUnique({
      where: { id },
      include: { analysis: true },
    }),
    prisma.starredPassage.findUnique({
      where: { userId_passageId: { userId: session.user.id, passageId: id } },
    }),
  ]);

  if (!passage) {
    return NextResponse.json({ error: "지문을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ ...passage, starred: !!starred });
}
