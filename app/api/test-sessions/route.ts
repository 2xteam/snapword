import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { TEST_RESULT_TYPES, TestResult, type TestResultType } from "@/models/TestResult";
import { TestSession } from "@/models/TestSession";
import { User } from "@/models/User";
import { VocabularyDeck } from "@/models/VocabularyDeck";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const vocabId = url.searchParams.get("vocabId") ?? "";
    const userId = url.searchParams.get("userId") ?? "";
    if (!mongoose.isValidObjectId(vocabId) || !mongoose.isValidObjectId(userId)) {
      return NextResponse.json(
        { ok: false, error: "vocabId, userId 쿼리가 필요합니다." },
        { status: 400 },
      );
    }

    await connectDB();
    const items = await TestSession.find({
      vocabId: new mongoose.Types.ObjectId(vocabId),
      userId: new mongoose.Types.ObjectId(userId),
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
      .exec();

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

type AnswerRow = { wordId: string; isCorrect: boolean; type: TestResultType };

export async function POST(req: Request) {
  try {
    let body: {
      phone?: string;
      userId?: string;
      vocabId?: string;
      folderId?: string;
      answers?: AnswerRow[];
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
    const vocabId = typeof body.vocabId === "string" ? body.vocabId.trim() : "";
    const folderId = typeof body.folderId === "string" ? body.folderId.trim() : "";
    const answers = Array.isArray(body.answers) ? body.answers : [];

    if (
      !phone ||
      !mongoose.isValidObjectId(userId) ||
      !mongoose.isValidObjectId(vocabId) ||
      !mongoose.isValidObjectId(folderId)
    ) {
      return NextResponse.json(
        { ok: false, error: "phone, userId, vocabId, folderId가 필요합니다." },
        { status: 400 },
      );
    }

    if (answers.length === 0) {
      return NextResponse.json(
        { ok: false, error: "answers 배열이 필요합니다." },
        { status: 400 },
      );
    }

    for (const a of answers) {
      if (!mongoose.isValidObjectId(a.wordId)) {
        return NextResponse.json(
          { ok: false, error: "answers[].wordId가 올바른 ObjectId여야 합니다." },
          { status: 400 },
        );
      }
      if (!TEST_RESULT_TYPES.includes(a.type)) {
        return NextResponse.json(
          { ok: false, error: `answers[].type은 ${TEST_RESULT_TYPES.join("|")} 중 하나여야 합니다.` },
          { status: 400 },
        );
      }
    }

    await connectDB();
    const user = await User.findById(userId).exec();
    if (!user || user.phone !== phone) {
      return NextResponse.json({ ok: false, error: "권한이 없습니다." }, { status: 403 });
    }

    const deck = await VocabularyDeck.findById(vocabId).exec();
    if (!deck || deck.phone !== phone || String(deck.folderId) !== folderId) {
      return NextResponse.json(
        { ok: false, error: "단어장을 찾을 수 없거나 folderId가 맞지 않습니다." },
        { status: 403 },
      );
    }

    const total = answers.length;
    const correct = answers.filter((a) => a.isCorrect).length;
    const score = total > 0 ? Math.round((correct / total) * 100) : 0;

    const session = await TestSession.create({
      userId: new mongoose.Types.ObjectId(userId),
      vocabId: new mongoose.Types.ObjectId(vocabId),
      folderId: new mongoose.Types.ObjectId(folderId),
      score,
      total,
      correct,
    });

    const sid = session._id;
    for (const a of answers) {
      await TestResult.create({
        sessionId: sid,
        wordId: new mongoose.Types.ObjectId(a.wordId),
        isCorrect: a.isCorrect,
        type: a.type,
      });
    }

    return NextResponse.json({
      ok: true,
      sessionId: String(sid),
      score,
      total,
      correct,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
