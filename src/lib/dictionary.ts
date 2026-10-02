import lemmatizer from "wink-lemmatizer";

type Translated = { en: string; ko: string | null };

type Meaning = {
  en: string;
  ko: string | null;
  synonyms: Translated[];
  antonyms: Translated[];
};

export type DictionaryEntry = {
  word: string; // resolved base form (English)
  koreanMeaning: string | null; // Korean gloss of the base form
  definitions: { partOfSpeech: string; meanings: Meaning[] }[];
};

const WORD_RE = /^[a-zA-Z][a-zA-Z'-]{0,44}$/;

export function isValidWord(word: string): boolean {
  return WORD_RE.test(word);
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

type RawMeaning = { text: string; synonyms: string[]; antonyms: string[] };
type RawDefinition = { partOfSpeech: string; meanings: RawMeaning[] };

type FreeDictionaryMeaning = {
  partOfSpeech: string;
  definitions: { definition: string; synonyms?: string[]; antonyms?: string[] }[];
};

type FreeDictionaryResponse = {
  word: string;
  meanings: FreeDictionaryMeaning[];
}[];

// Keeps each definition's own synonyms/antonyms attached to it, rather
// than flattening them into one word-level list, so the UI can show
// "뜻 1 -> 그 뜻의 동의어/반의어 -> 뜻 2 -> ..." instead of lumping
// every synonym/antonym from every sense together at the bottom.
async function fetchDefinitions(word: string): Promise<RawDefinition[]> {
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      { signal: AbortSignal.timeout(8000) }
    );

    if (!res.ok) return [];

    const data = (await res.json()) as FreeDictionaryResponse;
    const definitions: RawDefinition[] = [];

    for (const entry of data) {
      for (const meaning of entry.meanings ?? []) {
        const meanings: RawMeaning[] = (meaning.definitions ?? [])
          .filter((d) => d.definition)
          .map((d) => ({
            text: d.definition,
            synonyms: (d.synonyms ?? []).slice(0, 5),
            antonyms: (d.antonyms ?? []).slice(0, 5),
          }));
        if (meanings.length > 0) {
          definitions.push({ partOfSpeech: meaning.partOfSpeech, meanings });
        }
      }
    }

    return definitions;
  } catch {
    return [];
  }
}

const DATAMUSE_POS_LABEL: Record<string, string> = {
  n: "noun",
  v: "verb",
  adj: "adjective",
  adv: "adverb",
};

// Fallback definition source (WordNet via Datamuse) for when
// dictionaryapi.dev is flaky or has no entry for this word. Datamuse's
// md=d doesn't give per-definition synonyms/antonyms, so those start empty.
async function fetchDatamuseDefinitions(word: string): Promise<RawDefinition[]> {
  try {
    const res = await fetch(
      `https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=d&max=1`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];

    const data = (await res.json()) as { word: string; defs?: string[] }[];
    const entry = data.find((d) => d.word === word) ?? data[0];
    if (!entry?.defs) return [];

    const grouped = new Map<string, string[]>();
    for (const raw of entry.defs) {
      const [pos, ...rest] = raw.split("\t");
      const text = rest.join("\t").trim();
      if (!text) continue;
      const label = DATAMUSE_POS_LABEL[pos] ?? pos;
      if (!grouped.has(label)) grouped.set(label, []);
      grouped.get(label)!.push(text);
    }

    return [...grouped.entries()].map(([partOfSpeech, texts]) => ({
      partOfSpeech,
      meanings: texts.map((text) => ({ text, synonyms: [], antonyms: [] })),
    }));
  } catch {
    return [];
  }
}

