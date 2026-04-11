export type VocabularyPayload = {
  word: string;
  meaning: string;
  synonyms: string[];
  antonyms: string[];
  example: string;
};

export function isVocabularyPayload(value: unknown): value is VocabularyPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.word === "string" &&
    typeof v.meaning === "string" &&
    Array.isArray(v.synonyms) &&
    v.synonyms.every((x) => typeof x === "string") &&
    Array.isArray(v.antonyms) &&
    v.antonyms.every((x) => typeof x === "string") &&
    typeof v.example === "string"
  );
}

export function normalizeVocabularyPayload(raw: unknown): VocabularyPayload {
  if (!raw || typeof raw !== "object") {
    return emptyVocabularyPayload();
  }
  const o = raw as Record<string, unknown>;
  const asStringArray = (x: unknown): string[] =>
    Array.isArray(x) ? x.filter((i): i is string => typeof i === "string") : [];
  return {
    word: typeof o.word === "string" ? o.word : "",
    meaning: typeof o.meaning === "string" ? o.meaning : "",
    synonyms: asStringArray(o.synonyms),
    antonyms: asStringArray(o.antonyms),
    example: typeof o.example === "string" ? o.example : "",
  };
}

export function emptyVocabularyPayload(): VocabularyPayload {
  return {
    word: "",
    meaning: "",
    synonyms: [],
    antonyms: [],
    example: "",
  };
}

/**
 * LLM 루트 객체를 단어 배열로 정규화합니다.
 * - 권장: `{ "words": [ { word, meaning, ... }, ... ] }`
 * - 호환: 단일 `{ word, meaning, ... }` 는 길이 1 배열로 취급
 */
export function parseVocabularyWordsFromLlmRoot(parsed: unknown): VocabularyPayload[] {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("LLM 응답이 JSON 객체가 아닙니다.");
  }
  const o = parsed as Record<string, unknown>;

  if (Array.isArray(o.words)) {
    const items = o.words
      .map((item) => normalizeVocabularyPayload(item))
      .filter((w) => w.word.trim().length > 0);
    if (items.length === 0) {
      throw new Error(
        'words 배열에 유효한 항목이 없습니다. 각 항목에 비어 있지 않은 "word"가 있어야 합니다.',
      );
    }
    return items;
  }

  const single = normalizeVocabularyPayload(parsed);
  if (single.word.trim()) {
    return [single];
  }

  throw new Error(
    '응답에 "words" 배열이 필요합니다. 각 원소는 word, meaning, synonyms, antonyms, example 키를 가집니다.',
  );
}
