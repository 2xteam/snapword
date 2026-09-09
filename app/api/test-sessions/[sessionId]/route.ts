import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireViewer, badRequest, notFound, serverError } from "@/lib/auth";
import { TestResult } from "@/models/TestResult";
import { TestSession } from "@/models/TestSession";
import { Word } from "@/models/Word";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const { viewer } = auth;

    const { sessionId } = await params;
    if (!mongoose.isValidObjectId(sessionId)) return badRequest("유효하지 않은 sessionId입니다.");

    await connectDB();

    // 예전에는 id 만 알면 누구 세션이든 볼 수 있었다. 내 것만 준다
    const session = await TestSession.findOne({ _id: sessionId, userId: viewer.uid }).lean().exec();
    if (!session) return notFound("세션을 찾을 수 없습니다.");

    const results = await TestResult.find({ sessionId: session._id })
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
    return serverError(err);
  }
}
