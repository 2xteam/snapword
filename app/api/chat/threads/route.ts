import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireViewer, badRequest, serverError } from "@/lib/auth";
import { ChatThread } from "@/models/ChatThread";
import { normalizeStudyLanguage } from "@/lib/studyLanguage";

export const runtime = "nodejs";

/*
  스레드의 소유자(`userId`)는 `viewer.uid` 하나다. 쿼리·본문의 `phone`·`userId` 는
  옛 화면이 아직 보내지만 읽지 않는다 → lib/auth.ts
*/

export async function GET(req: Request) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const { viewer } = auth;

    // 학습 언어별로 대화방을 나눠 보여준다. 값이 없으면 거르지 않는다
    const languageParam = new URL(req.url).searchParams.get("language");
    const languageFilter = languageParam
      ? normalizeStudyLanguage(languageParam) === "hanja"
        ? { language: "hanja" }
        : { language: { $ne: "hanja" } } // 필드가 없는 옛 대화방도 영어다
      : {};

    await connectDB();
    const items = await ChatThread.find({ userId: new mongoose.Types.ObjectId(viewer.uid), ...languageFilter })
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean()
      .exec();

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireViewer(req);
    if ("error" in auth) return auth.error;
    const { viewer } = auth;

    let body: { title?: string; language?: string };
    try {
      body = await req.json();
    } catch {
      return badRequest("JSON 본문이 필요합니다.");
    }

    const title =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim()
        : "새 대화";

    await connectDB();
    const doc = await ChatThread.create({
      userId: new mongoose.Types.ObjectId(viewer.uid),
      title,
      language: normalizeStudyLanguage(body.language),
    });

    return NextResponse.json({ ok: true, id: String(doc._id) });
  } catch (err) {
    return serverError(err);
  }
}
