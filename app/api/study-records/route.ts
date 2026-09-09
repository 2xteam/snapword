import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireViewer, badRequest, notFound, serverError } from "@/lib/auth";
import { StudyRecord } from "@/models/StudyRecord";
import { VocabularyDeck } from "@/models/VocabularyDeck";
import { Word } from "@/models/Word";

export const runtime = "nodejs";

/*
  기록의 소유자(`userId`)는 `viewer.uid` 하나다. 본문·쿼리의 `phone`·`userId` 는
  옛 화면이 아직 보내지만 읽지 않는다 → lib/auth.ts
*/

export async function POST(req: Request) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const { viewer } = auth;

    let body: { wordId?: string; outcome?: "correct" | "wrong" };
    try {
      body = await req.json();
    } catch {
      return badRequest("JSON 본문이 필요합니다.");
    }

    const wordId = typeof body.wordId === "string" ? body.wordId.trim() : "";
    const outcome = body.outcome;

    if (!mongoose.isValidObjectId(wordId)) return badRequest("wordId가 필요합니다.");
    if (outcome !== "correct" && outcome !== "wrong") {
      return badRequest("outcome은 correct 또는 wrong 이어야 합니다.");
    }

    await connectDB();

    // 단어는 소유자를 직접 갖지 않는다 — 부모 단어장이 내 것인지 본다
    const word = await Word.findById(wordId).exec();
    if (!word) return notFound("단어를 찾을 수 없습니다.");
    const deck = await VocabularyDeck.findOne({ _id: word.vocabId, createdBy: viewer.uid }).exec();
    if (!deck) return notFound("단어를 찾을 수 없습니다.");

    const uid = new mongoose.Types.ObjectId(viewer.uid);
    const wid = word._id;
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
    return serverError(err);
  }
}

export async function GET(req: Request) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const { viewer } = auth;

    const url = new URL(req.url);
    const vocabId = url.searchParams.get("vocabId") ?? "";
    const uid = new mongoose.Types.ObjectId(viewer.uid);

    await connectDB();
    if (mongoose.isValidObjectId(vocabId)) {
      const wordIds = await Word.find({
        vocabId: new mongoose.Types.ObjectId(vocabId),
      })
        .select("_id")
        .lean()
        .exec();
      const ids = wordIds.map((w) => w._id);
      // 기록 자체가 내 것으로 좁혀지므로 남의 단어장 id 를 넣어도 빈 배열이다
      const items = await StudyRecord.find({ userId: uid, wordId: { $in: ids } })
        .lean()
        .exec();
      return NextResponse.json({ ok: true, items });
    }

    const items = await StudyRecord.find({ userId: uid })
      .limit(2000)
      .lean()
      .exec();
    return NextResponse.json({ ok: true, items });
  } catch (err) {
    return serverError(err);
  }
}
