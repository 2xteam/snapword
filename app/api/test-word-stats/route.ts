import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireViewer, notFound, serverError } from "@/lib/auth";
import { TestResult } from "@/models/TestResult";
import { TestSession } from "@/models/TestSession";
import { VocabularyDeck } from "@/models/VocabularyDeck";

export const runtime = "nodejs";

/**
 * 단어장(vocab) 단위로 테스트 응시 횟수·오답 수 집계 (단어별).
 * 쿼리: vocabIds (쉼표 구분 ObjectId)
 *
 * 요청자는 `viewer.uid` 하나다. 쿼리의 `phone`·`userId` 는 옛 화면이
 * 아직 보내지만 읽지 않는다 → lib/auth.ts
 */
export async function GET(req: Request) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const { viewer } = auth;

    const url = new URL(req.url);
    const vocabIdsRaw = url.searchParams.get("vocabIds") ?? "";

    const vocabIds = vocabIdsRaw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => mongoose.isValidObjectId(s))
      .map((s) => new mongoose.Types.ObjectId(s));

    if (vocabIds.length === 0) {
      return NextResponse.json({ ok: true, byWord: [] });
    }

    await connectDB();

    // 하나라도 내 것이 아니면 전체를 404 로 — 있는지조차 알려주지 않는다
    const owned = await VocabularyDeck.countDocuments({
      _id: { $in: vocabIds },
      createdBy: viewer.uid,
    }).exec();
    if (owned !== vocabIds.length) return notFound("단어장을 찾을 수 없습니다.");

    const sessions = await TestSession.find({
      userId: new mongoose.Types.ObjectId(viewer.uid),
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
    return serverError(err);
  }
}
