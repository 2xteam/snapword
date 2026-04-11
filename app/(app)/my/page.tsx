"use client";

import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { loadSession, type SessionUser } from "@/lib/session";

export default function MyPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [vocabCount, setVocabCount] = useState(0);
  const [testCount, setTestCount] = useState(0);
  const [avg, setAvg] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

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
        vocabularyCount?: number;
        testCount?: number;
        averageScore?: number | null;
      };
      if (json.ok) {
        setVocabCount(json.vocabularyCount ?? 0);
        setTestCount(json.testCount ?? 0);
        setAvg(json.averageScore ?? null);
      }
      setLoaded(true);
    })();
  }, [session]);

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
      {/* Profile */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "1rem", borderRadius: 14, background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--accent-subtle)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
          {session.name.charAt(0)}
        </div>
        <div>
          <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 15 }}>{session.name}</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{session.phone}</div>
        </div>
      </div>

      {/* Tier */}
      <div style={{ padding: "1rem 1.25rem", borderRadius: 14, background: "var(--bg-card)", border: `1px solid ${tierConfig.border}`, display: "flex", alignItems: "center", gap: 14 }}>
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.6rem" }}>
          <StatCard label="단어장" value={String(vocabCount)} />
          <StatCard label="시험 횟수" value={String(testCount)} />
          <StatCard label="평균 점수" value={avg === null ? "—" : `${avg}점`} />
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={statStyle}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--text-primary)", marginTop: 4 }}>{value}</div>
    </div>
  );
}

const statStyle: CSSProperties = {
  padding: "0.85rem",
  borderRadius: 12,
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  textAlign: "center",
};
