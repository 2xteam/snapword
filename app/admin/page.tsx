"use client";

import type { CSSProperties } from "react";
import { useState, useCallback, useEffect, useRef } from "react";

interface Overview {
  totalUsers: number;
  totalWords: number;
  totalDecks: number;
  totalFolders: number;
  totalTests: number;
  totalChats: number;
  totalApiCalls: number;
  totalStudyRecords: number;
}

interface Activity {
  todayTests: number;
  weekTests: number;
  todayWords: number;
  weekWords: number;
}

interface Tokens { input: number; output: number; total: number }
interface ApiModel { _id: string; count: number; tokens: number }
interface TopUser { name: string; phone: string; wc: number }
interface RecentUser { name: string; phone: string; lastLoginAt: string | null; createdAt: string }
interface RecentTest {
  user: { name: string; phone: string } | null;
  vocab: { name: string } | null;
  score: number;
  total: number;
  correct: number;
  createdAt: string;
}

interface DailyUsage {
  _id: string;
  calls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface UserTokenUsage {
  name: string;
  phone: string;
  input: number;
  output: number;
  total: number;
  threads: number;
}

interface Stats {
  overview: Overview;
  activity: Activity;
  tokens: Tokens;
  apiCostAgg: ApiModel[];
  topUsers: TopUser[];
  recentUsers: RecentUser[];
  recentTestSessions: RecentTest[];
  dailyUsage: DailyUsage[];
  userTokenUsage: UserTokenUsage[];
  usdKrw: number;
}

interface AdminInquiry {
  id: string;
  name: string;
  phone: string;
  category: string;
  title: string;
  content: string;
  status: "pending" | "answered";
  answer: string;
  answeredAt: string | null;
  createdAt: string;
}

interface AdminNotice {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  createdAt: string;
}

interface AdminEvent {
  id: string;
  title: string;
  description: string;
  code: string;
  rewardTokens: number;
  maxPerUser: number;
  active: boolean;
  participantCount: number;
  createdAt: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  bug: "버그 신고",
  feature: "기능 요청",
  account: "계정 문의",
  other: "기타",
};

export default function AdminPage() {
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);

  const [inquiries, setInquiries] = useState<AdminInquiry[]>([]);
  const [inqFilter, setInqFilter] = useState<"" | "pending" | "answered">("");
  const [inqLoading, setInqLoading] = useState(false);
  const [expandedInq, setExpandedInq] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [answerBusy, setAnswerBusy] = useState(false);
  const [answerMsg, setAnswerMsg] = useState<string | null>(null);

