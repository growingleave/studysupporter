import Link from "next/link";
import { auth } from "@/auth";

export default async function Home() {
  const session = await auth();

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 text-center">
      <h1 className="text-3xl font-bold mb-3">StudySupporter</h1>
      <p className="max-w-md text-gray-600 mb-8">
        영어 지문을 읽으며 해석과 단어 뜻을 바로 확인하고, 내 단어장에 모아보세요.
      </p>
      <Link
        href={session?.user ? "/passages" : "/login"}
        className="rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700"
      >
        {session?.user ? "지문 목록 보기" : "시작하기"}
      </Link>
    </main>
  );
}
