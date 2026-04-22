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

export default function AdminPage() {
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);

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

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/stats?pin=${encodeURIComponent(pin)}`);
      const j = await res.json();
      if (j.ok) setStats(j as Stats);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [pin]);

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
