import { NextResponse } from "next/server";
import { isOpenAiApiKeyAuthError, isOpenAiKeyConfigured } from "@/lib/openaiKey";
import { vocabularyFromImageBuffer } from "@/lib/llm";
import { readMultipartImage } from "@/lib/readMultipartImage";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * 이미지를 OpenAI Vision으로 보내 단어 JSON(words) 생성.
 * POST multipart/form-data, 필드 이름: file
 */
export async function POST(req: Request) {
  try {
    if (!isOpenAiKeyConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "OPENAI_API_KEY가 필요합니다. `.env.local`에 `sk-...` 키를 설정한 뒤 서버를 재시작하세요.",
        },
        { status: 503 },
      );
    }

    const parsed = await readMultipartImage(req);
    if (!parsed.ok) {
      return parsed.response;
    }

    const words = await vocabularyFromImageBuffer(
      parsed.buffer,
      parsed.mimeType,
      { extraInstructions: parsed.instructions },
    );

    return NextResponse.json({
      ok: true,
      source: "openai-vision",
      note: "OpenAI Vision으로 이미지를 읽어 words 배열을 생성했습니다.",
      words,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";

    if (isOpenAiApiKeyAuthError(err)) {
      return NextResponse.json(
        { ok: false, error: "OpenAI API 키가 거부되었습니다. 키를 확인하세요." },
        { status: 401 },
      );
    }

    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
