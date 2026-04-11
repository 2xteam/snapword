import mongoose, { type HydratedDocument } from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { normalizeVocabularyPayload } from "@/lib/vocabularyTypes";
import { VocabularyDeck } from "@/models/VocabularyDeck";
import { Word, type WordDocument } from "@/models/Word";

export const runtime = "nodejs";

type WordHydrated = HydratedDocument<WordDocument>;

async function assertWordAccess(
  wordId: string,
  phone: string,
): Promise<{ ok: true; word: WordHydrated } | { ok: false; response: NextResponse }> {
  const p = normalizePhone(phone);
  if (!mongoose.isValidObjectId(wordId) || !p) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "wordId, phone이 필요합니다." },
        { status: 400 },
      ),
    };
  }

  await connectDB();
  const word = await Word.findById(wordId).exec();
  if (!word) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "단어를 찾을 수 없습니다." }, { status: 404 }),
    };
  }

  const deck = await VocabularyDeck.findById(word.vocabId).exec();
  if (!deck || deck.phone !== p) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "권한이 없습니다." }, { status: 403 }),
    };
  }

  return { ok: true, word };
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ wordId: string }> },
) {
  try {
    const { wordId } = await ctx.params;
    let body: { phone?: string } & Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "JSON 본문이 필요합니다." },
        { status: 400 },
      );
    }

    const phone = typeof body.phone === "string" ? body.phone : "";
    const access = await assertWordAccess(wordId, phone);
    if (!access.ok) return access.response;

    const n = normalizeVocabularyPayload(body);
    if (!n.word.trim()) {
      return NextResponse.json(
        { ok: false, error: "word(표제어)는 필수입니다." },
        { status: 400 },
      );
    }
    if (!n.meaning.trim()) {
      return NextResponse.json(
        { ok: false, error: "meaning(설명)은 필수입니다." },
        { status: 400 },
      );
    }

    access.word.set({
      word: n.word.trim(),
      meaning: n.meaning,
      example: n.example,
      synonyms: n.synonyms,
      antonyms: n.antonyms,
    });
    await access.word.save();

    return NextResponse.json({ ok: true, id: wordId });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ wordId: string }> },
) {
  try {
    const { wordId } = await ctx.params;
    const url = new URL(req.url);
    const phone = url.searchParams.get("phone") ?? "";

    const access = await assertWordAccess(wordId, phone);
    if (!access.ok) return access.response;

    await Word.deleteOne({ _id: access.word._id }).exec();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
