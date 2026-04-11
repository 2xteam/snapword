import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { Folder } from "@/models/Folder";
import { VocabularyDeck } from "@/models/VocabularyDeck";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const phone = normalizePhone(url.searchParams.get("phone") ?? "");
    if (!phone) {
      return NextResponse.json(
        { ok: false, error: "phone 쿼리가 필요합니다." },
        { status: 400 },
      );
    }

    await connectDB();

    const [folders, decks] = await Promise.all([
      Folder.find({ phone, deletedAt: { $ne: null } })
        .sort({ deletedAt: -1 })
        .limit(200)
        .lean()
        .exec(),
      VocabularyDeck.find({ phone, deletedAt: { $ne: null } })
        .sort({ deletedAt: -1 })
        .limit(200)
        .lean()
        .exec(),
    ]);

    return NextResponse.json({ ok: true, folders, decks });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      phone?: string;
      action?: "restore" | "permanentDelete";
      type?: "folder" | "deck";
      id?: string;
    };

    const phone = normalizePhone(body.phone ?? "");
    const { action, type, id } = body;

    if (!phone || !action || !type || !id || !mongoose.isValidObjectId(id)) {
      return NextResponse.json(
        { ok: false, error: "phone, action, type, id가 필요합니다." },
        { status: 400 },
      );
    }

    await connectDB();
    const oid = new mongoose.Types.ObjectId(id);

    if (action === "restore") {
      if (type === "folder") {
        const folder = await Folder.findOneAndUpdate(
          { _id: oid, phone, deletedAt: { $ne: null } },
          { $set: { deletedAt: null } },
        ).exec();
        if (!folder) {
          return NextResponse.json({ ok: false, error: "폴더를 찾을 수 없습니다." }, { status: 404 });
        }
        await VocabularyDeck.updateMany(
          { folderId: oid, phone, deletedAt: { $ne: null } },
          { $set: { deletedAt: null } },
        ).exec();
        async function restoreChildren(parentId: mongoose.Types.ObjectId) {
          const children = await Folder.find({ parentFolderId: parentId, phone, deletedAt: { $ne: null } }).exec();
          for (const child of children) {
            await Folder.updateOne({ _id: child._id }, { $set: { deletedAt: null } }).exec();
            await VocabularyDeck.updateMany({ folderId: child._id, deletedAt: { $ne: null } }, { $set: { deletedAt: null } }).exec();
            await restoreChildren(child._id);
          }
        }
        await restoreChildren(oid);
      } else {
        const deck = await VocabularyDeck.findOneAndUpdate(
          { _id: oid, phone, deletedAt: { $ne: null } },
          { $set: { deletedAt: null } },
        ).exec();
        if (!deck) {
          return NextResponse.json({ ok: false, error: "단어장을 찾을 수 없습니다." }, { status: 404 });
        }
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "permanentDelete") {
      if (type === "folder") {
        const folder = await Folder.findOne({ _id: oid, phone, deletedAt: { $ne: null } }).exec();
        if (!folder) {
          return NextResponse.json({ ok: false, error: "폴더를 찾을 수 없습니다." }, { status: 404 });
        }
        async function hardDeleteChildren(parentId: mongoose.Types.ObjectId) {
          const children = await Folder.find({ parentFolderId: parentId, phone }).exec();
          for (const child of children) {
            await VocabularyDeck.deleteMany({ folderId: child._id }).exec();
            await hardDeleteChildren(child._id);
            await Folder.deleteOne({ _id: child._id }).exec();
          }
        }
        await VocabularyDeck.deleteMany({ folderId: oid }).exec();
        await hardDeleteChildren(oid);
        await Folder.deleteOne({ _id: oid }).exec();
      } else {
        const deck = await VocabularyDeck.findOneAndDelete({ _id: oid, phone, deletedAt: { $ne: null } }).exec();
        if (!deck) {
          return NextResponse.json({ ok: false, error: "단어장을 찾을 수 없습니다." }, { status: 404 });
        }
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "action은 restore 또는 permanentDelete여야 합니다." }, { status: 400 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
