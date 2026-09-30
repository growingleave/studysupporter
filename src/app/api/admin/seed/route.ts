import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { seedPassages } from "@/lib/seed-passages";

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function GET(request: Request) {
  const expected = process.env.AUTH_SECRET;
  const provided = new URL(request.url).searchParams.get("secret");

  if (!expected || !provided || !timingSafeEqual(provided, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const seededIds = await seedPassages(prisma);
  return NextResponse.json({ ok: true, seeded: seededIds });
}
