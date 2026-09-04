import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { adminApiError, requireAdminSecret } from "@/lib/adminApi";

export const runtime = "nodejs";

/**
 * SnapWord 요약 — 통합 admin(포털)이 서버끼리 부른다.
 *
 * 응답은 두 부분이다. **모양이 앱마다 같아서** 포털은 무엇을 세는지 몰라도 그린다.
 *   stats  : `{ label, value }` 타일
 *   tables : `{ title, columns, rows }` 표 — 타일로는 못 담는 순위·추이
 *
 * 예전 `app/admin` 화면이 갖고 있던 집계를 그대로 옮겼다. 환율을 외부 API로
 * 가져오던 부분만 뺐다 — 관리 화면이 뜰 때마다 남의 서비스에 기대면
 * 그쪽이 느려질 때 이 화면도 함께 느려진다. 비용은 USD로 둔다.
 */

type Stat = { label: string; value: number };
type Table = { title: string; columns: string[]; rows: (string | number)[][] };

const fmtDate = (d: unknown): string => {
  if (!(d instanceof Date)) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${String(d.getFullYear()).slice(2)}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
};

export async function GET(req: Request) {
  const denied = requireAdminSecret(req);
  if (denied) return denied;

  try {
    await connectDB();
    const db = mongoose.connection.db;
    if (!db) throw new Error("DB 연결이 준비되지 않았습니다.");

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 6);
    const monthStart = new Date(todayStart);
    monthStart.setDate(monthStart.getDate() - 29);

    // 컬렉션이 아직 없을 수 있다. 있는 것만 센다
    const present = new Set((await db.listCollections().toArray()).map((c) => c.name));
    const count = async (name: string, filter: Record<string, unknown> = {}) =>
      present.has(name) ? db.collection(name).countDocuments(filter) : 0;

    const [
      vocabularies, words, folders, testSessions, testResults,
      chatThreads, notices, inquiries, waiting,
      wordsToday, wordsWeek, sessionsToday, sessionsWeek,
    ] = await Promise.all([
      count("vocabularies", { deletedAt: null }),
      count("words"),
      count("folders", { deletedAt: null }),
      count("test_sessions"),
      count("test_results"),
      count("chat_threads"),
      count("notices"),
      count("inquiries"),
      count("inquiries", { status: "pending" }),
      count("words", { createdAt: { $gte: todayStart } }),
      count("words", { createdAt: { $gte: weekStart } }),
      count("test_sessions", { createdAt: { $gte: todayStart } }),
      count("test_sessions", { createdAt: { $gte: weekStart } }),
    ]);

    const stats: Stat[] = [
      { label: "단어장", value: vocabularies },
      { label: "단어", value: words },
      { label: "폴더", value: folders },
      { label: "시험 세션", value: testSessions },
      { label: "시험 결과", value: testResults },
      { label: "AI 대화", value: chatThreads },
      { label: "오늘 추가된 단어", value: wordsToday },
      { label: "이번 주 단어", value: wordsWeek },
      { label: "오늘 시험", value: sessionsToday },
      { label: "이번 주 시험", value: sessionsWeek },
      { label: "공지", value: notices },
      { label: "문의 전체", value: inquiries },
      { label: "답변 대기", value: waiting },
    ];

    const tables: Table[] = [];

    // ── 단어를 많이 모은 사람 ──
    if (present.has("vocabularies")) {
      /*
        단어는 단어장 문서에 박혀 있지 않고 `words` 컬렉션에 `vocabId` 로 달려 있다.
        `$size: "$words"` 로 세면 항상 0이 나온다 — 실제로 그랬다.
      */
      const top = await db
        .collection("vocabularies")
        .aggregate([
          { $match: { deletedAt: null } },
          { $lookup: { from: "words", localField: "_id", foreignField: "vocabId", as: "w" } },
          { $group: { _id: "$phone", decks: { $sum: 1 }, wc: { $sum: { $size: "$w" } } } },
          { $sort: { wc: -1 } },
          { $limit: 10 },
        ])
        .toArray();

      if (top.length) {
        tables.push({
          title: "단어를 많이 모은 사람",
          columns: ["전화(뒤 4자리)", "단어장", "단어"],
          rows: top.map((r) => [
            r._id ? String(r._id).slice(-4) : "—",
            r.decks ?? 0,
            r.wc ?? 0,
          ]),
        });
      }
    }

    // ── 최근 시험 ──
    if (present.has("test_sessions")) {
      const recent = await db
        .collection("test_sessions")
        .find({})
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray();

      if (recent.length) {
        tables.push({
          title: "최근 시험",
          columns: ["날짜", "문항", "맞힘", "점수"],
          rows: recent.map((s) => [
            fmtDate(s.createdAt as Date),
            typeof s.total === "number" ? s.total : 0,
            typeof s.correct === "number" ? s.correct : 0,
            typeof s.score === "number" ? `${s.score}점` : "—",
          ]),
        });
      }
    }

    // ── AI 사용량 (최근 30일, 모델별) ──
    if (present.has("openai_request_logs")) {
      const byModel = await db
        .collection("openai_request_logs")
        .aggregate([
          { $match: { createdAt: { $gte: monthStart } } },
          {
            $group: {
              _id: "$model",
              calls: { $sum: 1 },
              input: { $sum: { $ifNull: ["$inputTokens", 0] } },
              output: { $sum: { $ifNull: ["$outputTokens", 0] } },
            },
          },
          { $sort: { calls: -1 } },
        ])
        .toArray();

      if (byModel.length) {
        tables.push({
          title: "AI 사용량 · 최근 30일",
          columns: ["모델", "호출", "입력 토큰", "출력 토큰"],
          rows: byModel.map((r) => [
            String(r._id ?? "—"),
            r.calls ?? 0,
            r.input ?? 0,
            r.output ?? 0,
          ]),
        });
      }
    }

    return NextResponse.json({
      ok: true,
      stats,
      tables,
      dbName: db.databaseName,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return adminApiError(err);
  }
}
