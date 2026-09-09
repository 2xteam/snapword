import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireViewer, serverError } from "@/lib/auth";
import { TestResult } from "@/models/TestResult";
import { TestSession } from "@/models/TestSession";
import { Word } from "@/models/Word";

export const runtime = "nodejs";

/*
  요청자는 `viewer.uid` 하나다. 쿼리의 `phone`·`userId` 는 옛 화면이
  아직 보내지만 읽지 않는다 → lib/auth.ts
*/
export async function GET(req: Request) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const { viewer } = auth;

    const url = new URL(req.url);
    const limitParam = parseInt(url.searchParams.get("limit") ?? "30", 10);
    const limit = Math.min(Math.max(limitParam, 1), 100);

    await connectDB();

    const sessions = await TestSession.find({
      userId: new mongoose.Types.ObjectId(viewer.uid),
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
    return serverError(err);
  }
}
