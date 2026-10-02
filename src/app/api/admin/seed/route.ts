import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { seedPassages } from "@/lib/seed-passages";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const seededIds = await seedPassages(prisma);
  return NextResponse.json({ ok: true, seeded: seededIds });
}
