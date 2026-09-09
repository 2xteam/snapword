import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireViewer, badRequest } from "@/lib/auth";
import { normalizeAiCacheKey } from "@/lib/aiCacheKey";
import { AiCache } from "@/models/AiCache";

export const runtime = "nodejs";

/*
  단어별 AI 답변 캐시. 사용자별 데이터가 아니라 **모두가 공유**하므로 소유자
  필터는 없다. 대신 로그인은 요구한다 — 특히 POST 는 누구나 답을 덧씌울 수
  있는 쓰기라 익명으로 열어 둘 수 없다.
*/

export async function GET(req: Request) {
  const auth = await requireViewer(req);
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("word");
  if (!raw) return badRequest("word required");

  const word = normalizeAiCacheKey(raw);
  if (!word) return badRequest("word required");

  await connectDB();
  const cached = await AiCache.findOne({ word }).lean();
  if (cached) {
    return NextResponse.json({ ok: true, hit: true, answer: cached.answer });
  }
  return NextResponse.json({ ok: true, hit: false });
}

export async function POST(req: Request) {
  const auth = await requireViewer(req);
  if ("error" in auth) return auth.error;

  const body = (await req.json()) as {
    word?: string;
    kind?: string;
    prompt?: string;
    answer?: string;
  };
  if (!body.word || !body.answer) return badRequest("word and answer required");

  const word = normalizeAiCacheKey(body.word);
  if (!word) return badRequest("word required");

  await connectDB();
  await AiCache.updateOne(
    { word },
    {
      $set: {
        kind: body.kind ?? "wotd",
        prompt: body.prompt ?? "",
        answer: body.answer,
        createdAt: new Date(),
      },
    },
    { upsert: true },
  );
  return NextResponse.json({ ok: true });
}
