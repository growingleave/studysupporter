import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export default async function PassagesPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [passages, starred] = await Promise.all([
    prisma.passage.findMany({ orderBy: { id: "asc" }, select: { id: true, title: true } }),
    prisma.starredPassage.findMany({ where: { userId }, select: { passageId: true } }),
  ]);
  const starredIds = new Set(starred.map((s) => s.passageId));

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">지문 목록</h1>
      {passages.length === 0 ? (
        <p className="text-gray-500">아직 등록된 지문이 없습니다.</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {passages.map((p) => (
            <li key={p.id}>
              <Link
                href={`/passages/${p.id}`}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-4 hover:border-blue-400 hover:shadow-sm transition"
              >
                <span className="font-medium">
                  {p.id}. {p.title}
                </span>
                {starredIds.has(p.id) && <span className="text-yellow-500 text-lg">★</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
