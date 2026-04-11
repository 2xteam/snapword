"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadSession, type SessionUser } from "@/lib/session";

type W = {
  _id: string;
  word: string;
  meaning: string;
  example: string;
  synonyms: string[];
  antonyms: string[];
};

type TestWordStat = { wrongCount: number; attempts: number };

const DICT = (word: string) =>
  `https://en.dict.naver.com/#/search?range=all&query=${encodeURIComponent(word)}&from=nsearch`;

const PEEK = 12;
const GAP = 8;

export default function StudyPage() {
  const { vocabId } = useParams<{ vocabId: string }>();
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [words, setWords] = useState<W[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [testStats, setTestStats] = useState<Record<string, TestWordStat>>({});
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState<Set<string>>(new Set());

  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const s = loadSession();
    if (!s) router.replace("/");
    else setSession(s);
  }, [router]);

  const load = useCallback(async () => {
    if (!vocabId || !session) return;
    const [wr, tr] = await Promise.all([
      fetch(`/api/words?vocabId=${encodeURIComponent(vocabId)}`),
      fetch(
        `/api/test-word-stats?phone=${encodeURIComponent(session.phone)}&userId=${encodeURIComponent(session.id)}&vocabIds=${encodeURIComponent(vocabId)}`,
      ),
    ]);
    const wj = (await wr.json()) as { ok: boolean; items?: W[] };
    const tj = (await tr.json()) as {
      ok: boolean;
      byWord?: { wordId: string; wrongCount: number; attempts: number }[];
    };
    if (wj.ok && wj.items) setWords(wj.items);
    const m: Record<string, TestWordStat> = {};
    if (tj.ok && tj.byWord) {
      for (const r of tj.byWord) {
        m[String(r.wordId)] = { wrongCount: r.wrongCount, attempts: r.attempts };
      }
    }
    setTestStats(m);
    setLoaded(true);
  }, [vocabId, session]);

  useEffect(() => { void load(); }, [load]);

  const onScroll = useCallback(() => {
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      const el = scrollRef.current;
      if (!el || words.length === 0) return;
      const containerW = el.offsetWidth;
      const cardW = containerW - 2 * PEEK;
      const step = cardW + GAP;
      const newIdx = Math.round(el.scrollLeft / step);
      const clamped = Math.max(0, Math.min(words.length - 1, newIdx));
      setIdx(clamped);
    }, 60);
  }, [words.length]);

  const toggleFlip = (id: string) => {
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const w = words[idx];
  const tw = w ? testStats[w._id] : undefined;
  const wrong = tw?.wrongCount ?? 0;
  const attempts = tw?.attempts ?? 0;
  const progressPct = words.length > 1
    ? Math.round((idx / (words.length - 1)) * 100)
    : 100;

  if (!session || !vocabId) return null;

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "calc(100vh - var(--nav-height) - var(--nav-top))",
      margin: "0 -1rem",
      marginTop: "-1rem",
      marginBottom: "-2rem",
      padding: "0.5rem 0 0",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.35rem", flexShrink: 0, padding: "0 1rem" }}>
        <Link href={`/vocab/${vocabId}`} style={backBtnStyle} title="뒤로">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <h1 style={{ margin: 0, fontSize: "1.2rem", color: "var(--text-primary)", flex: 1 }}>Study</h1>
        {words.length > 0 && (
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{idx + 1} / {words.length}</span>
        )}
      </div>

      {!loaded ? (
        <p style={{ color: "var(--text-muted)", padding: "0 1rem" }}>로딩중입니다…</p>
      ) : words.length === 0 ? (
        <p style={{ color: "var(--text-secondary)", padding: "0 1rem" }}>단어가 없습니다.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          {/* Progress */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: "0.35rem", flexShrink: 0, padding: "0 1rem" }}>
            <div style={{ flex: 1, height: 3, borderRadius: 2, background: "var(--bg-elevated)", overflow: "hidden" }}>
              <div style={{ width: `${progressPct}%`, height: "100%", background: "var(--accent)", transition: "width 0.3s ease" }} />
            </div>
            <span style={{ fontSize: 11, color: wrong >= 3 ? "#fca5a5" : "var(--text-muted)", fontWeight: wrong >= 3 ? 700 : 400, flexShrink: 0 }}>
              오답 {wrong} / 테스트 {attempts}
            </span>
          </div>

          {/* Scroll-snap carousel */}
          <div
            ref={scrollRef}
            onScroll={onScroll}
            className="study-carousel"
            style={{
              flex: 1,
              display: "flex",
              overflowX: "auto",
              scrollSnapType: "x mandatory",
              WebkitOverflowScrolling: "touch",
              minHeight: 0,
            }}
          >
            {/* Left spacer — ensures first card can be centered */}
            <div style={{ flexShrink: 0, width: PEEK }} />

            {words.map((word, i) => {
              const isFlipped = flipped.has(word._id);
              const stat = testStats[word._id];
              const wc = stat?.wrongCount ?? 0;
              return (
                <div
                  key={word._id}
                  style={{
                    ...cardStyle,
                    scrollSnapAlign: "center",
                    width: `calc(100% - ${2 * PEEK}px)`,
                    minWidth: `calc(100% - ${2 * PEEK}px)`,
                    marginLeft: i === 0 ? 0 : GAP,
                  }}
                >
                  <div style={{ textAlign: "center", paddingTop: "1.5rem" }}>
                    <div style={{ fontSize: wc >= 3 ? "1.8rem" : "1.5rem", fontWeight: 600, color: isFlipped ? "var(--accent)" : "var(--text-primary)" }}>
                      {word.word}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleFlip(word._id)}
                      style={flipBtnStyle}
                    >
                      {isFlipped ? "접기" : "뜻·예문 보기"}
                    </button>
                  </div>

                  {isFlipped && (
                    <div style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)", marginTop: "1.5rem", borderTop: "1px solid var(--border)", paddingTop: "1rem", overflowY: "auto", flex: 1 }}>
                      <p><strong style={{ color: "var(--text-primary)" }}>설명</strong> {word.meaning}</p>
                      {word.example ? <p><strong style={{ color: "var(--text-primary)" }}>예문</strong> {word.example}</p> : null}
                      {word.synonyms.length ? <p><strong style={{ color: "var(--text-primary)" }}>동의어</strong> {word.synonyms.join(", ")}</p> : null}
                      {word.antonyms.length ? <p><strong style={{ color: "var(--text-primary)" }}>반의어</strong> {word.antonyms.join(", ")}</p> : null}
                      <a href={DICT(word.word)} target="_blank" rel="noreferrer" style={dictBtnStyle}>
                        사전 (Naver)
                      </a>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Right spacer — ensures last card can be centered */}
            <div style={{ flexShrink: 0, width: PEEK }} />
          </div>

          <p style={{ textAlign: "center", margin: "0.25rem 0 0.35rem", fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
            ← 좌우로 스와이프하여 이동 →
          </p>
        </div>
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

const cardStyle: CSSProperties = {
  flexShrink: 0,
  borderRadius: 14,
  padding: "1.5rem 1.25rem",
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const flipBtnStyle: CSSProperties = {
  marginTop: 24,
  fontSize: 13,
  padding: "0.4rem 0.85rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg-elevated)",
  color: "var(--text-secondary)",
  cursor: "pointer",
};

const dictBtnStyle: CSSProperties = {
  display: "inline-block",
  marginTop: 8,
  padding: "0.4rem 0.85rem",
  borderRadius: 999,
  background: "var(--accent-subtle)",
  color: "var(--accent)",
  fontWeight: 600,
  textDecoration: "none",
  fontSize: 13,
};
