import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getEventModel, getApplicantModel } from "@/models/Event";

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
    const Event = getEventModel();
    const Applicant = getApplicantModel();
    const list = await Event.find().sort({ createdAt: -1 }).lean();

    const events = await Promise.all(
      list.map(async (ev) => {
        const participantCount = await Applicant.countDocuments({ eventId: ev._id });
        return {
          id: String(ev._id),
          title: ev.title,
          description: ev.description,
          code: ev.code,
          rewardTokens: ev.rewardTokens,
          maxPerUser: ev.maxPerUser,
          active: ev.active,
          participantCount,
          createdAt: ev.createdAt,
        };
      }),
    );

    return NextResponse.json({ ok: true, events });
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
    const code = (body.code ?? "").trim();
    const rewardTokens = Number(body.rewardTokens) || 0;
    const maxPerUser = Number(body.maxPerUser) || 1;
    const description = (body.description ?? "").trim();

    if (!title || !code || rewardTokens <= 0) {
      return NextResponse.json({ ok: false, error: "제목, 코드, 보상 토큰을 입력해 주세요." }, { status: 400 });
    }

    await connectDB();
    const Event = getEventModel();
    const doc = await Event.create({ title, description, code, rewardTokens, maxPerUser });
    return NextResponse.json({ ok: true, id: String(doc._id) });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "오류" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const pin = body.pin ?? "";
    if (!ADMIN_PIN || pin !== ADMIN_PIN) {
      return NextResponse.json({ ok: false, error: "인증 실패" }, { status: 401 });
    }

    const eventId = body.eventId ?? "";
    const active = body.active;
    if (!eventId || typeof active !== "boolean") {
      return NextResponse.json({ ok: false, error: "eventId, active가 필요합니다." }, { status: 400 });
    }

    await connectDB();
    const Event = getEventModel();
    await Event.findByIdAndUpdate(eventId, { active });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "오류" }, { status: 500 });
  }
}
