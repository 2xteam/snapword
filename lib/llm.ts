import OpenAI from "openai";
import type { ChatCompletion, ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { logOpenAiChatCompletion } from "@/lib/openaiRequestLog";
import { mergeExtraInstructionsForModel } from "@/lib/openaiInstructions";
import {
  parseVocabularyWordsFromLlmRoot,
  type VocabularyPayload,
} from "@/lib/vocabularyTypes";
import { DEFAULT_STUDY_LANGUAGE, type StudyLanguage } from "@/lib/studyLanguage";

const SYSTEM_PROMPT = `당신은 단어장·어휘 자료를 JSON으로 변환합니다. 항상 루트 객체 하나만 출력합니다.

출력 형식(반드시 이 키들만 루트에 사용):
{ "words": [ { "word", "meaning", "synonyms", "antonyms", "example" }, ... ] }

규칙:
- 마크다운, 코드 펜스(\`\`\`), 설명 문장 없이 JSON 한 덩어리만 출력합니다.
- "words"는 배열이며, 자료에 보이는 **모든** 단어 항목을 빠짐없이 넣습니다. 한 개만 있어도 길이 1 배열입니다.
- 각 원소의 키 이름은 정확히: word, meaning, synonyms, antonyms, example (철자·대소문자 동일).
- synonyms, antonyms는 문자열 배열입니다. 없으면 [].
- word: 표제어(기준 단어). 번호(1. 2.)나 품사 표기는 word에 넣지 말고 제목 단어만 넣습니다.
- meaning: 품사((n.)(v.)(adj.) 등)와 정의를 한 문자열에 담아도 됩니다. 자료가 영어 교재면 정의는 영어로 유지해도 되고, 한글로 풀어 적어도 됩니다.
- example: 교재에 나온 예문을 그대로 또는 핵심만 인용합니다. 없으면 "".
- 교재 박스가 여러 칼럼(왼쪽/오른쪽)이면 **위→아래, 왼쪽 칼럼 먼저 이어서 오른쪽 칼럼** 순으로 읽어 words 순서를 맞춥니다.
- 동의어·반의어가 이탤릭/작은 글씨로 따로 있으면 synonyms·antonyms에 넣고, meaning과 중복되면 정리해도 됩니다.
- 형광펜·밑줄·손글씨 등은 가능하면 반영하되, 인쇄·촬영 잡기호로 보이는 노이즈는 무시합니다.`;

/*
  한자 단어장. 출력 키는 영어와 같다 — 저장·학습·시험·인쇄를 그대로 쓰기 위해서다.
  훈·음은 따로 칸을 두지 않고 meaning 맨 앞에 넣는다.

  2026-09-30 실측: 부수 214자 표(8행 × 9열, 한 장 67자)에서 gpt-4o-mini 가
  10~35개만 뽑고, 표에 없는 글자("붉을 적 — 붉다")를 지어냈다. 그래서
  ① 칸 아래 **인쇄된 훈음을 기준**으로 읽게 하고 ② 인쇄되지 않은 뜻을 덧붙이지 못하게 하고
  ③ 칸 수(`cellCount`)를 먼저 세게 해서 모자라면 이어 받는다 → vocabularyFromImageBuffer
*/
const HANJA_RULES = `이 자료는 **한자(漢字)** 학습 자료입니다. 위 규칙보다 아래 규칙을 우선합니다.

[가장 중요한 원칙 — 옮겨 적기만 한다]
- 이미지에 **인쇄된 글자만** 옮깁니다. 이미지에 없는 한자·훈음·뜻을 지어내거나 기억으로 채우지 않습니다.
- 흐리거나 확실하지 않은 칸은 추측하지 말고 그 칸의 인쇄된 훈음을 기준으로 판단합니다. 훈음도 읽을 수 없으면 그 칸은 건너뜁니다.
- 부수처럼 획이 적은 글자(丶 丿 亅 亠 冖 冫 등)도 한 칸이면 한 항목입니다. 비슷한 다른 글자로 바꾸지 않습니다.

[표·격자 읽는 법]
- 한자 칸이 격자로 늘어서 있으면 **위 행부터, 각 행은 왼쪽에서 오른쪽으로** 한 칸씩 빠짐없이 읽습니다.
- 각 칸은 "큰 한자 + 그 아래(또는 옆) 인쇄된 훈음" 한 쌍입니다. 한자와 훈음을 **같은 칸끼리** 짝짓습니다.
- "1주차", "2단원", 번호, 제목, 이름 칸처럼 한자 학습 항목이 아닌 칸은 넣지 않습니다.

[각 필드]
- word: 칸의 한자만. 낱글자(學)든 한자어(學校)든 한자로 적고, 한글 독음·번호·급수 표기는 넣지 않습니다.
- meaning: 인쇄된 훈·음을 **그대로** 적습니다. 예: "한 일", "사람 인", "돼지해머리".
  자료에 뜻 설명이 따로 **인쇄되어 있을 때만** " — " 뒤에 그 설명을 덧붙입니다. 인쇄되지 않은 뜻은 붙이지 않습니다.
  자료에 부수·획수·급수가 인쇄되어 있으면 괄호로 덧붙입니다. 예: "배울 학 (부수 子, 16획)".
- example: 자료에 인쇄된 한자어 예시·예문만 한자(독음) 형태로. 없으면 "".
- synonyms, antonyms: 자료에 인쇄된 유의자·반의자만 한자로. 없으면 [].
- 한글·영어로만 된 항목은 한자 단어가 아니므로 넣지 않습니다.

[개수 세기]
- 루트에 "cellCount" 를 함께 적습니다: 이미지에 있는 **한자 학습 칸의 총 개수**(주차·제목 칸 제외).
- words 에는 그 칸을 **모두** 담습니다. 개수가 많아도 중간에 멈추지 않습니다.
- 출력 형태: { "cellCount": 67, "words": [ { "word": "一", "meaning": "한 일", "synonyms": [], "antonyms": [], "example": "" }, ... ] }`;

const VISION_USER_INSTRUCTION: Record<StudyLanguage, string> = {
  en: "첨부 이미지를 읽으세요. 영어 교재의 'Words To Know'처럼 번호 박스가 여러 개 있으면 각 박스를 하나의 단어 항목으로 보고, 시스템 지침대로 \"words\" 배열에 모두 담으세요. 이미지에 단어가 하나뿐이면 words 길이는 1입니다.",
  hanja:
    "첨부 이미지를 읽으세요. 먼저 한자 학습 칸이 모두 몇 개인지 세어 cellCount 에 적고, 위 행부터 왼쪽→오른쪽 순서로 **모든 칸**의 한자와 그 칸에 인쇄된 훈음을 words 배열에 담으세요. 이미지에 없는 한자는 절대 넣지 마세요.",
};

function buildSystemPrompt(
  requestExtra?: string,
  language: StudyLanguage = DEFAULT_STUDY_LANGUAGE,
): string {
  const base =
    language === "hanja"
      ? `${SYSTEM_PROMPT}\n\n--- 한자 단어장 ---\n${HANJA_RULES}`
      : SYSTEM_PROMPT;
  const merged = mergeExtraInstructionsForModel(requestExtra);
  if (!merged) return base;
  return `${base}\n\n--- 추가 지침 ---\n${merged}`;
}

function extractJsonObjectString(raw: string): string | null {
  const trimmed = raw.trim();
  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence?.[1]) {
      const inner = fence[1].trim();
      if (inner.startsWith("{")) return inner;
    }
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      return trimmed.slice(start, end + 1);
    }
    return null;
  }
}

