import { NextResponse } from "next/server";
import { requireAdminSecret } from "@/lib/adminApi";
import { connectDB } from "@/lib/db";
import { getEventModel, getApplicantModel } from "@/models/Event";

export const runtime = "nodejs";
/*
  예전에는 소스에 박힌 PIN을 쿼리스트링·본문으로 검사했다. 공개 저장소에 값이 있고
  URL이라 접근 로그에도 남았다. 지금은 포털과 공유하는 비밀 하나로 확인한다.
  → lib/adminApi.ts
*/

export async function GET(req: Request) {
  const denied = requireAdminSecret(req);
  if (denied) return denied;

  try {
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
  const denied = requireAdminSecret(req);
  if (denied) return denied;

  try {
    const body = await req.json();
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
  const denied = requireAdminSecret(req);
  if (denied) return denied;

  try {
    const body = await req.json();
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
