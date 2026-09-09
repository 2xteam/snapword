import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireViewer, badRequest, notFound, serverError } from "@/lib/auth";
import {
  normalizeVocabularyPayload,
  type VocabularyPayload,
} from "@/lib/vocabularyTypes";
import { VocabularyDeck } from "@/models/VocabularyDeck";
import { Word } from "@/models/Word";

export const runtime = "nodejs";

/*
  단어는 소유자를 직접 갖지 않는다. 부모 단어장의 `createdBy` 가 `viewer.uid` 인지로
  가른다. 본문의 `phone` 은 옛 화면이 아직 보내지만 읽지 않는다 → lib/auth.ts
*/

/** 내 단어장인지 확인한다. 남의 것이거나 없으면 null */
async function findOwnedDeck(vocabId: string, uid: string) {
  return VocabularyDeck.findOne({ _id: vocabId, createdBy: uid }).exec();
}

export async function GET(req: Request) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const { viewer } = auth;

    const url = new URL(req.url);
    const vocabId = url.searchParams.get("vocabId") ?? "";
    if (!mongoose.isValidObjectId(vocabId)) return badRequest("vocabId 쿼리가 필요합니다.");

    await connectDB();
    const deck = await findOwnedDeck(vocabId, viewer.uid);
    if (!deck) return notFound("단어장을 찾을 수 없습니다.");

    const items = await Word.find({ vocabId: deck._id })
      .sort({ createdAt: -1 })
      .limit(500)
      .lean()
      .exec();

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    return serverError(err);
  }
}

type SaveWordBody = VocabularyPayload & { vocabId: string };

function validateWordPayload(body: unknown): SaveWordBody | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  if (Array.isArray(o.words)) return null;
  const vocabId = typeof o.vocabId === "string" ? o.vocabId.trim() : "";
  const normalized = normalizeVocabularyPayload(body);
  if (!mongoose.isValidObjectId(vocabId) || !normalized.word.trim()) {
    return null;
  }
  return { ...normalized, vocabId };
}

function validateBatchPayload(body: unknown): {
  vocabId: string;
  words: VocabularyPayload[];
} | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  if (!Array.isArray(o.words)) return null;
  const vocabId = typeof o.vocabId === "string" ? o.vocabId.trim() : "";
  if (!mongoose.isValidObjectId(vocabId)) return null;
  const words = o.words
    .map((item) => normalizeVocabularyPayload(item))
    .filter((w) => w.word.trim().length > 0);
  if (words.length === 0) return null;
  return { vocabId, words };
}

export async function POST(req: Request) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const { viewer } = auth;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return badRequest("JSON 본문이 필요합니다.");
    }

    const batch = validateBatchPayload(body);
    if (batch) {
      await connectDB();
      const deck = await findOwnedDeck(batch.vocabId, viewer.uid);
      if (!deck) return notFound("단어장을 찾을 수 없습니다.");

      const vid = deck._id;

      const existingWords = await Word.find({ vocabId: vid })
        .select("word")
        .lean()
        .exec();
      const existingSet = new Set(
        existingWords.map((w) => (w.word as string).trim().toLowerCase()),
      );

      const ids: string[] = [];
      const skipped: string[] = [];
      for (const w of batch.words) {
        const trimmed = w.word.trim();
        if (existingSet.has(trimmed.toLowerCase())) {
          skipped.push(trimmed);
          continue;
        }
        const doc = await Word.create({
          vocabId: vid,
          word: trimmed,
          meaning: w.meaning,
          example: w.example,
          synonyms: w.synonyms,
          antonyms: w.antonyms,
        });
        ids.push(String(doc._id));
        existingSet.add(trimmed.toLowerCase());
      }

      return NextResponse.json({ ok: true, ids, count: ids.length, skipped });
    }

    const payload = validateWordPayload(body);
    if (!payload) {
      return badRequest(
        "단건: vocabId, word 필드. 다건: vocabId, words(배열) 형식이 필요합니다.",
      );
    }

    await connectDB();
    const deck = await findOwnedDeck(payload.vocabId, viewer.uid);
    if (!deck) return notFound("단어장을 찾을 수 없습니다.");

    const vid = deck._id;
    const trimmedWord = payload.word.trim();

    const duplicate = await Word.findOne({
      vocabId: vid,
      word: { $regex: new RegExp(`^${trimmedWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
    })
      .lean()
      .exec();

    if (duplicate) {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        message: `"${trimmedWord}" 단어가 이미 단어장에 존재합니다.`,
      });
    }

    const doc = await Word.create({
      vocabId: vid,
      word: trimmedWord,
      meaning: payload.meaning,
      example: payload.example,
      synonyms: payload.synonyms,
      antonyms: payload.antonyms,
    });

    return NextResponse.json({ ok: true, id: String(doc._id) });
  } catch (err) {
    return serverError(err);
  }
}
