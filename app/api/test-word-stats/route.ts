import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { TestResult } from "@/models/TestResult";
import { TestSession } from "@/models/TestSession";
import { User } from "@/models/User";
import { VocabularyDeck } from "@/models/VocabularyDeck";

export const runtime = "nodejs";

/**
 * 단어장(vocab) 단위로 테스트 응시 횟수·오답 수 집계 (단어별).
 * 쿼리: phone, userId, vocabIds (쉼표 구분 ObjectId)
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const phone = normalizePhone(url.searchParams.get("phone") ?? "");
    const userId = url.searchParams.get("userId") ?? "";
    const vocabIdsRaw = url.searchParams.get("vocabIds") ?? "";

    if (!phone || !mongoose.isValidObjectId(userId)) {
      return NextResponse.json(
        { ok: false, error: "phone, userId가 필요합니다." },
        { status: 400 },
      );
    }

    const vocabIds = vocabIdsRaw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => mongoose.isValidObjectId(s))
      .map((s) => new mongoose.Types.ObjectId(s));

    if (vocabIds.length === 0) {
      return NextResponse.json({ ok: true, byWord: [] });
    }

    await connectDB();
    const user = await User.findById(userId).exec();
    if (!user || user.phone !== phone) {
      return NextResponse.json({ ok: false, error: "권한이 없습니다." }, { status: 403 });
    }

    for (const vid of vocabIds) {
      const deck = await VocabularyDeck.findById(vid).exec();
      if (!deck || deck.phone !== phone) {
        return NextResponse.json(
          { ok: false, error: "단어장 권한이 없습니다." },
          { status: 403 },
        );
      }
    }

    const sessions = await TestSession.find({
      userId: new mongoose.Types.ObjectId(userId),
      vocabId: { $in: vocabIds },
    })
      .select("_id")
      .lean()
      .exec();

    const sessionIds = sessions.map((s) => s._id);
    if (sessionIds.length === 0) {
      return NextResponse.json({ ok: true, byWord: [] });
    }

    const byWord = await TestResult.aggregate<{
      _id: mongoose.Types.ObjectId;
      attempts: number;
      wrongCount: number;
    }>([
      { $match: { sessionId: { $in: sessionIds } } },
      {
        $group: {
          _id: "$wordId",
          attempts: { $sum: 1 },
          wrongCount: {
            $sum: { $cond: [{ $eq: ["$isCorrect", false] }, 1, 0] },
          },
        },
      },
    ]).exec();

    return NextResponse.json({
      ok: true,
      byWord: byWord.map((r) => ({
        wordId: String(r._id),
        attempts: r.attempts,
        wrongCount: r.wrongCount,
      })),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