/** Chat Completions message.content → 단어 객체 배열 */
export function parseVocabularyWordsListFromLlmContent(
  content: string,
): VocabularyPayload[] {
  const jsonString = extractJsonObjectString(content);
  if (!jsonString) {
    throw new Error("LLM 응답에서 JSON 객체를 찾지 못했습니다.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error("LLM JSON 파싱에 실패했습니다.");
  }

  return parseVocabularyWordsFromLlmRoot(parsed);
}

export type VocabularyLlmOptions = {
  /** 요청별 추가 지침(API `instructions` 등). 환경 변수 지침과 합쳐집니다. */
  extraInstructions?: string;
  /** 단어장의 학습 언어. 없으면 영어 → lib/studyLanguage.ts */
  language?: StudyLanguage;
};

/** 붙여넣은 등의 평문 텍스트를 OpenAI로만 구조화합니다. */
export async function vocabularyFromPlainText(
  text: string,
  options?: VocabularyLlmOptions,
): Promise<VocabularyPayload[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.");
  }

  const modelFallback = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const temperature = 0.2;
  const client = new OpenAI({ apiKey });
  const t0 = Date.now();

  let completion: ChatCompletion | null = null;
  try {
    completion = await client.chat.completions.create({
      model: modelFallback,
      temperature,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildSystemPrompt(options?.extraInstructions, options?.language) },
        {
          role: "user",
          content: `다음은 사용자가 제공한 텍스트입니다. 보이는 모든 단어 항목을 "words" 배열에 담아 JSON만 반환하세요.\n\n---\n${text}\n---`,
        },
      ],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await logOpenAiChatCompletion({
      kind: "plain_text",
      completion: null,
      modelFallback,
      temperature,
      durationMs: Date.now() - t0,
      success: false,
      errorMessage: msg,
      inputTextCharCount: text.length,
    });
    throw err;
  }

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    await logOpenAiChatCompletion({
      kind: "plain_text",
      completion,
      modelFallback,
      temperature,
      durationMs: Date.now() - t0,
      success: false,
      errorMessage: "LLM 응답이 비어 있습니다.",
      inputTextCharCount: text.length,
    });
    throw new Error("LLM 응답이 비어 있습니다.");
  }

  try {
    const parsed = parseVocabularyWordsListFromLlmContent(content);
    // 한자 단어장은 한자만 단어로 남긴다 → keepHanjaWordsOnly
    const words = options?.language === "hanja" ? keepHanjaWordsOnly(parsed) : parsed;
    await logOpenAiChatCompletion({
      kind: "plain_text",
      completion,
      modelFallback,
      temperature,
      durationMs: Date.now() - t0,
      success: true,
      wordsCount: words.length,
      inputTextCharCount: text.length,
    });
    return words;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await logOpenAiChatCompletion({
      kind: "plain_text",
      completion,
      modelFallback,
      temperature,
      durationMs: Date.now() - t0,
      success: false,
      errorMessage: msg,
      inputTextCharCount: text.length,
    });
    throw err;
  }
}

