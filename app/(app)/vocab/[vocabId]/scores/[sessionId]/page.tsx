"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { loadSession, type SessionUser } from "@/lib/session";

type ResultRow = {
  _id: string;
  wordId: string;
  word: string;
  meaning: string;
  isCorrect: boolean;
  type: string;
};

type SessionInfo = {
  _id: string;
  score: number;
  total: number;
  correct: number;
  createdAt: string;
};

const TYPE_LABELS: Record<string, string> = {
  meaning: "설명",
  example: "예문",
  synonym: "동의어",
  antonym: "반의어",
};

export default function SessionDetailPage() {
  const { vocabId, sessionId } = useParams<{ vocabId: string; sessionId: string }>();
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const s = loadSession();
    if (!s) router.replace("/");
    else setSession(s);
  }, [router]);

  useEffect(() => {
    if (!session || !sessionId) return;
    (async () => {
      const res = await fetch(`/api/test-sessions/${sessionId}`);
      const json = (await res.json()) as {
        ok: boolean;
        session?: SessionInfo;
        items?: ResultRow[];
      };
      if (json.ok) {
        if (json.session) setInfo(json.session);
        if (json.items) setResults(json.items);
      }
      setLoaded(true);
    })();
  }, [session, sessionId]);

  if (!session) return null;

  const wrongResults = results.filter((r) => !r.isCorrect);
  const correctResults = results.filter((r) => r.isCorrect);

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Link href={`/vocab/${vocabId}/scores`} style={backBtnStyle} title="뒤로">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <h1 style={{ margin: 0, fontSize: "1.2rem", color: "var(--text-primary)", flex: 1 }}>시험 결과</h1>
      </div>

      {!loaded ? (
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>로딩중입니다…</p>
      ) : !info ? (
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>결과를 찾을 수 없습니다.</p>
      ) : (
        <>
          {/* Summary Card */}
          <div style={summaryCard}>
            <div style={{ fontSize: 36, fontWeight: 800, color: info.score >= 90 ? "var(--success)" : info.score >= 60 ? "var(--accent)" : "var(--danger)" }}>
              {info.score}점
            </div>
            <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
              {info.correct} / {info.total} 정답
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
              {new Date(info.createdAt).toLocaleString("ko-KR")}
            </div>
          </div>

          {/* Wrong answers */}
          {wrongResults.length > 0 && (
            <section>
              <h2 style={sectionTitle}>
                <span style={{ color: "var(--danger)" }}>✕</span> 틀린 문제 ({wrongResults.length})
              </h2>
              <div style={{ display: "grid", gap: 8 }}>
                {wrongResults.map((r) => (
                  <div key={r._id} style={{ ...resultCard, borderLeft: "3px solid var(--danger)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={wrongBadge}>오답</span>
                      <span style={typeBadge}>{TYPE_LABELS[r.type] ?? r.type}</span>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
                      {r.word}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                      {r.meaning}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Correct answers */}
          {correctResults.length > 0 && (
            <section>
              <h2 style={sectionTitle}>
                <span style={{ color: "var(--success)" }}>✓</span> 맞은 문제 ({correctResults.length})
              </h2>
              <div style={{ display: "grid", gap: 8 }}>
                {correctResults.map((r) => (
                  <div key={r._id} style={{ ...resultCard, borderLeft: "3px solid var(--success)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={correctBadge}>정답</span>
                      <span style={typeBadge}>{TYPE_LABELS[r.type] ?? r.type}</span>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
                      {r.word}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                      {r.meaning}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

const backBtnStyle: CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  width: 32, height: 32, borderRadius: 8,
  background: "var(--bg-elevated)", border: "1px solid var(--border)",
  color: "var(--text-secondary)", textDecoration: "none",
};

const summaryCard: CSSProperties = {
  textAlign: "center",
  padding: "1.5rem 1rem",
  borderRadius: 16,
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
};

const sectionTitle: CSSProperties = {
  margin: "0 0 0.5rem",
  fontSize: "0.95rem",
  color: "var(--text-primary)",
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const resultCard: CSSProperties = {
  padding: "0.75rem 1rem",
  borderRadius: 10,
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
};

const wrongBadge: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  padding: "1px 8px",
  borderRadius: 999,
  background: "var(--danger-subtle)",
  color: "var(--danger)",
};

const correctBadge: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  padding: "1px 8px",
  borderRadius: 999,
  background: "var(--success-subtle)",
  color: "var(--success)",
};

const typeBadge: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  padding: "1px 8px",
  borderRadius: 999,
  background: "var(--bg-elevated)",
  color: "var(--text-muted)",
};
