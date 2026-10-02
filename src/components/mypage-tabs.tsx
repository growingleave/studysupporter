"use client";

import Link from "next/link";
import { useState } from "react";

type Translated = { en: string; ko: string | null };

type VocabEntry = {
  word: string;
  passageId: number | null;
  passageTitle: string | null;
  koreanMeaning: string | null;
  definitions: { partOfSpeech: string; meanings: Translated[] }[];
  synonyms: Translated[];
  antonyms: Translated[];
};

function joinTranslated(items: Translated[]) {
  return items.map((item) => item.ko ?? item.en).join(", ");
}

type StarredEntry = { id: number; title: string };

export function MyPageTabs({
  vocab,
  starred,
}: {
  vocab: VocabEntry[];
  starred: StarredEntry[];
}) {
  const [tab, setTab] = useState<"vocab" | "starred">("vocab");
  const [items, setItems] = useState(vocab);

  async function handleRemove(word: string) {
    setItems((prev) => prev.filter((v) => v.word !== word));
    await fetch("/api/vocabulary", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word }),
    });
  }

  return (
    <div>
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setTab("vocab")}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${
            tab === "vocab" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500"
          }`}
        >
          나의 단어장 ({items.length})
        </button>
        <button
          onClick={() => setTab("starred")}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${
            tab === "starred" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500"
          }`}
        >
          중요 지문 ({starred.length})
        </button>
      </div>

      {tab === "vocab" && (
        <ul className="space-y-3">
          {items.length === 0 && <p className="text-gray-500">저장된 단어가 없습니다.</p>}
          {items.map((v) => (
            <li key={v.word} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-1 text-sm">
                  <p className="text-lg font-semibold">{v.word}</p>
                  {v.koreanMeaning && (
                    <p className="font-medium text-gray-900">{v.koreanMeaning}</p>
                  )}
                  {v.definitions.slice(0, 1).map((d, i) => (
                    <p key={i} className="text-gray-700">
                      <span className="font-medium text-blue-700">{d.partOfSpeech}</span>{" "}
                      {d.meanings[0]?.ko ?? d.meanings[0]?.en}
                    </p>
                  ))}
                  {v.synonyms.length > 0 && (
                    <p className="text-gray-600">동의어: {joinTranslated(v.synonyms)}</p>
                  )}
                  {v.antonyms.length > 0 && (
                    <p className="text-gray-600">반의어: {joinTranslated(v.antonyms)}</p>
                  )}
                  {v.passageId && v.passageTitle && (
                    <Link
                      href={`/passages/${v.passageId}`}
                      className="inline-block text-xs text-blue-600 hover:underline"
                    >
                      출처: {v.passageTitle}
                    </Link>
                  )}
                </div>
                <button
                  onClick={() => handleRemove(v.word)}
                  className="text-gray-400 hover:text-red-600 text-sm"
                >
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {tab === "starred" && (
        <ul className="space-y-2">
          {starred.length === 0 && <p className="text-gray-500">별표한 지문이 없습니다.</p>}
          {starred.map((p) => (
            <li key={p.id}>
              <Link
                href={`/passages/${p.id}`}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 hover:border-blue-400"
              >
                <span>
                  {p.id}. {p.title}
                </span>
                <span className="text-yellow-500">★</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
