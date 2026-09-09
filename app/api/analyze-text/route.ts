import { NextResponse } from "next/server";
import { requireViewer, badRequest, serverError } from "@/lib/auth";
import { vocabularyFromPlainText } from "@/lib/llm";
import { normalizeRequestInstructions } from "@/lib/openaiInstructions";
import { isOpenAiApiKeyAuthError, isOpenAiKeyConfigured } from "@/lib/openaiKey";
import { requireConsents } from "@/lib/requireConsent";

export const runtime = "nodejs";
// OpenAI 응답 지연 대비 (Vercel 기본값은 플랜에 따라 10~15초)
export const maxDuration = 60;

const MAX_CHARS = 16_000;

/**
 * 사용자가 넣은 텍스트만 OpenAI로 단어 JSON 구조화.
 * (다른 앱에서 복사한 목록·문단을 붙여넣을 때 사용)
 */
export async function POST(req: Request) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const { viewer } = auth;

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

    /*
      국외 이전 동의를 **서버에서** 본다. 텍스트가 OpenAI(미국)로 나간다.
      OpenAI 에 무엇이든 보내기 전에 막아야 한다 → lib/requireConsent.ts
    */
    const consentDenied = await requireConsents(viewer.uid, ["overseas"]);
    if (consentDenied) return consentDenied;

    let body: { text?: string; instructions?: string };
    try {
      body = await req.json();
    } catch {
      return badRequest("JSON 본문이 필요합니다.");
    }

    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) return badRequest("text 필드에 내용을 넣어 주세요.");
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
    return serverError(err);
  }
}