async function fetchDatamuse(word: string, rel: "rel_syn" | "rel_ant") {
  try {
    const res = await fetch(
      `https://api.datamuse.com/words?${rel}=${encodeURIComponent(word)}&max=5`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { word: string }[];
    return data.map((d) => d.word);
  } catch {
    return [];
  }
}

// e.g. "species" -> ["species"] (unchanged), "studies" -> ["study"],
// "running" -> ["run"], "better" -> ["good"]
function lemmaCandidates(word: string): string[] {
  const candidates = new Set<string>();
  for (const lemma of [
    lemmatizer.noun(word),
    lemmatizer.verb(word),
    lemmatizer.adjective(word),
  ]) {
    if (lemma && lemma !== word) candidates.add(lemma);
  }
  return [...candidates];
}

// Translates every text in `texts` in a single request (joined by
// newlines - Google's endpoint splits and translates each line
// separately and preserves order), so a whole word lookup costs one
// translation call no matter how many definitions/synonyms it has.
async function translateBatchToKorean(texts: string[]): Promise<(string | null)[]> {
  if (texts.length === 0) return [];

  try {
    const joined = texts.map((t) => (t.trim() || ".").replace(/\n/g, " ")).join("\n");
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=${encodeURIComponent(joined)}`,
      { signal: AbortSignal.timeout(8000), headers: { "User-Agent": UA } }
    );

    if (!res.ok) {
      console.error(`[translateBatchToKorean] HTTP ${res.status}`);
      return texts.map(() => null);
    }

    const data = (await res.json()) as unknown;
    const segments = Array.isArray(data) && Array.isArray(data[0]) ? (data[0] as unknown[]) : [];

    if (segments.length !== texts.length) {
      console.error(
        `[translateBatchToKorean] segment mismatch: sent ${texts.length}, got ${segments.length}`
      );
    }

    return texts.map((_, i) => {
      const seg = segments[i];
      const text = Array.isArray(seg) ? String(seg[0] ?? "").trim() : "";
      return text && /[가-힣]/.test(text) ? text : null;
    });
  } catch (err) {
    console.error("[translateBatchToKorean] threw:", err);
    return texts.map(() => null);
  }
}

export async function lookupWord(word: string): Promise<DictionaryEntry | null> {
  let resolvedWord = word;
  let rawDefinitions = await fetchDefinitions(word);

  if (rawDefinitions.length === 0) {
    for (const candidate of lemmaCandidates(word)) {
      const candidateDefs = await fetchDefinitions(candidate);
      if (candidateDefs.length > 0) {
        resolvedWord = candidate;
        rawDefinitions = candidateDefs;
        break;
      }
    }
  }

  // dictionaryapi.dev can be flaky; fall back to Datamuse's own
  // (WordNet-sourced) definitions before giving up entirely.
  if (rawDefinitions.length === 0) {
    rawDefinitions = await fetchDatamuseDefinitions(resolvedWord);
  }

  if (rawDefinitions.length === 0) {
    return null;
  }

  // If dictionaryapi.dev gave no synonyms/antonyms for any individual
  // sense, fall back to Datamuse's general related words, attached to
  // the first sense only (better than not showing any at all).
  const hasPerMeaningSynAnt = rawDefinitions.some((d) =>
    d.meanings.some((m) => m.synonyms.length > 0 || m.antonyms.length > 0)
  );
  if (!hasPerMeaningSynAnt) {
    const [datamuseSyn, datamuseAnt] = await Promise.all([
      fetchDatamuse(resolvedWord, "rel_syn"),
      fetchDatamuse(resolvedWord, "rel_ant"),
    ]);
    const firstMeaning = rawDefinitions[0]?.meanings[0];
    if (firstMeaning) {
      firstMeaning.synonyms = datamuseSyn;
      firstMeaning.antonyms = datamuseAnt;
    }
  }

  const flatMeanings = rawDefinitions.flatMap((d) => d.meanings);
  const meaningTexts = flatMeanings.map((m) => m.text);
  const synAntWords = flatMeanings.flatMap((m) => [...m.synonyms, ...m.antonyms]);

  const batchInput = [resolvedWord, ...meaningTexts, ...synAntWords];
  const translated = await translateBatchToKorean(batchInput);

  let textCursor = 1; // index 0 was the headword
  let synAntCursor = 1 + meaningTexts.length;

  const definitions = rawDefinitions.map((d) => ({
    partOfSpeech: d.partOfSpeech,
    meanings: d.meanings.map((m): Meaning => ({
      en: m.text,
      ko: translated[textCursor++] ?? null,
      synonyms: m.synonyms.map((en): Translated => ({ en, ko: translated[synAntCursor++] ?? null })),
      antonyms: m.antonyms.map((en): Translated => ({ en, ko: translated[synAntCursor++] ?? null })),
    })),
  }));

  return {
    word: resolvedWord,
    koreanMeaning: translated[0] ?? null,
    definitions,
  };
}
