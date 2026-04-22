import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getUserModel } from "@/models/User";
import { Word } from "@/models/Word";
import { VocabularyDeck } from "@/models/VocabularyDeck";
import { Folder } from "@/models/Folder";
import { TestSession } from "@/models/TestSession";
import { ChatThread } from "@/models/ChatThread";
import { OpenAiRequestLog } from "@/models/OpenAiRequestLog";
import { StudyRecord } from "@/models/StudyRecord";

export const runtime = "nodejs";

const ADMIN_PIN = "1956";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("pin") !== ADMIN_PIN) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const User = getUserModel();

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const [
    totalUsers,
    totalWords,
    totalDecks,
    totalFolders,
    totalTests,
    totalChats,
    totalApiCalls,
    totalStudyRecords,
    recentUsers,
    todayTests,
    weekTests,
    todayWords,
    weekWords,
    tokenAgg,
    apiCostAgg,
    rawTestSessions,
  ] = await Promise.all([
    User.countDocuments(),
    Word.countDocuments(),
    VocabularyDeck.countDocuments({ deletedAt: null }),
    Folder.countDocuments({ deletedAt: null }),
    TestSession.countDocuments(),
    ChatThread.countDocuments(),
    OpenAiRequestLog.countDocuments(),
    StudyRecord.countDocuments(),
    User.find().sort({ lastLoginAt: -1 }).limit(10).select("name phone lastLoginAt createdAt").lean(),
    TestSession.countDocuments({ createdAt: { $gte: todayStart } }),
    TestSession.countDocuments({ createdAt: { $gte: weekStart } }),
    Word.countDocuments({ createdAt: { $gte: todayStart } }),
    Word.countDocuments({ createdAt: { $gte: weekStart } }),
    ChatThread.aggregate([
      { $group: { _id: null, input: { $sum: "$totalInputTokens" }, output: { $sum: "$totalOutputTokens" }, total: { $sum: "$totalTokens" } } },
    ]),
    OpenAiRequestLog.aggregate([
      { $group: { _id: "$model", count: { $sum: 1 }, tokens: { $sum: "$totalTokens" } } },
      { $sort: { count: -1 } },
    ]),
    TestSession.find().sort({ createdAt: -1 }).limit(10)
      .populate("vocabId", "name")
      .select("userId vocabId score total correct createdAt")
      .lean(),
  ]);

  // User는 별도 DB이므로 수동 매핑
  const testUserIds = [...new Set(
    rawTestSessions.map((s: Record<string, unknown>) => String(s.userId)),
  )];
  const testUsers = testUserIds.length > 0
    ? await User.find({ _id: { $in: testUserIds } }).select("name phone").lean()
    : [];
  const userMap = new Map(testUsers.map((u) => [String(u._id), u]));

  const recentTestSessions = rawTestSessions.map((s: Record<string, unknown>) => {
    const u = userMap.get(String(s.userId));
    return {
      user: u ? { name: u.name, phone: u.phone } : null,
      vocab: s.vocabId as { name: string } | null,
      score: s.score,
      total: s.total,
      correct: s.correct,
      createdAt: s.createdAt,
    };
  });

  // 단어 많은 사용자: User DB에서 가져와서 phone으로 단어 수 집계
  const allUsers = await User.find().select("name phone").lean();
  const phones = allUsers.map((u) => u.phone);
  const wordCountAgg = await VocabularyDeck.aggregate([
    { $match: { phone: { $in: phones }, deletedAt: null } },
    { $lookup: { from: "words", localField: "_id", foreignField: "vocabId", as: "words" } },
    { $group: { _id: "$phone", wc: { $sum: { $size: "$words" } } } },
    { $sort: { wc: -1 } },
    { $limit: 5 },
  ]);
  const topUsers = wordCountAgg.map((row: { _id: string; wc: number }) => {
    const u = allUsers.find((x) => x.phone === row._id);
    return { name: u?.name ?? "-", phone: row._id, wc: row.wc };
  });

  // 일별 API 사용 현황 (최근 30일)
  const thirtyDaysAgo = new Date(todayStart);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const dailyUsage = await OpenAiRequestLog.aggregate([
    { $match: { createdAt: { $gte: thirtyDaysAgo } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Seoul" } },
        calls: { $sum: 1 },
        promptTokens: { $sum: { $ifNull: ["$promptTokens", 0] } },
        completionTokens: { $sum: { $ifNull: ["$completionTokens", 0] } },
        totalTokens: { $sum: { $ifNull: ["$totalTokens", 0] } },
      },
    },
    { $sort: { _id: -1 } },
  ]);

  // 사용자별 AI 토큰 사용 현황
  const userTokenAgg = await ChatThread.aggregate([
    {
      $group: {
        _id: "$userId",
        input: { $sum: "$totalInputTokens" },
        output: { $sum: "$totalOutputTokens" },
        total: { $sum: "$totalTokens" },
        threads: { $sum: 1 },
      },
    },
    { $sort: { total: -1 } },
  ]);

  const tokenUserIds = userTokenAgg.map((r: Record<string, unknown>) => r._id);
  const tokenUsers = tokenUserIds.length > 0
    ? await User.find({ _id: { $in: tokenUserIds } }).select("name phone").lean()
    : [];
  const tokenUserMap = new Map(tokenUsers.map((u) => [String(u._id), u]));

  const userTokenUsage = userTokenAgg.map((r: { _id: unknown; input: number; output: number; total: number; threads: number }) => {
    const u = tokenUserMap.get(String(r._id));
    return {
      name: u?.name ?? "-",
      phone: u?.phone ?? "-",
      input: r.input,
      output: r.output,
      total: r.total,
      threads: r.threads,
    };
  });

  // 환율 가져오기 (USD→KRW)
  let usdKrw = 1380;
  try {
    const fxRes = await fetch(
      "https://open.er-api.com/v6/latest/USD",
      { signal: AbortSignal.timeout(5000) },
    );
    if (fxRes.ok) {
      const fxData = (await fxRes.json()) as { rates?: { KRW?: number } };
      if (fxData.rates?.KRW) usdKrw = fxData.rates.KRW;
    }
  } catch { /* fallback */ }

  const tokens = tokenAgg[0] ?? { input: 0, output: 0, total: 0 };

  return NextResponse.json({
    ok: true,
    overview: {
      totalUsers,
      totalWords,
      totalDecks,
      totalFolders,
      totalTests,
      totalChats,
      totalApiCalls,
      totalStudyRecords,
    },
    activity: {
      todayTests,
      weekTests,
      todayWords,
      weekWords,
    },
    tokens,
    apiCostAgg,
    topUsers,
    recentUsers: recentUsers.map((u) => ({
      name: u.name,
      phone: u.phone,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
    })),
    recentTestSessions,
    dailyUsage,
    userTokenUsage,
    usdKrw,
  });
}
