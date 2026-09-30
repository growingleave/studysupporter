export type DictionaryEntry = {
  word: string;
  definitions: { partOfSpeech: string; meanings: string[] }[];
  synonyms: string[];
  antonyms: string[];
};

const WORD_RE = /^[a-zA-Z][a-zA-Z'-]{0,44}$/;

export function isValidWord(word: string): boolean {
  return WORD_RE.test(word);
}

type FreeDictionaryMeaning = {
  partOfSpeech: string;
  definitions: { definition: string; synonyms?: string[]; antonyms?: string[] }[];
};

type FreeDictionaryResponse = {
  word: string;
  meanings: FreeDictionaryMeaning[];
}[];

async function fetchDefinitions(word: string) {
  const res = await fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
    { signal: AbortSignal.timeout(8000) }
  );

  if (!res.ok) return { definitions: [], inlineSynonyms: [], inlineAntonyms: [] };

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
}

async function fetchDatamuse(word: string, rel: "rel_syn" | "rel_ant") {
  const res = await fetch(
    `https://api.datamuse.com/words?${rel}=${encodeURIComponent(word)}&max=8`,
    { signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { word: string }[];
  return data.map((d) => d.word);
}

export async function lookupWord(word: string): Promise<DictionaryEntry | null> {
  const [defResult, datamuseSyn, datamuseAnt] = await Promise.all([
    fetchDefinitions(word),
    fetchDatamuse(word, "rel_syn"),
    fetchDatamuse(word, "rel_ant"),
  ]);

  if (defResult.definitions.length === 0 && datamuseSyn.length === 0 && datamuseAnt.length === 0) {
    return null;
  }

  const synonyms = [...new Set([...defResult.inlineSynonyms, ...datamuseSyn])].slice(0, 8);
  const antonyms = [...new Set([...defResult.inlineAntonyms, ...datamuseAnt])].slice(0, 8);

  return {
    word,
    definitions: defResult.definitions,
    synonyms,
    antonyms,
  };
}
