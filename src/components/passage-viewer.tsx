"use client";

import { useState } from "react";

export type Sentence = {
  en: string;
  ko: string;
  isKey?: boolean;
  label?: string;
  labelType?: "major" | "minor";
};

export type Idiom = {
  expression: string;
  meaning: string;
};

export type Characteristic = {
  label: string;
  description: string;
};

export type Analysis = {
  topic: string;
  topicSentenceKo: string;
  predictedTitle: string;
  sentences: Sentence[];
  idioms: Idiom[];
  coreAnalysis: string;
  characteristics: Characteristic[];
  summaryTranslation: string | null;
};

type Translated = { en: string; ko: string | null };

type Meaning = {
  en: string;
  ko: string | null;
  synonyms: Translated[];
  antonyms: Translated[];
};

type DictionaryEntry = {
  word: string;
  koreanMeaning: string | null;
  definitions: { partOfSpeech: string; meanings: Meaning[] }[];
};

const WORD_TOKEN_RE = /[A-Za-z']+|[^A-Za-z']+/g;

const POS_KO: Record<string, string> = {
  noun: "명사",
  verb: "동사",
  adjective: "형용사",
  adverb: "부사",
  pronoun: "대명사",
  preposition: "전치사",
  conjunction: "접속사",
  interjection: "감탄사",
  determiner: "한정사",
};

function TranslatedList({ items }: { items: Translated[] }) {
  return (
    <>
      {items.map((item, i) => (
        <span key={item.en}>
          {item.ko ?? item.en}
          {i < items.length - 1 && ", "}
        </span>
      ))}
    </>
  );
}

