export type TestClueType = "meaning" | "example" | "synonym" | "antonym";

export type WordForMcq = {
  _id: string;
  word: string;
  meaning: string;
  example: string;
  synonyms: string[];
  antonyms: string[];
};

/** API / DB lean 문서를 MCQ용 형태로 맞춥니다. */
export function normalizeWordFromApi(raw: unknown): WordForMcq {
  if (!raw || typeof raw !== "object") {
    return { _id: "", word: "", meaning: "", example: "", synonyms: [], antonyms: [] };
  }
  const it = raw as Record<string, unknown>;
  const syn = Array.isArray(it.synonyms)
    ? it.synonyms.filter((x): x is string => typeof x === "string")
    : [];
  const ant = Array.isArray(it.antonyms)
    ? it.antonyms.filter((x): x is string => typeof x === "string")
    : [];
  return {
    _id: String(it._id),
    word: typeof it.word === "string" ? it.word : "",
    meaning: typeof it.meaning === "string" ? it.meaning : "",
    example: typeof it.example === "string" ? it.example : "",
    synonyms: syn,
    antonyms: ant,
  };
}

export type McqQuestion = {
  wordId: string;
  answer: string;
  type: TestClueType;
  clue: string;
  options: string[];
};

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clueForType(w: WordForMcq, type: TestClueType): string {
  if (type === "meaning") return w.meaning;
  if (type === "example") return w.example;
  if (type === "synonym") return w.synonyms.join(", ");
  return w.antonyms.join(", ");
}

/** 한 단어에 대해 Test와 동일한 5지선다 한 문항 생성. `pool`에서 오답 보기를 뽑습니다. */
export function buildOneMcq(w: WordForMcq, pool: WordForMcq[]): McqQuestion | null {
  if (!w.word.trim()) return null;

  const types: TestClueType[] = [];
  if (w.meaning.trim()) types.push("meaning");
  if (w.example.trim()) types.push("example");
  if (w.synonyms.length) types.push("synonym");
  if (w.antonyms.length) types.push("antonym");
  if (types.length === 0) return null;

  const type = types[Math.floor(Math.random() * types.length)]!;
  const clue = clueForType(w, type);

  const list = pool.filter((x) => x.word.trim());
  const others = list.filter((x) => x._id !== w._id).map((x) => x.word);
  const distractors = shuffle(others).slice(0, 4);
  while (distractors.length < 4 && others.length > 0) {
    const o = others[Math.floor(Math.random() * others.length)]!;
    if (!distractors.includes(o) && o !== w.word) distractors.push(o);
    if (distractors.length >= 4) break;
  }
  const options = shuffle([w.word, ...distractors]).slice(0, 5);
  while (options.length < 5) options.push("(보기)");

  return { wordId: w._id, answer: w.word, type, clue, options };
}

/** Test 화면: 단어장 전체로 문항 셔플 */
export function buildMcqQuestionsFromPool(pool: WordForMcq[]): McqQuestion[] {
  const list = pool.filter((w) => w.word.trim());
  if (list.length === 0) return [];
  const qs: McqQuestion[] = [];
  for (const w of list) {
    const q = buildOneMcq(w, list);
    if (q) qs.push(q);
  }
  return shuffle(qs);
}

/** 인쇄: 선택한 단어만 순서 유지, 보기 풀은 전체 로드된 단어 목록 */
export function buildMcqQuestionsForPrint(
  targets: WordForMcq[],
  distractorPool: WordForMcq[],
): McqQuestion[] {
  const pool = distractorPool.filter((w) => w.word.trim());
  const qs: McqQuestion[] = [];
  for (const w of targets) {
    const q = buildOneMcq(w, pool.length > 0 ? pool : [w]);
    if (q) qs.push(q);
  }
  return qs;
}

export function clueTypeLabelKo(type: TestClueType): string {
  switch (type) {
    case "meaning":
      return "설명";
    case "example":
      return "예문";
    case "synonym":
      return "동의어";
    case "antonym":
      return "반의어";
    default:
      return type;
  }
}
