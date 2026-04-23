import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import {
  normalizeVocabularyPayload,
  type VocabularyPayload,
} from "@/lib/vocabularyTypes";
import { VocabularyDeck } from "@/models/VocabularyDeck";
import { Word } from "@/models/Word";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const vocabId = url.searchParams.get("vocabId") ?? "";
    if (!mongoose.isValidObjectId(vocabId)) {
      return NextResponse.json(
        { ok: false, error: "vocabId 쿼리가 필요합니다." },
        { status: 400 },
      );
    }

    await connectDB();
    const items = await Word.find({ vocabId })
      .sort({ createdAt: -1 })
      .limit(500)
      .lean()
      .exec();

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

type SaveWordBody = VocabularyPayload & { vocabId?: string; phone?: string };

function validateWordPayload(body: unknown): SaveWordBody | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  if (Array.isArray(o.words)) return null;
  const vocabId = typeof o.vocabId === "string" ? o.vocabId.trim() : "";
  const phone = typeof o.phone === "string" ? o.phone : "";
  const normalized = normalizeVocabularyPayload(body);
  if (!mongoose.isValidObjectId(vocabId) || !normalized.word.trim()) {
    return null;
  }
  return { ...normalized, vocabId, phone };
}

function validateBatchPayload(body: unknown): {
  vocabId: string;
  phone: string;
  words: VocabularyPayload[];
} | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  if (!Array.isArray(o.words)) return null;
  const vocabId = typeof o.vocabId === "string" ? o.vocabId.trim() : "";
  const phone = typeof o.phone === "string" ? o.phone : "";
  if (!mongoose.isValidObjectId(vocabId) || !phone.trim()) return null;
  const words = o.words
    .map((item) => normalizeVocabularyPayload(item))
    .filter((w) => w.word.trim().length > 0);
  if (words.length === 0) return null;
  return { vocabId, phone, words };
}

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "JSON 본문이 필요합니다." },
        { status: 400 },
      );
    }

    const batch = validateBatchPayload(body);
    if (batch) {
      const phone = normalizePhone(batch.phone);
      if (!phone) {
        return NextResponse.json(
          { ok: false, error: "phone이 필요합니다." },
          { status: 400 },
        );
      }

      await connectDB();
      const deck = await VocabularyDeck.findById(batch.vocabId).exec();
      if (!deck || deck.phone !== phone) {
        return NextResponse.json(
          { ok: false, error: "단어장을 찾을 수 없거나 phone이 일치하지 않습니다." },
          { status: 403 },
        );
      }

      const vid = new mongoose.Types.ObjectId(batch.vocabId);

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
      return NextResponse.json(
        {
          ok: false,
          error:
            "단건: vocabId, phone, word 필드. 다건: vocabId, phone, words(배열) 형식이 필요합니다.",
        },
        { status: 400 },
      );
    }

    const phone = normalizePhone(
      typeof payload.phone === "string" ? payload.phone : "",
    );
    if (!phone) {
      return NextResponse.json(
        { ok: false, error: "phone이 필요합니다." },
        { status: 400 },
      );
    }

    await connectDB();
    const deck = await VocabularyDeck.findById(payload.vocabId).exec();
    if (!deck || deck.phone !== phone) {
      return NextResponse.json(
        { ok: false, error: "단어장을 찾을 수 없거나 phone이 일치하지 않습니다." },
        { status: 403 },
      );
    }

    const vid = new mongoose.Types.ObjectId(payload.vocabId);
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
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
