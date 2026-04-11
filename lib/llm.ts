import OpenAI from "openai";
import type { ChatCompletion } from "openai/resources/chat/completions";
import { logOpenAiChatCompletion } from "@/lib/openaiRequestLog";
import { mergeExtraInstructionsForModel } from "@/lib/openaiInstructions";
import {
  parseVocabularyWordsFromLlmRoot,
  type VocabularyPayload,
} from "@/lib/vocabularyTypes";

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

const VISION_USER_INSTRUCTION =
  "첨부 이미지를 읽으세요. 영어 교재의 'Words To Know'처럼 번호 박스가 여러 개 있으면 각 박스를 하나의 단어 항목으로 보고, 시스템 지침대로 \"words\" 배열에 모두 담으세요. 이미지에 단어가 하나뿐이면 words 길이는 1입니다.";

function buildSystemPrompt(requestExtra?: string): string {
  const merged = mergeExtraInstructionsForModel(requestExtra);
  if (!merged) return SYSTEM_PROMPT;
  return `${SYSTEM_PROMPT}\n\n--- 추가 지침 ---\n${merged}`;
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
        { role: "system", content: buildSystemPrompt(options?.extraInstructions) },
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
    const words = parseVocabularyWordsListFromLlmContent(content);
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

  const modelFallback =
    process.env.OPENAI_VISION_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    "gpt-4o-mini";

  const detail =
    process.env.OPENAI_IMAGE_DETAIL === "low" ? ("low" as const) : ("high" as const);

  const base64 = image.toString("base64");
  const dataUrl = `data:${mt};base64,${base64}`;

  const client = new OpenAI({ apiKey });
  const temperature = 0.2;
  const t0 = Date.now();

  let completion: ChatCompletion | null = null;
  try {
    completion = await client.chat.completions.create({
      model: modelFallback,
      temperature,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildSystemPrompt(options?.extraInstructions) },
        {
          role: "user",
          content: [
            { type: "text", text: VISION_USER_INSTRUCTION },
            {
              type: "image_url",
              image_url: { url: dataUrl, detail },
            },
          ],
        },
      ],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await logOpenAiChatCompletion({
      kind: "vision",
      completion: null,
      modelFallback,
      temperature,
      durationMs: Date.now() - t0,
      success: false,
      errorMessage: msg,
      inputImageBytes: image.length,
      inputImageMime: mt,
      inputImageDetail: detail,
    });
    throw err;
  }

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    await logOpenAiChatCompletion({
      kind: "vision",
      completion,
      modelFallback,
      temperature,
      durationMs: Date.now() - t0,
      success: false,
      errorMessage: "LLM 응답이 비어 있습니다.",
      inputImageBytes: image.length,
      inputImageMime: mt,
      inputImageDetail: detail,
    });
    throw new Error("LLM 응답이 비어 있습니다.");
  }

  try {
    const words = parseVocabularyWordsListFromLlmContent(content);
    await logOpenAiChatCompletion({
      kind: "vision",
      completion,
      modelFallback,
      temperature,
      durationMs: Date.now() - t0,
      success: true,
      wordsCount: words.length,
      inputImageBytes: image.length,
      inputImageMime: mt,
      inputImageDetail: detail,
    });
    return words;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await logOpenAiChatCompletion({
      kind: "vision",
      completion,
      modelFallback,
      temperature,
      durationMs: Date.now() - t0,
      success: false,
      errorMessage: msg,
      inputImageBytes: image.length,
      inputImageMime: mt,
      inputImageDetail: detail,
    });
    throw err;
  }
}