const ALLOWED_VISION_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
]);

/** 한자 단어장 추출에 쓰는 모델. 작은 모델은 촘촘한 표에서 칸을 빠뜨리고 글자를 지어낸다 */
function hanjaVisionModel(): string {
  return (
    process.env.OPENAI_VISION_MODEL_HANJA?.trim() ||
    process.env.OPENAI_VISION_MODEL?.trim() ||
    "gpt-4o"
  );
}

/** 모자란 칸을 이어 받는 최대 추가 요청 수 — 비용 상한 */
const HANJA_MAX_CONTINUATIONS = 2;

const HAN_CHAR_RE = /\p{Script=Han}/gu;

/**
 * 한자 단어장은 **한자만** 단어로 남긴다.
 * word 에 섞인 한글·영문·숫자·괄호를 걷어내고, 한자가 하나도 없으면 버린다
 * ("1주차" 같은 칸, "一 (한 일)" → "一"). 같은 한자는 한 번만.
 */
export function keepHanjaWordsOnly(words: VocabularyPayload[]): VocabularyPayload[] {
  const seen = new Set<string>();
  const out: VocabularyPayload[] = [];
  for (const w of words) {
    const han = (w.word.match(HAN_CHAR_RE) ?? []).join("");
    if (!han || seen.has(han)) continue;
    seen.add(han);
    out.push({ ...w, word: han });
  }
  return out;
}

/** 루트의 cellCount — 모델이 센 한자 칸 수. 없거나 이상하면 null */
function readCellCount(content: string): number | null {
  const json = extractJsonObjectString(content);
  if (!json) return null;
  try {
    const n = (JSON.parse(json) as { cellCount?: unknown }).cellCount;
    return typeof n === "number" && Number.isFinite(n) && n > 0 && n < 1000 ? Math.floor(n) : null;
  } catch {
    return null;
  }
}

