import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { VocabularyDeck } from "@/models/VocabularyDeck";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ vocabId: string }> },
) {
  try {
    const { vocabId } = await ctx.params;
    const body = (await req.json()) as { phone?: string; name?: string };
    const phone = normalizePhone(body.phone ?? "");
    const name = (body.name ?? "").trim();

    if (!mongoose.isValidObjectId(vocabId) || !phone || !name) {
      return NextResponse.json(
        { ok: false, error: "vocabId, phone, name이 필요합니다." },
        { status: 400 },
      );
    }

    await connectDB();
    const result = await VocabularyDeck.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(vocabId), phone },
      { $set: { name } },
      { new: true },
    )
      .lean()
      .exec();

    if (!result) {
      return NextResponse.json({ ok: false, error: "단어장을 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, item: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ vocabId: string }> },
) {
  try {
    const { vocabId } = await ctx.params;
    const url = new URL(req.url);
    const phone = normalizePhone(url.searchParams.get("phone") ?? "");

    if (!mongoose.isValidObjectId(vocabId) || !phone) {
      return NextResponse.json(
        { ok: false, error: "vocabId, phone 쿼리가 필요합니다." },
        { status: 400 },
      );
    }

    await connectDB();
    const deck = await VocabularyDeck.findById(vocabId).lean().exec();
    if (!deck || deck.phone !== phone) {
      return NextResponse.json(
        { ok: false, error: "단어장을 찾을 수 없거나 권한이 없습니다." },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, item: deck });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ vocabId: string }> },
) {
  try {
    const { vocabId } = await ctx.params;
    const url = new URL(req.url);
    const phone = normalizePhone(url.searchParams.get("phone") ?? "");

    if (!mongoose.isValidObjectId(vocabId) || !phone) {
      return NextResponse.json(
        { ok: false, error: "vocabId, phone이 필요합니다." },
        { status: 400 },
      );
    }

    await connectDB();
    const result = await VocabularyDeck.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(vocabId), phone, deletedAt: null },
      { $set: { deletedAt: new Date() } },
    ).exec();

    if (!result) {
      return NextResponse.json({ ok: false, error: "단어장을 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
