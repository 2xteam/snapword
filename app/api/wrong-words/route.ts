import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { TestResult } from "@/models/TestResult";
import { TestSession } from "@/models/TestSession";
import { getUserModel } from "@/models/User";
import { Word } from "@/models/Word";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const phone = normalizePhone(url.searchParams.get("phone") ?? "");
    const userId = url.searchParams.get("userId") ?? "";
    const limitParam = parseInt(url.searchParams.get("limit") ?? "30", 10);
    const limit = Math.min(Math.max(limitParam, 1), 100);

    if (!phone || !mongoose.isValidObjectId(userId)) {
      return NextResponse.json(
        { ok: false, error: "phone, userId가 필요합니다." },
        { status: 400 },
      );
    }

    await connectDB();
    const user = await getUserModel().findById(userId).exec();
    if (!user || user.phone !== phone) {
      return NextResponse.json({ ok: false, error: "권한이 없습니다." }, { status: 403 });
    }

    const sessions = await TestSession.find({
      userId: new mongoose.Types.ObjectId(userId),
    })
      .select("_id")
      .lean()
      .exec();

    const sessionIds = sessions.map((s) => s._id);
    if (sessionIds.length === 0) {
      return NextResponse.json({ ok: true, items: [], hasTests: false });
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
      { $match: { wrongCount: { $gte: 1 } } },
      { $sort: { wrongCount: -1 } },
      { $limit: limit },
    ]).exec();

    const wordIds = byWord.map((r) => r._id);
    const words = await Word.find({ _id: { $in: wordIds } }).lean().exec();
    const wordMap = new Map(words.map((w) => [String(w._id), w]));

    const items = byWord
      .map((r) => {
        const w = wordMap.get(String(r._id));
        if (!w) return null;
        return {
          _id: String(w._id),
          word: w.word,
          meaning: w.meaning,
          example: w.example,
          synonyms: w.synonyms,
          antonyms: w.antonyms,
          wrongCount: r.wrongCount,
          attempts: r.attempts,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ ok: true, items, hasTests: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
