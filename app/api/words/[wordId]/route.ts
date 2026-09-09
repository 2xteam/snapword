import mongoose, { type HydratedDocument } from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireViewer, badRequest, notFound, serverError } from "@/lib/auth";
import { normalizeVocabularyPayload } from "@/lib/vocabularyTypes";
import { VocabularyDeck } from "@/models/VocabularyDeck";
import { Word, type WordDocument } from "@/models/Word";

export const runtime = "nodejs";

type WordHydrated = HydratedDocument<WordDocument>;

/**
 * 단어는 소유자를 직접 갖지 않는다. 부모 단어장의 `createdBy` 가 요청자인지로
 * 가른다. 남의 단어면 403 이 아니라 **404** — 있는지조차 알려주지 않는다.
 */
async function assertWordAccess(
  wordId: string,
  uid: string,
): Promise<{ ok: true; word: WordHydrated } | { ok: false; response: NextResponse }> {
  if (!mongoose.isValidObjectId(wordId)) {
    return { ok: false, response: badRequest("wordId가 필요합니다.") };
  }

  await connectDB();
  const word = await Word.findById(wordId).exec();
  if (!word) {
    return { ok: false, response: notFound("단어를 찾을 수 없습니다.") };
  }

  const deck = await VocabularyDeck.findOne({ _id: word.vocabId, createdBy: uid }).exec();
  if (!deck) {
    return { ok: false, response: notFound("단어를 찾을 수 없습니다.") };
  }

  return { ok: true, word };
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ wordId: string }> },
) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const { viewer } = auth;

    const { wordId } = await ctx.params;
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return badRequest("JSON 본문이 필요합니다.");
    }

    const access = await assertWordAccess(wordId, viewer.uid);
    if (!access.ok) return access.response;

    const n = normalizeVocabularyPayload(body);
    if (!n.word.trim()) return badRequest("word(표제어)는 필수입니다.");
    if (!n.meaning.trim()) return badRequest("meaning(설명)은 필수입니다.");

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
    return serverError(err);
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ wordId: string }> },
) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const { viewer } = auth;

    const { wordId } = await ctx.params;
    const access = await assertWordAccess(wordId, viewer.uid);
    if (!access.ok) return access.response;

    await Word.deleteOne({ _id: access.word._id }).exec();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err);
  }
}
