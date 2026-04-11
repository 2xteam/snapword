import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { StudyRecord } from "@/models/StudyRecord";
import { User } from "@/models/User";
import { VocabularyDeck } from "@/models/VocabularyDeck";
import { Word } from "@/models/Word";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    let body: {
      phone?: string;
      userId?: string;
      wordId?: string;
      outcome?: "correct" | "wrong";
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "JSON 본문이 필요합니다." },
        { status: 400 },
      );
    }

    const phone = normalizePhone(typeof body.phone === "string" ? body.phone : "");
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const wordId = typeof body.wordId === "string" ? body.wordId.trim() : "";
    const outcome = body.outcome;

    if (!phone || !mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(wordId)) {
      return NextResponse.json(
        { ok: false, error: "phone, userId, wordId가 필요합니다." },
        { status: 400 },
      );
    }

    if (outcome !== "correct" && outcome !== "wrong") {
      return NextResponse.json(
        { ok: false, error: "outcome은 correct 또는 wrong 이어야 합니다." },
        { status: 400 },
      );
    }

    await connectDB();
    const user = await User.findById(userId).exec();
    if (!user || user.phone !== phone) {
      return NextResponse.json({ ok: false, error: "권한이 없습니다." }, { status: 403 });
    }

    const word = await Word.findById(wordId).exec();
    if (!word) {
      return NextResponse.json({ ok: false, error: "단어를 찾을 수 없습니다." }, { status: 404 });
    }

    const deck = await VocabularyDeck.findById(word.vocabId).exec();
    if (!deck || deck.phone !== phone) {
      return NextResponse.json({ ok: false, error: "권한이 없습니다." }, { status: 403 });
    }

    const uid = new mongoose.Types.ObjectId(userId);
    const wid = new mongoose.Types.ObjectId(wordId);
    const now = new Date();
    const inc =
      outcome === "correct"
        ? { $inc: { correctCount: 1 }, $set: { lastStudiedAt: now } }
        : { $inc: { wrongCount: 1 }, $set: { lastStudiedAt: now } };

    const doc = await StudyRecord.findOneAndUpdate(
      { userId: uid, wordId: wid },
      {
        ...inc,
        $setOnInsert: { userId: uid, wordId: wid },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    ).exec();

    return NextResponse.json({
      ok: true,
      correctCount: doc?.correctCount ?? 0,
      wrongCount: doc?.wrongCount ?? 0,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId") ?? "";
    const vocabId = url.searchParams.get("vocabId") ?? "";

    if (!mongoose.isValidObjectId(userId)) {
      return NextResponse.json(
        { ok: false, error: "userId 쿼리가 필요합니다." },
        { status: 400 },
      );
    }

    await connectDB();
    if (mongoose.isValidObjectId(vocabId)) {
      const wordIds = await Word.find({
        vocabId: new mongoose.Types.ObjectId(vocabId),
      })
        .select("_id")
        .lean()
        .exec();
      const ids = wordIds.map((w) => w._id);
      const items = await StudyRecord.find({
        userId: new mongoose.Types.ObjectId(userId),
        wordId: { $in: ids },
      })
        .lean()
        .exec();
      return NextResponse.json({ ok: true, items });
    }

    const items = await StudyRecord.find({ userId: new mongoose.Types.ObjectId(userId) })
      .limit(2000)
      .lean()
      .exec();
    return NextResponse.json({ ok: true, items });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