  const [adminNotices, setAdminNotices] = useState<AdminNotice[]>([]);
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeContent, setNoticeContent] = useState("");
  const [noticePinned, setNoticePinned] = useState(false);
  const [noticeBusy, setNoticeBusy] = useState(false);
  const [noticeMsg, setNoticeMsg] = useState<string | null>(null);

  const [adminEvents, setAdminEvents] = useState<AdminEvent[]>([]);
  const [evTitle, setEvTitle] = useState("");
  const [evDescription, setEvDescription] = useState("");
  const [evCode, setEvCode] = useState("");
  const [evReward, setEvReward] = useState("");
  const [evMaxPerUser, setEvMaxPerUser] = useState("1");
  const [evBusy, setEvBusy] = useState(false);
  const [evMsg, setEvMsg] = useState<string | null>(null);

  const unlockRef = useRef(false);

  const unlock = useCallback(async (code: string) => {
    if (code.length < 4 || unlockRef.current) return;
    unlockRef.current = true;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/stats?pin=${encodeURIComponent(code)}`);
      const j = await res.json();
      if (!j.ok) { setError("인증 실패"); unlockRef.current = false; return; }
      setStats(j as Stats);
      setUnlocked(true);
    } catch { setError("서버 연결 실패"); unlockRef.current = false; } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (pin.length === 4 && !unlocked) unlock(pin);
  }, [pin, unlocked, unlock]);

  const fetchInquiries = useCallback(async (code: string, filter: string) => {
    setInqLoading(true);
    try {
      const qs = new URLSearchParams({ pin: code });
      if (filter) qs.set("status", filter);
      const res = await fetch(`/api/admin/inquiries?${qs}`);
      const j = (await res.json()) as { ok: boolean; inquiries?: AdminInquiry[] };
      if (j.ok && j.inquiries) setInquiries(j.inquiries);
    } catch { /* ignore */ }
    setInqLoading(false);
  }, []);

  const fetchNotices = useCallback(async (code: string) => {
    try {
      const res = await fetch(`/api/admin/notices?pin=${encodeURIComponent(code)}`);
      const j = (await res.json()) as { ok: boolean; notices?: AdminNotice[] };
      if (j.ok && j.notices) setAdminNotices(j.notices);
    } catch { /* ignore */ }
  }, []);

  const fetchEvents = useCallback(async (code: string) => {
    try {
      const res = await fetch(`/api/admin/events?pin=${encodeURIComponent(code)}`);
      const j = (await res.json()) as { ok: boolean; events?: AdminEvent[] };
      if (j.ok && j.events) setAdminEvents(j.events);
    } catch { /* ignore */ }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/stats?pin=${encodeURIComponent(pin)}`);
      const j = await res.json();
      if (j.ok) setStats(j as Stats);
    } catch { /* ignore */ } finally { setLoading(false); }
    fetchInquiries(pin, inqFilter);
    fetchNotices(pin);
    fetchEvents(pin);
  }, [pin, inqFilter, fetchInquiries, fetchNotices, fetchEvents]);

  useEffect(() => {
    if (unlocked) {
      fetchInquiries(pin, inqFilter);
      fetchNotices(pin);
      fetchEvents(pin);
    }
  }, [unlocked, inqFilter, pin, fetchInquiries, fetchNotices, fetchEvents]);

  const submitAnswer = useCallback(async (inquiryId: string) => {
    setAnswerBusy(true);
    setAnswerMsg(null);
    try {
      const res = await fetch("/api/admin/inquiries", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin, inquiryId, answer: answerText }),
      });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setAnswerMsg(j.error ?? "답변 등록에 실패했습니다.");
        return;
      }
      setAnswerText("");
      setExpandedInq(null);
      fetchInquiries(pin, inqFilter);
    } catch {
      setAnswerMsg("네트워크 오류입니다.");
    } finally {
      setAnswerBusy(false);
    }
  }, [pin, answerText, inqFilter, fetchInquiries]);

  const submitNotice = useCallback(async () => {
    if (!noticeTitle.trim() || !noticeContent.trim()) {
      setNoticeMsg("제목과 내용을 입력해 주세요.");
      return;
    }
    setNoticeBusy(true);
    setNoticeMsg(null);
    try {
      const res = await fetch("/api/admin/notices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin, title: noticeTitle.trim(), content: noticeContent.trim(), pinned: noticePinned }),
      });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !j.ok) { setNoticeMsg(j.error ?? "등록 실패"); return; }
      setNoticeTitle("");
      setNoticeContent("");
      setNoticePinned(false);
      fetchNotices(pin);
    } catch { setNoticeMsg("네트워크 오류"); } finally { setNoticeBusy(false); }
  }, [pin, noticeTitle, noticeContent, noticePinned, fetchNotices]);

  const deleteNotice = useCallback(async (noticeId: string) => {
    if (!confirm("이 공지를 삭제하시겠습니까?")) return;
    try {
      await fetch("/api/admin/notices", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin, noticeId }),
      });
      fetchNotices(pin);
    } catch { /* ignore */ }
  }, [pin, fetchNotices]);

  const submitEvent = useCallback(async () => {
    if (!evTitle.trim() || !evCode.trim() || !evReward) {
      setEvMsg("제목, 코드, 토큰 수를 입력해 주세요.");
      return;
    }
    setEvBusy(true);
    setEvMsg(null);
    try {
      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pin,
          title: evTitle.trim(),
          description: evDescription.trim(),
          code: evCode.trim(),
          rewardTokens: Number(evReward),
          maxPerUser: Number(evMaxPerUser) || 1,
        }),
      });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !j.ok) { setEvMsg(j.error ?? "등록 실패"); return; }
      setEvTitle("");
      setEvDescription("");
      setEvCode("");
      setEvReward("");
      setEvMaxPerUser("1");
      fetchEvents(pin);
    } catch { setEvMsg("네트워크 오류"); } finally { setEvBusy(false); }
  }, [pin, evTitle, evDescription, evCode, evReward, evMaxPerUser, fetchEvents]);

  const toggleEvent = useCallback(async (eventId: string, active: boolean) => {
    try {
      await fetch("/api/admin/events", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin, eventId, active }),
      });
      fetchEvents(pin);
    } catch { /* ignore */ }
  }, [pin, fetchEvents]);

  if (!unlocked) {
    return (
      <div style={lockScreen}>
        <div style={lockCard}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🔒</div>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 4px", color: "var(--text-primary)" }}>
            관리자 인증
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 16px" }}>
            핀코드를 입력하세요
          </p>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            placeholder="••••"
            style={pinInput}
            autoFocus
          />
          {error && <p style={{ fontSize: 12, color: "var(--danger)", margin: "8px 0 0" }}>{error}</p>}
          {loading && <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "12px 0 0" }}>확인 중…</p>}
        </div>
      </div>
    );
  }

  if (!stats) return null;
  const { overview: o, activity: a, tokens: t, apiCostAgg, topUsers, recentUsers, recentTestSessions, dailyUsage, userTokenUsage, usdKrw } = stats;

  return (
    <div style={page}>
      <div style={topBar}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
          📊 SnapWord Admin
        </h1>
        <button onClick={refresh} disabled={loading} style={refreshBtn}>
          {loading ? "⏳" : "🔄"} 새로고침
        </button>
      </div>

      {/* 전체 현황 */}
      <h2 style={sectionTitle}>전체 현황</h2>
      <div style={grid4}>
        <StatCard label="사용자" value={o.totalUsers} icon="👤" />
        <StatCard label="단어" value={o.totalWords} icon="📝" />
        <StatCard label="단어장" value={o.totalDecks} icon="📚" />
        <StatCard label="폴더" value={o.totalFolders} icon="📁" />
        <StatCard label="시험" value={o.totalTests} icon="✏️" />
        <StatCard label="채팅" value={o.totalChats} icon="💬" />
        <StatCard label="학습 기록" value={o.totalStudyRecords} icon="📖" />
        <StatCard label="API 호출" value={o.totalApiCalls} icon="⚡" />
      </div>

      {/* 최근 활동 */}
      <h2 style={sectionTitle}>최근 활동</h2>
      <div style={grid4}>
        <StatCard label="오늘 시험" value={a.todayTests} icon="📋" />
        <StatCard label="주간 시험" value={a.weekTests} icon="📋" />
        <StatCard label="오늘 단어" value={a.todayWords} icon="✨" />
        <StatCard label="주간 단어" value={a.weekWords} icon="✨" />
      </div>

      {/* 토큰 사용량 */}
      <h2 style={sectionTitle}>AI 토큰 사용량</h2>
      <div style={grid3}>
        <StatCard label="입력 토큰" value={t.input.toLocaleString()} icon="📥" />
        <StatCard label="출력 토큰" value={t.output.toLocaleString()} icon="📤" />
        <StatCard label="총 토큰" value={t.total.toLocaleString()} icon="🔢" />
      </div>

      {apiCostAgg.length > 0 && (
        <div style={tableWrap}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>모델</th>
                <th style={{ ...th, textAlign: "right" }}>호출 수</th>
                <th style={{ ...th, textAlign: "right" }}>토큰</th>
              </tr>
            </thead>
            <tbody>
              {apiCostAgg.map((m) => (
                <tr key={m._id}>
                  <td style={td}>{m._id}</td>
                  <td style={{ ...td, textAlign: "right" }}>{m.count.toLocaleString()}</td>
                  <td style={{ ...td, textAlign: "right" }}>{m.tokens.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 일별 API 사용 현황 */}
      <h2 style={sectionTitle}>일별 API 사용 현황 (최근 30일)</h2>
      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>날짜</th>
              <th style={{ ...th, textAlign: "right" }}>호출</th>
              <th style={{ ...th, textAlign: "right" }}>입력 토큰</th>
              <th style={{ ...th, textAlign: "right" }}>출력 토큰</th>
              <th style={{ ...th, textAlign: "right" }}>총 토큰</th>
              <th style={{ ...th, textAlign: "right" }}>예상 비용(₩)</th>
            </tr>
          </thead>
          <tbody>
            {dailyUsage.map((d) => {
              const costUsd = (d.promptTokens / 1_000_000) * 0.15 + (d.completionTokens / 1_000_000) * 0.6;
              const costKrw = costUsd * usdKrw;
              return (
                <tr key={d._id}>
                  <td style={td}>{d._id}</td>
                  <td style={{ ...td, textAlign: "right" }}>{d.calls.toLocaleString()}</td>
                  <td style={{ ...td, textAlign: "right" }}>{d.promptTokens.toLocaleString()}</td>
                  <td style={{ ...td, textAlign: "right" }}>{d.completionTokens.toLocaleString()}</td>
                  <td style={{ ...td, textAlign: "right" }}>{d.totalTokens.toLocaleString()}</td>
                  <td style={{ ...td, textAlign: "right" }}>₩{Math.ceil(costKrw).toLocaleString()}</td>
                </tr>
              );
            })}
            {dailyUsage.length > 0 && (() => {
              const totals = dailyUsage.reduce((acc, d) => ({
                calls: acc.calls + d.calls,
                prompt: acc.prompt + d.promptTokens,
                comp: acc.comp + d.completionTokens,
                tok: acc.tok + d.totalTokens,
              }), { calls: 0, prompt: 0, comp: 0, tok: 0 });
              const totalCost = ((totals.prompt / 1_000_000) * 0.15 + (totals.comp / 1_000_000) * 0.6) * usdKrw;
              return (
                <tr style={{ fontWeight: 700, background: "var(--bg-elevated)" }}>
                  <td style={td}>합계</td>
                  <td style={{ ...td, textAlign: "right" }}>{totals.calls.toLocaleString()}</td>
                  <td style={{ ...td, textAlign: "right" }}>{totals.prompt.toLocaleString()}</td>
                  <td style={{ ...td, textAlign: "right" }}>{totals.comp.toLocaleString()}</td>
                  <td style={{ ...td, textAlign: "right" }}>{totals.tok.toLocaleString()}</td>
                  <td style={{ ...td, textAlign: "right" }}>₩{Math.ceil(totalCost).toLocaleString()}</td>
                </tr>
              );
            })()}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
        * gpt-4o-mini 기준 (입력 $0.15/1M, 출력 $0.60/1M) · 환율 ₩{usdKrw.toLocaleString()}/USD
      </p>

      {/* 사용자별 AI 토큰 사용량 */}
      <h2 style={sectionTitle}>사용자별 AI 토큰 사용량</h2>
      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>이름</th>
              <th style={th}>전화번호</th>
              <th style={{ ...th, textAlign: "right" }}>대화 수</th>
              <th style={{ ...th, textAlign: "right" }}>입력 토큰</th>
              <th style={{ ...th, textAlign: "right" }}>출력 토큰</th>
              <th style={{ ...th, textAlign: "right" }}>총 토큰</th>
              <th style={{ ...th, textAlign: "right" }}>예상 비용(₩)</th>
            </tr>
          </thead>
          <tbody>
            {userTokenUsage.map((u, i) => {
              const costUsd = (u.input / 1_000_000) * 0.15 + (u.output / 1_000_000) * 0.6;
              const costKrw = costUsd * usdKrw;
              return (
                <tr key={i}>
                  <td style={td}>{u.name}</td>
                  <td style={td}>{maskPhone(u.phone)}</td>
                  <td style={{ ...td, textAlign: "right" }}>{u.threads}</td>
                  <td style={{ ...td, textAlign: "right" }}>{u.input.toLocaleString()}</td>
                  <td style={{ ...td, textAlign: "right" }}>{u.output.toLocaleString()}</td>
                  <td style={{ ...td, textAlign: "right" }}>{u.total.toLocaleString()}</td>
                  <td style={{ ...td, textAlign: "right" }}>₩{Math.ceil(costKrw).toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 단어 많은 사용자 */}
      <h2 style={sectionTitle}>단어 많은 사용자 TOP 5</h2>
      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>이름</th>
              <th style={th}>전화번호</th>
              <th style={{ ...th, textAlign: "right" }}>단어 수</th>
            </tr>
          </thead>
          <tbody>
            {topUsers.map((u, i) => (
              <tr key={i}>
                <td style={td}>{u.name}</td>
                <td style={td}>{maskPhone(u.phone)}</td>
                <td style={{ ...td, textAlign: "right" }}>{u.wc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 최근 로그인 */}
      <h2 style={sectionTitle}>최근 로그인</h2>
      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>이름</th>
              <th style={th}>전화번호</th>
              <th style={th}>최근 로그인</th>
              <th style={th}>가입일</th>
            </tr>
          </thead>
          <tbody>
            {recentUsers.map((u, i) => (
              <tr key={i}>
                <td style={td}>{u.name}</td>
                <td style={td}>{maskPhone(u.phone)}</td>
                <td style={td}>{u.lastLoginAt ? fmtDate(u.lastLoginAt) : "-"}</td>
                <td style={td}>{fmtDate(u.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 최근 시험 */}
      <h2 style={sectionTitle}>최근 시험 결과</h2>
      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>이름</th>
              <th style={th}>단어장</th>
              <th style={{ ...th, textAlign: "right" }}>점수</th>
              <th style={{ ...th, textAlign: "right" }}>정답</th>
              <th style={th}>일시</th>
            </tr>
          </thead>
          <tbody>
            {recentTestSessions.map((s, i) => (
              <tr key={i}>
                <td style={td}>{s.user?.name ?? "-"}</td>
                <td style={td}>{s.vocab?.name ?? "-"}</td>
                <td style={{ ...td, textAlign: "right" }}>{s.score}점</td>
                <td style={{ ...td, textAlign: "right" }}>{s.correct}/{s.total}</td>
                <td style={td}>{fmtDate(s.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 문의 관리 */}
      <h2 style={sectionTitle}>문의 관리</h2>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {([["", "전체"], ["pending", "대기 중"], ["answered", "답변 완료"]] as const).map(([val, label]) => (
          <button
            key={val}
            type="button"
            onClick={() => setInqFilter(val)}
            style={{
              padding: "5px 14px",
              borderRadius: 20,
              border: "1px solid var(--border)",
              background: inqFilter === val ? "var(--accent)" : "var(--bg-elevated)",
              color: inqFilter === val ? "#000" : "var(--text-secondary)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {inqLoading ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>로딩 중…</p>
      ) : inquiries.length === 0 ? (
        <div style={{ ...tableWrap, padding: "2rem", textAlign: "center" }}>
          <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>문의가 없습니다.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {inquiries.map((inq) => {
            const isOpen = expandedInq === inq.id;
            return (
              <div key={inq.id} style={{ borderRadius: 14, background: "var(--bg-card)", border: "1px solid var(--border)", overflow: "hidden" }}>
                <button
                  type="button"
                  onClick={() => {
                    setExpandedInq(isOpen ? null : inq.id);
                    setAnswerText(inq.answer);
                    setAnswerMsg(null);
                  }}
                  style={{ width: "100%", background: "none", border: "none", padding: "12px 16px", cursor: "pointer", textAlign: "left", color: "inherit" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: 20,
                      fontSize: 10,
                      fontWeight: 700,
                      background: inq.status === "answered" ? "var(--success-subtle)" : "var(--warning)",
                      color: inq.status === "answered" ? "var(--success)" : "#000",
                    }}>
                      {inq.status === "answered" ? "답변 완료" : "대기 중"}
                    </span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{CATEGORY_LABELS[inq.category] ?? inq.category}</span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: "auto" }}>{fmtDate(inq.createdAt)}</span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>{inq.title}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{inq.name} · {maskPhone(inq.phone)}</div>
                </button>

                {isOpen && (
                  <div style={{ padding: "0 16px 16px", borderTop: "1px solid var(--border)" }}>
                    <div style={{ margin: "12px 0", fontSize: 13, color: "var(--text-secondary)", whiteSpace: "pre-wrap", lineHeight: 1.65 }}>
                      {inq.content}
                    </div>

                    {inq.status === "answered" && inq.answer && (
                      <div style={{
                        marginBottom: 12,
                        padding: "10px 14px",
                        borderRadius: 10,
                        background: "var(--accent-subtle)",
                        borderLeft: "3px solid var(--accent)",
                      }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", marginBottom: 4 }}>기존 답변</div>
                        <div style={{ fontSize: 13, color: "var(--text-primary)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{inq.answer}</div>
                      </div>
                    )}

                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
                      {inq.status === "answered" ? "답변 수정" : "답변 작성"}
                    </label>
                    <textarea
                      value={answerText}
                      onChange={(e) => setAnswerText(e.target.value)}
                      placeholder="답변 내용을 입력하세요."
                      rows={4}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid var(--border)",
                        background: "var(--input-bg, var(--bg-elevated))",
                        color: "var(--text-primary)",
                        fontSize: 13,
                        resize: "vertical",
                        fontFamily: "inherit",
                      }}
                    />
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                      <button
                        type="button"
                        onClick={() => submitAnswer(inq.id)}
                        disabled={answerBusy}
                        style={{
                          padding: "7px 20px",
                          borderRadius: 10,
                          border: "none",
                          background: answerBusy ? "var(--text-muted)" : "var(--accent)",
                          color: "#000",
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: answerBusy ? "default" : "pointer",
                        }}
                      >
                        {answerBusy ? "등록 중…" : "답변 등록"}
                      </button>
                      {answerMsg && <span style={{ fontSize: 12, color: "var(--danger)" }}>{answerMsg}</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 공지 관리 */}
      <h2 style={sectionTitle}>공지 관리</h2>
      <div style={{ borderRadius: 14, background: "var(--bg-card)", border: "1px solid var(--border)", padding: "16px", marginBottom: 10 }}>
        <label style={adminLab}>제목
          <input value={noticeTitle} onChange={(e) => setNoticeTitle(e.target.value)} placeholder="공지 제목" style={adminInp} />
        </label>
        <label style={adminLab}>내용
          <textarea value={noticeContent} onChange={(e) => setNoticeContent(e.target.value)} placeholder="공지 내용" rows={4} style={{ ...adminInp, resize: "vertical" }} />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)", marginBottom: 10 }}>
          <input type="checkbox" checked={noticePinned} onChange={(e) => setNoticePinned(e.target.checked)} />
          상단 고정
        </label>
        <button type="button" onClick={submitNotice} disabled={noticeBusy} style={adminSubmitBtn(noticeBusy)}>
          {noticeBusy ? "등록 중…" : "공지 등록"}
        </button>
        {noticeMsg && <p style={{ fontSize: 12, color: "var(--danger)", margin: "8px 0 0" }}>{noticeMsg}</p>}
      </div>

      {adminNotices.length > 0 && (
        <div style={{ display: "grid", gap: 8 }}>
          {adminNotices.map((n) => (
            <div key={n.id} style={{ borderRadius: 14, background: "var(--bg-card)", border: "1px solid var(--border)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  {n.pinned && <span style={{ fontSize: 10, background: "var(--accent-subtle)", color: "var(--accent)", padding: "1px 6px", borderRadius: 10, fontWeight: 600 }}>고정</span>}
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{fmtDate(n.createdAt)}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{n.title}</div>
              </div>
              <button type="button" onClick={() => deleteNotice(n.id)} style={{ padding: "4px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-elevated)", color: "var(--danger)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                삭제
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 이벤트 토큰 관리 */}
      <h2 style={sectionTitle}>이벤트 토큰 관리</h2>
      <div style={{ borderRadius: 14, background: "var(--bg-card)", border: "1px solid var(--border)", padding: "16px", marginBottom: 10 }}>
        <label style={adminLab}>이벤트 제목
          <input value={evTitle} onChange={(e) => setEvTitle(e.target.value)} placeholder="이벤트 제목" style={adminInp} />
        </label>
        <label style={adminLab}>설명 (선택)
          <input value={evDescription} onChange={(e) => setEvDescription(e.target.value)} placeholder="이벤트 설명" style={adminInp} />
        </label>
        <label style={adminLab}>참여 코드
          <input value={evCode} onChange={(e) => setEvCode(e.target.value)} placeholder="사용자가 입력할 코드" style={adminInp} />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={adminLab}>보상 토큰
            <input type="number" value={evReward} onChange={(e) => setEvReward(e.target.value)} placeholder="10" style={adminInp} />
          </label>
          <label style={adminLab}>1인당 참여 횟수
            <input type="number" value={evMaxPerUser} onChange={(e) => setEvMaxPerUser(e.target.value)} placeholder="1" style={adminInp} />
          </label>
        </div>
        <button type="button" onClick={submitEvent} disabled={evBusy} style={adminSubmitBtn(evBusy)}>
          {evBusy ? "등록 중…" : "이벤트 등록"}
        </button>
        {evMsg && <p style={{ fontSize: 12, color: "var(--danger)", margin: "8px 0 0" }}>{evMsg}</p>}
      </div>

      {adminEvents.length > 0 && (
        <div style={{ display: "grid", gap: 8 }}>
          {adminEvents.map((ev) => (
            <div key={ev.id} style={{ borderRadius: 14, background: "var(--bg-card)", border: "1px solid var(--border)", padding: "12px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 10,
                  background: ev.active ? "var(--success-subtle)" : "var(--bg-elevated)",
                  color: ev.active ? "var(--success)" : "var(--text-muted)",
                }}>
                  {ev.active ? "진행 중" : "종료"}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{fmtDate(ev.createdAt)}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>{ev.title}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>
                코드: <code style={{ background: "var(--bg-elevated)", padding: "2px 6px", borderRadius: 4 }}>{ev.code}</code>
                &nbsp;· 보상: {ev.rewardTokens}토큰 · 1인당 {ev.maxPerUser}회 · 참여자: {ev.participantCount}명
              </div>
              <button
                type="button"
                onClick={() => toggleEvent(ev.id, !ev.active)}
                style={{
                  padding: "5px 14px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: ev.active ? "var(--bg-elevated)" : "var(--accent)",
                  color: ev.active ? "var(--text-secondary)" : "#000",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {ev.active ? "이벤트 종료" : "이벤트 재개"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number | string; icon: string }) {
  return (
    <div style={statCard}>
      <span style={{ fontSize: 22 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.2 }}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

function maskPhone(p: string) {
  if (p.length >= 8) return p.slice(0, 3) + "****" + p.slice(-4);
  return p;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("ko-KR", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/* ── Styles ── */

const lockScreen: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--bg-primary)",
  padding: 20,
};

const lockCard: CSSProperties = {
  textAlign: "center",
  padding: "2rem 2.5rem",
  borderRadius: 20,
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  maxWidth: 320,
  width: "100%",
};

const pinInput: CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  fontSize: 24,
  fontWeight: 700,
  textAlign: "center",
  letterSpacing: "0.3em",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--input-bg, var(--bg-elevated))",
  color: "var(--text-primary)",
  outline: "none",
};

const page: CSSProperties = {
  maxWidth: 900,
  margin: "0 auto",
  padding: "1.5rem 1.2rem 3rem",
  minHeight: "100vh",
};

const topBar: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 20,
};

const refreshBtn: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  padding: "6px 14px",
  fontSize: 13,
  fontWeight: 600,
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--bg-elevated)",
  color: "var(--text-primary)",
  cursor: "pointer",
};

const sectionTitle: CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "var(--text-secondary)",
  margin: "1.5rem 0 0.5rem",
};

const grid4: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
  gap: 10,
};

const grid3: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
  gap: 10,
};

const statCard: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "14px 16px",
  borderRadius: 14,
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
};

const tableWrap: CSSProperties = {
  overflowX: "auto",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--bg-card)",
  marginTop: 6,
};

const table: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const th: CSSProperties = {
  padding: "10px 12px",
  fontWeight: 700,
  color: "var(--text-muted)",
  textAlign: "left",
  borderBottom: "1px solid var(--border)",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const td: CSSProperties = {
  padding: "9px 12px",
  color: "var(--text-primary)",
  borderBottom: "1px solid var(--border)",
  whiteSpace: "nowrap",
};

const adminLab: CSSProperties = {
  display: "grid",
  gap: 4,
  marginBottom: 10,
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-secondary)",
};

const adminInp: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--input-bg, var(--bg-elevated))",
  color: "var(--text-primary)",
  fontSize: 13,
  fontFamily: "inherit",
};

function adminSubmitBtn(busy: boolean): CSSProperties {
  return {
    padding: "8px 20px",
    borderRadius: 10,
    border: "none",
    background: busy ? "var(--text-muted)" : "var(--accent)",
    color: "#000",
    fontWeight: 700,
    fontSize: 13,
    cursor: busy ? "default" : "pointer",
  };
}
