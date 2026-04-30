import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getInquiryModel } from "@/models/Inquiry";

export const runtime = "nodejs";

const ADMIN_PIN = "1956";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("pin") !== ADMIN_PIN) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const status = searchParams.get("status") ?? "";

  await connectDB();
  const Inquiry = getInquiryModel();

  const filter: Record<string, unknown> = {};
  if (status === "pending" || status === "answered") {
    filter.status = status;
  }

  const list = await Inquiry.find(filter)
    .sort({ createdAt: -1 })
    .lean()
    .exec();

  return NextResponse.json({
    ok: true,
    inquiries: list.map((d) => ({
      id: String(d._id),
      name: d.name,
      phone: d.phone,
      category: d.category,
      title: d.title,
      content: d.content,
      status: d.status,
      answer: d.answer ?? "",
      answeredAt: d.answeredAt ?? null,
      createdAt: d.createdAt,
    })),
  });
}

export async function PATCH(req: Request) {
  try {
    let body: { pin?: string; inquiryId?: string; answer?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "JSON 본문이 필요합니다." },
        { status: 400 },
      );
    }

    if (body.pin !== ADMIN_PIN) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const inquiryId = typeof body.inquiryId === "string" ? body.inquiryId : "";
    const answer = typeof body.answer === "string" ? body.answer.trim() : "";

    if (!inquiryId) {
      return NextResponse.json(
        { ok: false, error: "inquiryId가 필요합니다." },
        { status: 400 },
      );
    }

    if (!answer) {
      return NextResponse.json(
        { ok: false, error: "답변 내용을 입력해 주세요." },
        { status: 400 },
      );
    }

    await connectDB();
    const Inquiry = getInquiryModel();
    const doc = await Inquiry.findById(inquiryId).exec();

    if (!doc) {
      return NextResponse.json(
        { ok: false, error: "문의를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    doc.answer = answer;
    doc.status = "answered";
    doc.answeredAt = new Date();
    await doc.save();

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
