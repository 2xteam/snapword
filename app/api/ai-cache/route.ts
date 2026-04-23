import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { normalizeAiCacheKey } from "@/lib/aiCacheKey";
import { AiCache } from "@/models/AiCache";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("word");
  if (!raw) {
    return NextResponse.json({ ok: false, error: "word required" }, { status: 400 });
  }

  const word = normalizeAiCacheKey(raw);
  if (!word) {
    return NextResponse.json({ ok: false, error: "word required" }, { status: 400 });
  }

  await connectDB();
  const cached = await AiCache.findOne({ word }).lean();
  if (cached) {
    return NextResponse.json({ ok: true, hit: true, answer: cached.answer });
  }
  return NextResponse.json({ ok: true, hit: false });
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    word?: string;
    kind?: string;
    prompt?: string;
    answer?: string;
  };
  if (!body.word || !body.answer) {
    return NextResponse.json({ ok: false, error: "word and answer required" }, { status: 400 });
  }

  const word = normalizeAiCacheKey(body.word);
  if (!word) {
    return NextResponse.json({ ok: false, error: "word required" }, { status: 400 });
  }

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
