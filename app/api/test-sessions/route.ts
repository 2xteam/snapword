import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireViewer, badRequest, notFound, serverError } from "@/lib/auth";
import { TEST_RESULT_TYPES, TestResult, type TestResultType } from "@/models/TestResult";
import { TestSession } from "@/models/TestSession";
import { VocabularyDeck } from "@/models/VocabularyDeck";

export const runtime = "nodejs";

/*
  세션의 소유자(`userId`)는 `viewer.uid` 하나다. 본문·쿼리의 `phone`·`userId` 는
  옛 화면이 아직 보내지만 읽지 않는다 → lib/auth.ts
*/

export async function GET(req: Request) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const { viewer } = auth;

    const url = new URL(req.url);
    const vocabId = url.searchParams.get("vocabId") ?? "";
    if (!mongoose.isValidObjectId(vocabId)) return badRequest("vocabId 쿼리가 필요합니다.");

    await connectDB();
    const items = await TestSession.find({
      vocabId: new mongoose.Types.ObjectId(vocabId),
      userId: new mongoose.Types.ObjectId(viewer.uid),
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
      .exec();

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    return serverError(err);
  }
}

type AnswerRow = { wordId: string; isCorrect: boolean; type: TestResultType };

export async function POST(req: Request) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const { viewer } = auth;

    let body: { vocabId?: string; folderId?: string; answers?: AnswerRow[] };
    try {
      body = await req.json();
    } catch {
      return badRequest("JSON 본문이 필요합니다.");
    }

    const vocabId = typeof body.vocabId === "string" ? body.vocabId.trim() : "";
    const folderId = typeof body.folderId === "string" ? body.folderId.trim() : "";
    const answers = Array.isArray(body.answers) ? body.answers : [];

    if (!mongoose.isValidObjectId(vocabId) || !mongoose.isValidObjectId(folderId)) {
      return badRequest("vocabId, folderId가 필요합니다.");
    }

    if (answers.length === 0) return badRequest("answers 배열이 필요합니다.");

    for (const a of answers) {
      if (!mongoose.isValidObjectId(a.wordId)) {
        return badRequest("answers[].wordId가 올바른 ObjectId여야 합니다.");
      }
      if (!TEST_RESULT_TYPES.includes(a.type)) {
        return badRequest(`answers[].type은 ${TEST_RESULT_TYPES.join("|")} 중 하나여야 합니다.`);
      }
    }

    await connectDB();
    const deck = await VocabularyDeck.findOne({ _id: vocabId, createdBy: viewer.uid }).exec();
    if (!deck) return notFound("단어장을 찾을 수 없습니다.");
    if (String(deck.folderId) !== folderId) {
      return badRequest("folderId가 단어장과 맞지 않습니다.");
    }

    const total = answers.length;
    const correct = answers.filter((a) => a.isCorrect).length;
    const score = total > 0 ? Math.round((correct / total) * 100) : 0;

    const session = await TestSession.create({
      userId: new mongoose.Types.ObjectId(viewer.uid),
      vocabId: deck._id,
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
    return serverError(err);
  }
}
