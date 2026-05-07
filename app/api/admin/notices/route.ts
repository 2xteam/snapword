import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getNoticeModel } from "@/models/Notice";

export const runtime = "nodejs";
const ADMIN_PIN = process.env.ADMIN_PIN ?? "";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const pin = url.searchParams.get("pin") ?? "";
    if (!ADMIN_PIN || pin !== ADMIN_PIN) {
      return NextResponse.json({ ok: false, error: "인증 실패" }, { status: 401 });
    }

    await connectDB();
    const Notice = getNoticeModel();
    const list = await Notice.find().sort({ createdAt: -1 }).lean();
    return NextResponse.json({
      ok: true,
      notices: list.map((n) => ({
        id: String(n._id),
        title: n.title,
        content: n.content,
        pinned: n.pinned ?? false,
        createdAt: n.createdAt,
      })),
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "오류" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const pin = body.pin ?? "";
    if (!ADMIN_PIN || pin !== ADMIN_PIN) {
      return NextResponse.json({ ok: false, error: "인증 실패" }, { status: 401 });
    }

    const title = (body.title ?? "").trim();
    const content = (body.content ?? "").trim();
    const pinned = body.pinned === true;

    if (!title || !content) {
      return NextResponse.json({ ok: false, error: "제목과 내용을 입력해 주세요." }, { status: 400 });
    }

    await connectDB();
    const Notice = getNoticeModel();
    const doc = await Notice.create({ title, content, pinned });
    return NextResponse.json({ ok: true, id: String(doc._id) });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "오류" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const pin = body.pin ?? "";
    if (!ADMIN_PIN || pin !== ADMIN_PIN) {
      return NextResponse.json({ ok: false, error: "인증 실패" }, { status: 401 });
    }

    const noticeId = body.noticeId ?? "";
    if (!noticeId) {
      return NextResponse.json({ ok: false, error: "noticeId가 필요합니다." }, { status: 400 });
    }

    await connectDB();
    const Notice = getNoticeModel();
    await Notice.findByIdAndDelete(noticeId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "오류" }, { status: 500 });
  }
}
