import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireViewer, serverError } from "@/lib/auth";
import { IS_TOKEN_SYSTEM_ENABLED } from "@/lib/constants";
import { TestSession } from "@/models/TestSession";
import { VocabularyDeck } from "@/models/VocabularyDeck";

export const runtime = "nodejs";

/*
  "나"는 `viewer.uid` 하나다. 쿼리의 `phone`·`userId` 는 옛 화면이
  아직 보내지만 읽지 않는다 → lib/auth.ts
*/
export async function GET(req: Request) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const { viewer } = auth;

    await connectDB();
    const uid = new mongoose.Types.ObjectId(viewer.uid);
    const vocabularyCount = await VocabularyDeck.countDocuments({ createdBy: uid }).exec();
    const testCount = await TestSession.countDocuments({ userId: uid }).exec();

    const agg = await TestSession.aggregate<{ _id: null; avgScore: number }>([
      { $match: { userId: uid } },
      { $group: { _id: null, avgScore: { $avg: "$score" } } },
    ]).exec();

    const averageScore =
      agg.length > 0 && typeof agg[0].avgScore === "number"
        ? Math.round(agg[0].avgScore * 10) / 10
        : null;

    return NextResponse.json({
      ok: true,
      email: viewer.doc.email ?? "",
      tokens: IS_TOKEN_SYSTEM_ENABLED ? viewer.doc.tokens ?? 0 : 0,
      vocabularyCount,
      testCount,
      averageScore,
    });
  } catch (err) {
    return serverError(err);
  }
}
