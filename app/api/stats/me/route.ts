import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { TestSession } from "@/models/TestSession";
import { getUserModel } from "@/models/User";
import { VocabularyDeck } from "@/models/VocabularyDeck";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const phone = normalizePhone(url.searchParams.get("phone") ?? "");
    const userId = url.searchParams.get("userId") ?? "";

    if (!phone || !mongoose.isValidObjectId(userId)) {
      return NextResponse.json(
        { ok: false, error: "phone, userId 쿼리가 필요합니다." },
        { status: 400 },
      );
    }

    await connectDB();
    const user = await getUserModel().findById(userId).exec();
    if (!user || user.phone !== phone) {
      return NextResponse.json({ ok: false, error: "권한이 없습니다." }, { status: 403 });
    }

    const uid = new mongoose.Types.ObjectId(userId);
    const vocabularyCount = await VocabularyDeck.countDocuments({ phone }).exec();
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
      vocabularyCount,
      testCount,
      averageScore,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