export function PassageViewer({
  passageId,
  englishText,
  analysis,
  initialStarred,
}: {
  passageId: number;
  englishText: string;
  analysis: Analysis | null;
  initialStarred: boolean;
}) {
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showCharacteristics, setShowCharacteristics] = useState(false);
  const [wordCheckMode, setWordCheckMode] = useState(false);
  const [starred, setStarred] = useState(initialStarred);
  const [starLoading, setStarLoading] = useState(false);

  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [wordData, setWordData] = useState<DictionaryEntry | null>(null);
  const [wordLoading, setWordLoading] = useState(false);
  const [wordError, setWordError] = useState<string | null>(null);
  const [addedWords, setAddedWords] = useState<Set<string>>(new Set());

  const tokens = englishText.match(WORD_TOKEN_RE) ?? [englishText];

  async function handleWordClick(rawWord: string) {
    const word = rawWord.toLowerCase();
    setSelectedWord(word);
    setWordData(null);
    setWordError(null);
    setWordLoading(true);

    try {
      const res = await fetch(`/api/dictionary/${encodeURIComponent(word)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setWordError(data.error || "단어를 불러오지 못했습니다.");
        return;
      }
      setWordData(await res.json());
    } catch {
      setWordError("네트워크 오류가 발생했습니다.");
    } finally {
      setWordLoading(false);
    }
  }

  async function handleAddVocab() {
    if (!selectedWord) return;
    const res = await fetch("/api/vocabulary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word: selectedWord, passageId }),
    });
    if (res.ok) {
      setAddedWords((prev) => new Set(prev).add(selectedWord));
    }
  }

  async function toggleStar() {
    setStarLoading(true);
    const method = starred ? "DELETE" : "POST";
    const res = await fetch("/api/starred", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passageId }),
    });
    if (res.ok) setStarred(!starred);
    setStarLoading(false);
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          onClick={() => setShowAnalysis((v) => !v)}
          className={`rounded-full px-4 py-2 text-sm font-medium ${
            showAnalysis ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          해석보기
        </button>
        <button
          onClick={() => setWordCheckMode((v) => !v)}
          className={`rounded-full px-4 py-2 text-sm font-medium ${
            wordCheckMode ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          단어체크 {wordCheckMode ? "ON" : "OFF"}
        </button>
        <button
          onClick={() => setShowCharacteristics((v) => !v)}
          className={`rounded-full px-4 py-2 text-sm font-medium ${
            showCharacteristics
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          지문특성
        </button>
        <button
          onClick={toggleStar}
          disabled={starLoading}
          className={`rounded-full px-4 py-2 text-sm font-medium ${
            starred ? "bg-yellow-400 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          {starred ? "★ 별표됨" : "☆ 별표"}
        </button>
      </div>

      {showAnalysis && analysis && (
        <div className="mb-6 rounded-lg border border-blue-100 bg-blue-50 p-4 space-y-4 text-sm">
          <p>
            <span className="font-semibold">주제: </span>
            {analysis.topic}
          </p>

          <div className="space-y-3">
            {analysis.sentences.map((s, i) => (
              <div key={i} className={`rounded px-2 py-1.5 ${s.isKey ? "bg-yellow-200" : ""}`}>
                <p className="text-gray-800 leading-relaxed">{s.en}</p>
                <p className="text-gray-600 leading-relaxed">
                  {s.ko}
                  {s.label && (
                    <span
                      className={`ml-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${
                        s.labelType === "major"
                          ? "bg-orange-200 text-orange-900"
                          : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {s.label}
                    </span>
                  )}
                </p>
              </div>
            ))}
          </div>

          {analysis.idioms.length > 0 && (
            <div className="border-t border-blue-200 pt-3">
              <p className="font-semibold mb-1">숙어·비유·상징 표현</p>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                {analysis.idioms.map((idiom, i) => (
                  <li key={i}>
                    <span className="font-medium">{idiom.expression}</span> — {idiom.meaning}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysis.summaryTranslation && (
            <p className="whitespace-pre-wrap leading-relaxed border-t border-blue-200 pt-3">
              <span className="font-semibold">요약 해석: </span>
              {analysis.summaryTranslation}
            </p>
          )}
        </div>
      )}

      {showCharacteristics && analysis && (
        <div className="mb-6 rounded-lg border border-purple-100 bg-purple-50 p-4 space-y-4 text-sm">
          <p>
            <span className="font-semibold">예상 제목: </span>
            {analysis.predictedTitle}
          </p>
          <p>
            <span className="font-semibold">주제문: </span>
            {analysis.topicSentenceKo}
          </p>
          {analysis.summaryTranslation && (
            <p className="whitespace-pre-wrap leading-relaxed">
              <span className="font-semibold">요약: </span>
              {analysis.summaryTranslation}
            </p>
          )}
          <div>
            <p className="font-semibold mb-1">핵심분석</p>
            <p className="whitespace-pre-wrap leading-relaxed text-gray-700">
              {analysis.coreAnalysis}
            </p>
          </div>

          {analysis.characteristics.length > 0 && (
            <div>
              <p className="font-semibold mb-1">지문 특성</p>
              <ul className="space-y-1 text-gray-700">
                {analysis.characteristics.map((c, i) => (
                  <li key={i}>
                    <span className="inline-block rounded-full bg-purple-200 px-2 py-0.5 text-xs font-medium text-purple-900 mr-2">
                      {c.label}
                    </span>
                    {c.description}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <p className="text-lg leading-[1.85] select-none">
        {tokens.map((token, i) => {
          const isWord = /^[A-Za-z']+$/.test(token);
          if (!isWord || !wordCheckMode) {
            return <span key={i}>{token}</span>;
          }
          return (
            <span
              key={i}
              role="button"
              tabIndex={0}
              onClick={() => handleWordClick(token)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleWordClick(token);
              }}
              className="cursor-pointer rounded px-0.5 py-0.5 underline decoration-dotted decoration-blue-400 underline-offset-2 hover:bg-blue-50"
            >
              {token}
            </span>
          );
        })}
      </p>

      {selectedWord && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setSelectedWord(null)}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 max-h-[70vh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:left-auto sm:w-96 sm:max-h-none sm:rounded-none sm:rounded-l-2xl">
            <div className="flex items-start justify-between mb-1">
              <h2 className="text-xl font-bold">{selectedWord}</h2>
              <button
                onClick={() => setSelectedWord(null)}
                className="text-gray-400 hover:text-gray-700 text-xl leading-none"
                aria-label="닫기"
              >
                ×
              </button>
            </div>
            {wordLoading && <p className="text-gray-500 text-sm">불러오는 중...</p>}
            {wordError && <p className="text-red-600 text-sm">{wordError}</p>}

            {wordData && (
              <div className="space-y-4 text-sm">
                {wordData.koreanMeaning && (
                  <p className="text-lg font-bold text-gray-900">{wordData.koreanMeaning}</p>
                )}

                <div className="space-y-3">
                  {wordData.definitions.length === 0 && !wordData.koreanMeaning && (
                    <p className="text-gray-500">뜻풀이를 찾을 수 없습니다.</p>
                  )}
                  {wordData.definitions.map((d, i) => (
                    <div key={i}>
                      <p className="font-semibold text-blue-700">
                        {POS_KO[d.partOfSpeech] ?? d.partOfSpeech}
                      </p>
                      <ul className="list-disc list-inside space-y-2 text-gray-700">
                        {d.meanings.map((m, j) => (
                          <li key={j}>
                            {m.ko ?? m.en}
                            {m.synonyms.length > 0 && (
                              <p className="pl-4 text-xs text-gray-500">
                                동의어: <TranslatedList items={m.synonyms} />
                              </p>
                            )}
                            {m.antonyms.length > 0 && (
                              <p className="pl-4 text-xs text-gray-500">
                                반의어: <TranslatedList items={m.antonyms} />
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleAddVocab}
                  disabled={addedWords.has(selectedWord)}
                  className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {addedWords.has(selectedWord) ? "내 단어장에 추가됨" : "내 단어장에 추가"}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