/** 이미지를 OpenAI Vision에 보내 단어 JSON 배열을 만듭니다. */
export async function vocabularyFromImageBuffer(
  image: Buffer,
  mimeType: string,
  options?: VocabularyLlmOptions,
): Promise<VocabularyPayload[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.");
  }

  const mt = mimeType.toLowerCase().split(";")[0].trim();
  if (!ALLOWED_VISION_MIME.has(mt)) {
    throw new Error(
      `지원 이미지: jpeg, png, gif, webp 입니다. (받음: ${mimeType || "없음"})`,
    );
  }

  const language = options?.language ?? DEFAULT_STUDY_LANGUAGE;
  const hanja = language === "hanja";

  const modelFallback = hanja
    ? hanjaVisionModel()
    : process.env.OPENAI_VISION_MODEL?.trim() ||
      process.env.OPENAI_MODEL?.trim() ||
      "gpt-4o-mini";

  const detail =
    process.env.OPENAI_IMAGE_DETAIL === "low" ? ("low" as const) : ("high" as const);

  const base64 = image.toString("base64");
  const dataUrl = `data:${mt};base64,${base64}`;

  const client = new OpenAI({ apiKey });
  // 옮겨 적는 일이라 한자는 창의성을 끈다 → 볼트 30-Patterns/OpenAI Vision 추출 패턴.md
  const temperature = hanja ? 0 : 0.2;

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt(options?.extraInstructions, language) },
    {
      role: "user",
      content: [
        { type: "text", text: VISION_USER_INSTRUCTION[language] },
        { type: "image_url", image_url: { url: dataUrl, detail } },
      ],
    },
  ];

  const logBase = {
    kind: "vision" as const,
    modelFallback,
    temperature,
    inputImageBytes: image.length,
    inputImageMime: mt,
    inputImageDetail: detail,
  };

  /** 한 번 부르고 로그를 남긴다. 실패는 그대로 던진다 */
  const callOnce = async (): Promise<{ content: string; words: VocabularyPayload[] }> => {
    const t0 = Date.now();
    let completion: ChatCompletion | null = null;
    try {
      completion = await client.chat.completions.create({
        model: modelFallback,
        temperature,
        response_format: { type: "json_object" },
        // 67칸 표도 한 번에 담기게 넉넉히 — 잘리면 JSON 이 깨진다
        ...(hanja ? { max_tokens: 8000 } : {}),
        messages,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await logOpenAiChatCompletion({ ...logBase, completion: null, durationMs: Date.now() - t0, success: false, errorMessage: msg });
      throw err;
    }

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      await logOpenAiChatCompletion({ ...logBase, completion, durationMs: Date.now() - t0, success: false, errorMessage: "LLM 응답이 비어 있습니다." });
      throw new Error("LLM 응답이 비어 있습니다.");
    }

    try {
      const words = parseVocabularyWordsListFromLlmContent(content);
      await logOpenAiChatCompletion({ ...logBase, completion, durationMs: Date.now() - t0, success: true, wordsCount: words.length });
      return { content, words };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await logOpenAiChatCompletion({ ...logBase, completion, durationMs: Date.now() - t0, success: false, errorMessage: msg });
      throw err;
    }
  };

  const first = await callOnce();
  if (!hanja) return first.words;

  /*
    한자: 모델이 센 칸 수보다 적게 담았으면 **나머지를 이어서** 받는다.
    같은 대화에 앞 답을 넣고 "이미 적은 글자 다음부터" 를 청한다. 합친 뒤 한자만 남기고 중복을 뺀다.
    이어 받기가 실패해도 이미 받은 것은 돌려준다.
  */
  let collected = keepHanjaWordsOnly(first.words);
  const expected = readCellCount(first.content);
  let lastContent = first.content;

  for (let round = 0; round < HANJA_MAX_CONTINUATIONS; round++) {
    if (!expected || collected.length >= expected) break;
    messages.push({ role: "assistant", content: lastContent });
    messages.push({
      role: "user",
      content:
        `cellCount 는 ${expected}칸인데 words 에는 ${collected.length}개만 있습니다. ` +
        `이미 적은 한자: ${collected.map((w) => w.word).join(" ")}
` +
        `같은 이미지에서 **아직 적지 않은 칸만** 같은 순서(위 행부터, 왼쪽→오른쪽)로 이어서 담으세요. ` +
        `이미 적은 한자는 다시 넣지 말고, 이미지에 없는 한자는 절대 넣지 마세요. ` +
        `남은 칸이 없으면 words 를 빈 배열로 두세요. 형식은 같습니다: { "cellCount": ${expected}, "words": [...] }`,
    });
    let next: { content: string; words: VocabularyPayload[] };
    try {
      next = await callOnce();
    } catch {
      break; // 빈 배열도 여기로 온다(parse 가 빈 words 를 오류로 본다)
    }
    const before = collected.length;
    collected = keepHanjaWordsOnly([...collected, ...next.words]);
    lastContent = next.content;
    if (collected.length === before) break; // 더 나올 것이 없다
  }

  if (collected.length === 0) {
    throw new Error("이미지에서 한자를 찾지 못했습니다. 한자가 크게 나오도록 다시 찍어 주세요.");
  }
  return collected;
}
