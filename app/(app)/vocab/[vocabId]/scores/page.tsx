"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { loadSession, type SessionUser } from "@/lib/session";

type Row = {
  _id: string;
  score: number;
  total: number;
  correct: number;
  createdAt: string;
};

const backBtnStyle: import("react").CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 32,
  height: 32,
  borderRadius: 8,
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  color: "var(--text-secondary)",
  textDecoration: "none",
};

export default function ScoresPage() {
  const { vocabId } = useParams<{ vocabId: string }>();
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const s = loadSession();
    if (!s) router.replace("/");
    else setSession(s);
  }, [router]);

  useEffect(() => {
    if (!session || !vocabId) return;
    (async () => {
      const res = await fetch(
        `/api/test-sessions?vocabId=${encodeURIComponent(vocabId)}&userId=${encodeURIComponent(session.id)}`,
      );
      const json = (await res.json()) as { ok: boolean; items?: Row[] };
      if (json.ok && json.items) setRows(json.items);
      setLoaded(true);
    })();
  }, [session, vocabId]);

  if (!session) return null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.75rem" }}>
        <Link href={`/vocab/${vocabId}`} style={backBtnStyle} title="뒤로">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <h1 style={{ margin: 0, fontSize: "1.2rem", color: "var(--text-primary)" }}>Score 기록</h1>
      </div>
      <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>시도마다 점수와 정답 수를 확인하세요.</p>
      <ol style={{ paddingLeft: "1.1rem", display: "grid", gap: 10 }}>
        {!loaded ? (
          <li style={{ color: "var(--text-muted)", listStyle: "none", marginLeft: "-1.1rem" }}>로딩중입니다…</li>
        ) : rows.length === 0 ? (
          <li style={{ color: "var(--text-muted)" }}>기록이 없습니다. Test를 먼저 풀어 보세요.</li>
        ) : (
          rows.map((r, i) => (
            <li
              key={r._id}
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "0.75rem 1rem",
                listStyle: "none",
                marginLeft: "-1.1rem",
                color: "var(--text-primary)",
              }}
            >
              <strong>#{rows.length - i}차</strong> · {new Date(r.createdAt).toLocaleString("ko-KR")}{" "}
              <span style={{ color: "var(--accent)", fontWeight: 800 }}>{r.score}점</span> ({r.correct}/{r.total})
            </li>
          ))
        )}
      </ol>
    </div>
  );
}
