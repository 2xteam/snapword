import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { TestResult } from "@/models/TestResult";
import { TestSession } from "@/models/TestSession";
import { Word } from "@/models/Word";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    if (!mongoose.isValidObjectId(sessionId)) {
      return NextResponse.json(
        { ok: false, error: "유효하지 않은 sessionId입니다." },
        { status: 400 },
      );
    }

    await connectDB();

    const session = await TestSession.findById(sessionId).lean().exec();
    if (!session) {
      return NextResponse.json(
        { ok: false, error: "세션을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const results = await TestResult.find({
      sessionId: new mongoose.Types.ObjectId(sessionId),
    })
      .lean()
      .exec();

    const wordIds = [...new Set(results.map((r) => String(r.wordId)))];
    const words = await Word.find({
      _id: { $in: wordIds.map((id) => new mongoose.Types.ObjectId(id)) },
    })
      .lean()
      .exec();

    const wordMap = new Map(words.map((w) => [String(w._id), w]));

    const items = results.map((r) => {
      const w = wordMap.get(String(r.wordId));
      return {
        _id: String(r._id),
        wordId: String(r.wordId),
        word: w?.word ?? "",
        meaning: w?.meaning ?? "",
        isCorrect: r.isCorrect,
        type: r.type,
      };
    });

    return NextResponse.json({
      ok: true,
      session: {
        _id: String(session._id),
        score: session.score,
        total: session.total,
        correct: session.correct,
        createdAt: session.createdAt,
      },
      items,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
