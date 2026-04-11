import { NextResponse } from "next/server";
import { vocabularyFromPlainText } from "@/lib/llm";
import { normalizeRequestInstructions } from "@/lib/openaiInstructions";
import { isOpenAiApiKeyAuthError, isOpenAiKeyConfigured } from "@/lib/openaiKey";

export const runtime = "nodejs";

const MAX_CHARS = 16_000;

/**
 * 사용자가 넣은 텍스트만 OpenAI로 단어 JSON 구조화.
 * (다른 앱에서 복사한 목록·문단을 붙여넣을 때 사용)
 */
export async function POST(req: Request) {
  try {
    if (!isOpenAiKeyConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "이 API는 OpenAI 키가 필요합니다. `.env.local`의 `OPENAI_API_KEY`를 설정하세요.",
        },
        { status: 503 },
      );
    }

    let body: { text?: string; instructions?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "JSON 본문이 필요합니다." },
        { status: 400 },
      );
    }

    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      return NextResponse.json(
        { ok: false, error: "text 필드에 내용을 넣어 주세요." },
        { status: 400 },
      );
    }
    if (text.length > MAX_CHARS) {
      return NextResponse.json(
        { ok: false, error: `text는 최대 ${MAX_CHARS}자까지 지원합니다.` },
        { status: 413 },
      );
    }

    const extra = normalizeRequestInstructions(body.instructions);

    try {
      const words = await vocabularyFromPlainText(text, {
        extraInstructions: extra,
      });
      return NextResponse.json({ ok: true, words, source: "plain-text" });
    } catch (llmErr) {
      const message =
        llmErr instanceof Error ? llmErr.message : "LLM 처리 중 오류가 발생했습니다.";
      if (isOpenAiApiKeyAuthError(llmErr)) {
        return NextResponse.json(
          { ok: false, error: "OpenAI API 키가 거부되었습니다. 키를 확인하세요." },
          { status: 401 },
        );
      }
      return NextResponse.json({ ok: false, error: message }, { status: 502 });
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
