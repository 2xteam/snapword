import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireViewer, badRequest, notFound, serverError } from "@/lib/auth";
import { VocabularyDeck } from "@/models/VocabularyDeck";

export const runtime = "nodejs";

/* 소유자는 `viewer.uid` 하나다. 쿼리·본문의 `phone` 은 읽지 않는다 → lib/auth.ts */

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ vocabId: string }> },
) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const { viewer } = auth;

    const { vocabId } = await ctx.params;
    const body = (await req.json()) as { name?: string };
    const name = (body.name ?? "").trim();

    if (!mongoose.isValidObjectId(vocabId) || !name) {
      return badRequest("vocabId, name이 필요합니다.");
    }

    await connectDB();
    const result = await VocabularyDeck.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(vocabId), createdBy: viewer.uid },
      { $set: { name } },
      { new: true },
    )
      .lean()
      .exec();

    if (!result) return notFound("단어장을 찾을 수 없습니다.");

    return NextResponse.json({ ok: true, item: result });
  } catch (err) {
    return serverError(err);
  }
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ vocabId: string }> },
) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const { viewer } = auth;

    const { vocabId } = await ctx.params;
    if (!mongoose.isValidObjectId(vocabId)) return badRequest("vocabId가 필요합니다.");

    await connectDB();
    const deck = await VocabularyDeck.findOne({ _id: vocabId, createdBy: viewer.uid }).lean().exec();
    if (!deck) return notFound("단어장을 찾을 수 없습니다.");

    return NextResponse.json({ ok: true, item: deck });
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ vocabId: string }> },
) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const { viewer } = auth;

    const { vocabId } = await ctx.params;
    if (!mongoose.isValidObjectId(vocabId)) return badRequest("vocabId가 필요합니다.");

    await connectDB();
    const result = await VocabularyDeck.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(vocabId), createdBy: viewer.uid, deletedAt: null },
      { $set: { deletedAt: new Date() } },
    ).exec();

    if (!result) return notFound("단어장을 찾을 수 없습니다.");

    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err);
  }
}
