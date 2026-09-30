import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const starred = await prisma.starredPassage.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { passage: { select: { id: true, title: true } } },
  });

  return NextResponse.json(starred.map((s) => s.passage));
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const passageId = Number(body?.passageId);
  if (!Number.isInteger(passageId)) {
    return NextResponse.json({ error: "잘못된 지문 ID입니다." }, { status: 400 });
  }

  await prisma.starredPassage.upsert({
    where: { userId_passageId: { userId: session.user.id, passageId } },
    update: {},
    create: { userId: session.user.id, passageId },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const passageId = Number(body?.passageId);
  if (!Number.isInteger(passageId)) {
    return NextResponse.json({ error: "잘못된 지문 ID입니다." }, { status: 400 });
  }

  await prisma.starredPassage
    .delete({ where: { userId_passageId: { userId: session.user.id, passageId } } })
    .catch(() => null);

  return NextResponse.json({ ok: true });
}
