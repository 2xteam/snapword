"use client";

import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { IS_TOKEN_SYSTEM_ENABLED } from "@/lib/constants";
import { loadSession, type SessionUser } from "@/lib/session";
import { InstallButton } from "@/components/InstallButton";

export default function MyPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [vocabCount, setVocabCount] = useState(0);
  const [testCount, setTestCount] = useState(0);
  const [avg, setAvg] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [email, setEmail] = useState<string>("");
  const [emailInput, setEmailInput] = useState("");
  const [emailEditing, setEmailEditing] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  const [tokens, setTokens] = useState(0);


  useEffect(() => {
    const s = loadSession();
    if (!s) router.replace("/");
    else setSession(s);
  }, [router]);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const res = await fetch(
        `/api/stats/me?phone=${encodeURIComponent(session.phone)}&userId=${encodeURIComponent(session.id)}`,
      );
      const json = (await res.json()) as {
        ok: boolean;
        email?: string;
        tokens?: number;
        vocabularyCount?: number;
        testCount?: number;
        averageScore?: number | null;
      };
      if (json.ok) {
        setVocabCount(json.vocabularyCount ?? 0);
        setTestCount(json.testCount ?? 0);
        setAvg(json.averageScore ?? null);
        setEmail(json.email ?? "");
        setTokens(json.tokens ?? 0);
      }
      setLoaded(true);
    })();
  }, [session]);

  const saveEmail = useCallback(async () => {
    if (!session) return;
    setEmailBusy(true);
    setEmailMsg(null);

    const trimmed = emailInput.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailMsg("올바른 이메일 주소를 입력해 주세요.");
      setEmailBusy(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/update-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phone: session.phone,
          userId: session.id,
          email: trimmed,
        }),
      });
      const json = (await res.json()) as { ok: boolean; email?: string; error?: string };
      if (!res.ok || !json.ok) {
        setEmailMsg(json.error ?? "이메일 등록에 실패했습니다.");
        return;
      }
      setEmail(json.email ?? trimmed);
      setEmailEditing(false);
      setEmailInput("");
    } catch {
      setEmailMsg("네트워크 오류입니다.");
    } finally {
      setEmailBusy(false);
    }
  }, [session, emailInput]);

  if (!session) return null;

  const tier =
    (avg ?? 0) >= 85 ? "gold" : (avg ?? 0) >= 70 ? "silver" : "starter";

  const tierConfig = {
    gold: { label: "골드 모멘텀", icon: "🏆", color: "#fbbf24", border: "rgba(234,179,8,0.25)" },
    silver: { label: "실버 스텝", icon: "✨", color: "#94a3b8", border: "rgba(148,163,184,0.25)" },
    starter: { label: "스타터 파워", icon: "🌱", color: "var(--accent)", border: "var(--border)" },
  }[tier];

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <h1 style={{ margin: 0, fontSize: "1.3rem", color: "var(--text-primary)" }}>My</h1>

      {/* Profile */}
      <div style={{ padding: "1rem", borderRadius: "var(--radius-lg)", background: "var(--bg-card)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--accent-subtle)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
            {session.name.charAt(0)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 15 }}>{session.name}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{session.phone}</div>
          </div>
        </div>

        {/* Email */}
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-subtle)" }}>
          {emailEditing ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>이메일 등록</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="example@email.com"
                  autoFocus
                  style={{
                    flex: 1,
                    padding: "0.5rem 0.7rem",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--input-border)",
                    background: "var(--input-bg)",
                    color: "var(--text-primary)",
                    fontSize: 14,
                  }}
                />
                <button
                  type="button"
                  onClick={saveEmail}
                  disabled={emailBusy}
                  style={{
                    padding: "0.5rem 0.9rem",
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    background: emailBusy ? "var(--text-muted)" : "var(--accent)",
                    color: "var(--on-accent)",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: emailBusy ? "default" : "pointer",
                    flexShrink: 0,
                  }}
                >
                  {emailBusy ? "…" : "저장"}
                </button>
                <button
                  type="button"
                  onClick={() => { setEmailEditing(false); setEmailMsg(null); }}
                  style={{
                    padding: "0.5rem 0.7rem",
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    background: "var(--bg-elevated)",
                    color: "var(--text-secondary)",
                    fontSize: 13,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  취소
                </button>
              </div>
              {emailMsg && <p style={{ margin: 0, color: "var(--danger)", fontSize: 12 }}>{emailMsg}</p>}
            </div>
          ) : email ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="22,6 12,13 2,6" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span style={{ fontSize: 13, color: "var(--text-secondary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</span>
              <button
                type="button"
                onClick={() => { setEmailInput(email); setEmailEditing(true); setEmailMsg(null); }}
                style={{
                  padding: "3px 10px",
                  borderRadius: "var(--radius-full)",
                  border: "none",
                  background: "var(--bg-elevated)",
                  color: "var(--text-muted)",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                변경
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { setEmailEditing(true); setEmailMsg(null); }}
              style={{
                width: "100%",
                padding: "0.55rem",
                borderRadius: "var(--radius-sm)",
                border: "1px dashed var(--border)",
                background: "transparent",
                color: "var(--accent)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              이메일 등록하기
            </button>
          )}
        </div>
      </div>

      {/* Tier */}
      <div style={{ padding: "1rem 1.25rem", borderRadius: "var(--radius-lg)", background: "var(--bg-card)", display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ fontSize: 28 }}>{tierConfig.icon}</span>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>현재 등급</div>
          <div style={{ fontSize: "1.15rem", fontWeight: 700, color: tierConfig.color }}>{tierConfig.label}</div>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
            {tier === "starter"
              ? "매일 한 세트만 꾸준히 하면 평균이 빠르게 따라옵니다."
              : "꾸준함이 보여요. 복습 타이밍을 지키는 것도 큰 성취입니다."}
          </p>
        </div>
      </div>

      {/* Stats */}
      {!loaded ? (
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>로딩중입니다…</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: IS_TOKEN_SYSTEM_ENABLED ? "1fr 1fr" : "repeat(3, 1fr)",
            gap: "0.6rem",
          }}
        >
          <StatCard label="단어장" value={String(vocabCount)} />
          <StatCard label="시험 횟수" value={String(testCount)} />
          <StatCard label="평균 점수" value={avg === null ? "—" : `${avg}점`} />
          {IS_TOKEN_SYSTEM_ENABLED && <StatCard label="보유 토큰" value={`${tokens}`} />}
        </div>
      )}

      {/* 바로가기 추가 */}
      <InstallButton />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={statStyle}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: "1.35rem", fontWeight: 700, fontStyle: "italic", color: "var(--text-primary)", marginTop: 4 }}>{value}</div>
    </div>
  );
}


const statStyle: CSSProperties = {
  padding: "0.85rem",
  borderRadius: "var(--radius-md)",
  background: "var(--bg-card)",
  textAlign: "center",
};
