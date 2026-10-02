import lemmatizer from "wink-lemmatizer";

type Translated = { en: string; ko: string | null };

export type DictionaryEntry = {
  word: string; // resolved base form (English)
  koreanMeaning: string | null; // Korean gloss of the base form
  definitions: { partOfSpeech: string; meanings: Translated[] }[];
  synonyms: Translated[];
  antonyms: Translated[];
};

const WORD_RE = /^[a-zA-Z][a-zA-Z'-]{0,44}$/;

export function isValidWord(word: string): boolean {
  return WORD_RE.test(word);
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

type FreeDictionaryMeaning = {
  partOfSpeech: string;
  definitions: { definition: string; synonyms?: string[]; antonyms?: string[] }[];
};

type FreeDictionaryResponse = {
  word: string;
  meanings: FreeDictionaryMeaning[];
}[];

async function fetchDefinitions(word: string) {
  const empty = { definitions: [], inlineSynonyms: [], inlineAntonyms: [] };

  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      { signal: AbortSignal.timeout(8000) }
    );

    if (!res.ok) return empty;

    const data = (await res.json()) as FreeDictionaryResponse;
    const definitions: { partOfSpeech: string; meanings: string[] }[] = [];
    const inlineSynonyms = new Set<string>();
    const inlineAntonyms = new Set<string>();

    for (const entry of data) {
      for (const meaning of entry.meanings ?? []) {
        const meanings = (meaning.definitions ?? []).map((d) => d.definition).filter(Boolean);
        if (meanings.length > 0) {
          definitions.push({ partOfSpeech: meaning.partOfSpeech, meanings });
        }
        for (const d of meaning.definitions ?? []) {
          for (const s of d.synonyms ?? []) inlineSynonyms.add(s);
          for (const a of d.antonyms ?? []) inlineAntonyms.add(a);
        }
      }
    }

    return { definitions, inlineSynonyms: [...inlineSynonyms], inlineAntonyms: [...inlineAntonyms] };
  } catch {
    return empty;
  }
}

const DATAMUSE_POS_LABEL: Record<string, string> = {
  n: "noun",
  v: "verb",
  adj: "adjective",
  adv: "adverb",
};

// Fallback definition source (WordNet via Datamuse) for when
// dictionaryapi.dev is flaky or has no entry for this word.
async function fetchDatamuseDefinitions(word: string) {
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

    return [...grouped.entries()].map(([partOfSpeech, meanings]) => ({ partOfSpeech, meanings }));
  } catch {
    return [];
  }
}

async function fetchDatamuse(word: string, rel: "rel_syn" | "rel_ant") {
  try {
    const res = await fetch(
      `https://api.datamuse.com/words?${rel}=${encodeURIComponent(word)}&max=8`,
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
  let defResult = await fetchDefinitions(word);

  if (defResult.definitions.length === 0) {
    for (const candidate of lemmaCandidates(word)) {
      const candidateResult = await fetchDefinitions(candidate);
      if (candidateResult.definitions.length > 0) {
        resolvedWord = candidate;
        defResult = candidateResult;
        break;
      }
    }
  }

  // dictionaryapi.dev can be flaky; fall back to Datamuse's own
  // (WordNet-sourced) definitions before giving up entirely.
  if (defResult.definitions.length === 0) {
    const fallbackDefs = await fetchDatamuseDefinitions(resolvedWord);
    if (fallbackDefs.length > 0) {
      defResult = { ...defResult, definitions: fallbackDefs };
    }
  }

  const [datamuseSyn, datamuseAnt] = await Promise.all([
    fetchDatamuse(resolvedWord, "rel_syn"),
    fetchDatamuse(resolvedWord, "rel_ant"),
  ]);

  const synonyms = [...new Set([...defResult.inlineSynonyms, ...datamuseSyn])].slice(0, 8);
  const antonyms = [...new Set([...defResult.inlineAntonyms, ...datamuseAnt])].slice(0, 8);

  if (defResult.definitions.length === 0 && synonyms.length === 0 && antonyms.length === 0) {
    return null;
  }

  // One combined batch: [headword, ...every meaning, ...synonyms, ...antonyms]
  const meaningTexts = defResult.definitions.flatMap((d) => d.meanings);
  const batchInput = [resolvedWord, ...meaningTexts, ...synonyms, ...antonyms];
  const translated = await translateBatchToKorean(batchInput);

  let i = 0;
  const koreanMeaning = translated[i++] ?? null;

  const definitions = defResult.definitions.map((d) => ({
    partOfSpeech: d.partOfSpeech,
    meanings: d.meanings.map((en): Translated => ({ en, ko: translated[i++] ?? null })),
  }));

  const synonymsTranslated = synonyms.map((en): Translated => ({ en, ko: translated[i++] ?? null }));
  const antonymsTranslated = antonyms.map((en): Translated => ({ en, ko: translated[i++] ?? null }));

  return {
    word: resolvedWord,
    koreanMeaning,
    definitions,
    synonyms: synonymsTranslated,
    antonyms: antonymsTranslated,
  };
}
