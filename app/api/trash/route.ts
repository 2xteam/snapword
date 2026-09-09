import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireViewer, badRequest, notFound, serverError } from "@/lib/auth";
import { Folder } from "@/models/Folder";
import { VocabularyDeck } from "@/models/VocabularyDeck";

export const runtime = "nodejs";

/*
  소유자는 `viewer.uid` 하나다. 쿼리·본문의 `phone` 은 옛 화면이
  아직 보내지만 읽지 않는다 → lib/auth.ts
*/

export async function GET(req: Request) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const { viewer } = auth;

    await connectDB();

    const [folders, decks] = await Promise.all([
      Folder.find({ createdBy: viewer.uid, deletedAt: { $ne: null } })
        .sort({ deletedAt: -1 })
        .limit(200)
        .lean()
        .exec(),
      VocabularyDeck.find({ createdBy: viewer.uid, deletedAt: { $ne: null } })
        .sort({ deletedAt: -1 })
        .limit(200)
        .lean()
        .exec(),
    ]);

    return NextResponse.json({ ok: true, folders, decks });
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const { viewer } = auth;
    const owner = viewer.uid;

    const body = (await req.json()) as {
      action?: "restore" | "permanentDelete";
      type?: "folder" | "deck";
      id?: string;
    };

    const { action, type, id } = body;

    if (!action || !type || !id || !mongoose.isValidObjectId(id)) {
      return badRequest("action, type, id가 필요합니다.");
    }

    await connectDB();
    const oid = new mongoose.Types.ObjectId(id);

    if (action === "restore") {
      if (type === "folder") {
        const folder = await Folder.findOneAndUpdate(
          { _id: oid, createdBy: owner, deletedAt: { $ne: null } },
          { $set: { deletedAt: null } },
        ).exec();
        if (!folder) return notFound("폴더를 찾을 수 없습니다.");
        await VocabularyDeck.updateMany(
          { folderId: oid, createdBy: owner, deletedAt: { $ne: null } },
          { $set: { deletedAt: null } },
        ).exec();
        async function restoreChildren(parentId: mongoose.Types.ObjectId) {
          const children = await Folder.find({ parentFolderId: parentId, createdBy: owner, deletedAt: { $ne: null } }).exec();
          for (const child of children) {
            await Folder.updateOne({ _id: child._id }, { $set: { deletedAt: null } }).exec();
            await VocabularyDeck.updateMany({ folderId: child._id, deletedAt: { $ne: null } }, { $set: { deletedAt: null } }).exec();
            await restoreChildren(child._id);
          }
        }
        await restoreChildren(oid);
      } else {
        const deck = await VocabularyDeck.findOneAndUpdate(
          { _id: oid, createdBy: owner, deletedAt: { $ne: null } },
          { $set: { deletedAt: null } },
        ).exec();
        if (!deck) return notFound("단어장을 찾을 수 없습니다.");
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "permanentDelete") {
      if (type === "folder") {
        const folder = await Folder.findOne({ _id: oid, createdBy: owner, deletedAt: { $ne: null } }).exec();
        if (!folder) return notFound("폴더를 찾을 수 없습니다.");
        async function hardDeleteChildren(parentId: mongoose.Types.ObjectId) {
          const children = await Folder.find({ parentFolderId: parentId, createdBy: owner }).exec();
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
        const deck = await VocabularyDeck.findOneAndDelete({ _id: oid, createdBy: owner, deletedAt: { $ne: null } }).exec();
        if (!deck) return notFound("단어장을 찾을 수 없습니다.");
      }
      return NextResponse.json({ ok: true });
    }

    return badRequest("action은 restore 또는 permanentDelete여야 합니다.");
  } catch (err) {
    return serverError(err);
  }
}
