"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import { loadSession, type SessionUser } from "@/lib/session";
import { openFloatingChat } from "@/components/FloatingChat";
import { BouncingSmiley } from "@/components/BouncingSmiley";
import { WaveText } from "@/components/WaveText";

type W = {
  _id: string;
  word: string;
  meaning: string;
  example: string;
  synonyms: string[];
  antonyms: string[];
  wrongCount: number;
  attempts: number;
};

const DICT = (word: string) =>
  `https://en.dict.naver.com/#/search?range=all&query=${encodeURIComponent(word)}&from=nsearch`;

const PEEK_PCT = 15;
const GAP = 12;

export default function WrongWordsPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [words, setWords] = useState<W[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  const [aiCache, setAiCache] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const s = loadSession();
    if (!s) router.replace("/");
    else setSession(s);
  }, [router]);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const res = await fetch(
        `/api/wrong-words?phone=${encodeURIComponent(session.phone)}&userId=${encodeURIComponent(session.id)}&limit=50`,
      );
      const json = (await res.json()) as { ok: boolean; items?: W[] };
      if (json.ok && json.items) setWords(json.items);
      setLoaded(true);
    })();
  }, [session]);

  const onScroll = useCallback(() => {
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      const el = scrollRef.current;
      if (!el || words.length === 0) return;
      const containerH = el.offsetHeight;
      const peek = containerH * PEEK_PCT / 100;
      const cardH = containerH - 2 * peek;
      const step = cardH + GAP;
      const newIdx = Math.round(el.scrollTop / step);
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
  const progressPct = words.length > 1
    ? Math.round((idx / (words.length - 1)) * 100)
    : 100;

  if (!session) return null;

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
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.35rem", flexShrink: 0, padding: "0 1rem" }}>
        <Link href="/home" style={backBtnStyle} title="뒤로">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <h1 style={{ margin: 0, fontSize: "1.2rem", color: "var(--text-primary)", flex: 1 }}>많이 틀린 단어</h1>
        {words.length > 0 && (
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{idx + 1} / {words.length}</span>
        )}
      </div>

      {!loaded ? (
        <p style={{ color: "var(--text-muted)", padding: "0 1rem" }}>로딩중입니다…</p>
      ) : words.length === 0 ? (
        <p style={{ color: "var(--text-secondary)", padding: "0 1rem" }}>틀린 단어가 없습니다.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: "0.35rem", flexShrink: 0, padding: "0 1rem" }}>
            <div style={{ flex: 1, height: 3, borderRadius: 2, background: "var(--bg-elevated)", overflow: "hidden" }}>
              <div style={{ width: `${progressPct}%`, height: "100%", background: "var(--danger)", transition: "width 0.3s ease" }} />
            </div>
            {w && (
              <span style={{ fontSize: 11, color: "#fca5a5", fontWeight: 700, flexShrink: 0 }}>
                오답 {w.wrongCount} / 테스트 {w.attempts}
              </span>
            )}
          </div>

          <div
            ref={scrollRef}
            onScroll={onScroll}
            className="study-carousel"
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              overflowY: "auto",
              overflowX: "hidden",
              scrollSnapType: "y mandatory",
              WebkitOverflowScrolling: "touch",
              minHeight: 0,
            }}
          >
            <div style={{ flexShrink: 0, height: `${PEEK_PCT}%` }} />

            {words.map((word, i) => {
              const isFlipped = flipped.has(word._id);
              const correctCount = (word.attempts ?? 0) - (word.wrongCount ?? 0);
              const smileyScore = Math.max(-2, Math.min(2, correctCount - (word.wrongCount ?? 0)));
              return (
                <div
                  key={word._id}
                  style={{
                    ...cardStyle,
                    position: "relative",
                    overflow: "hidden",
                    scrollSnapAlign: "center",
                    width: "92%",
                    height: `${100 - 2 * PEEK_PCT}%`,
                    minHeight: `${100 - 2 * PEEK_PCT}%`,
                    marginTop: i === 0 ? 0 : GAP,
                  }}
                >
                  <BouncingSmiley score={smileyScore} seed={word._id} paused={isFlipped} />
                  <div style={{ position: "relative", zIndex: 1, textAlign: "center", paddingTop: "1.5rem" }}>
                    <div style={{ color: isFlipped ? "var(--danger)" : "var(--text-primary)" }}>
                      <WaveText text={word.word} active={isFlipped} fontSize="1.8rem" />
                    </div>
                    <span style={{ display: "inline-block", marginTop: 6, padding: "2px 10px", borderRadius: 999, background: "var(--danger-subtle)", color: "var(--danger)", fontSize: 11, fontWeight: 600 }}>
                      오답 {word.wrongCount}회
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleFlip(word._id)}
                      style={flipBtnStyle}
                    >
                      {isFlipped ? "접기" : "뜻·예문 보기"}
                    </button>
                  </div>

                  {isFlipped && (
                    <div style={{ position: "relative", zIndex: 1, fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)", marginTop: "1.5rem", borderTop: "1px solid var(--border)", paddingTop: "1rem", overflowY: "auto", flex: 1 }}>
                      <p><strong style={{ color: "var(--text-primary)" }}>설명</strong> {word.meaning}</p>
                      {word.example ? <p><strong style={{ color: "var(--text-primary)" }}>예문</strong> {word.example}</p> : null}
                      {word.synonyms.length ? <p><strong style={{ color: "var(--text-primary)" }}>동의어</strong> {word.synonyms.join(", ")}</p> : null}
                      {word.antonyms.length ? <p><strong style={{ color: "var(--text-primary)" }}>반의어</strong> {word.antonyms.join(", ")}</p> : null}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                        <a href={DICT(word.word)} target="_blank" rel="noreferrer" style={dictBtnStyle}>
                          사전 (Naver)
                        </a>
                        <button
                          type="button"
                          disabled={aiLoading === word._id}
                          onClick={async () => {
                            setAiLoading(word._id);
                            try {
                              const res = await fetch(`/api/ai-cache?word=${encodeURIComponent(word.word)}`);
                              const j = (await res.json()) as { ok: boolean; hit?: boolean; answer?: string };
                              if (j.ok && j.hit && j.answer) {
                                setAiCache((prev) => ({ ...prev, [word._id]: j.answer! }));
                                setAiLoading(null);
                                return;
                              }
                            } catch { /* fallback */ }
                            setAiLoading(null);
                            const prompt = `${word.word} 에 대해서 더 자세히 설명해줘`;
                            openFloatingChat(prompt, word.word);
                          }}
                          style={{ ...aiBtnStyle, opacity: aiLoading === word._id ? 0.6 : 1 }}
                        >
                          <svg width="14" height="14" viewBox="0 0 64 64" fill="none" aria-hidden style={{ flexShrink: 0 }}>
                            <circle cx="32" cy="32" r="30" fill="currentColor" />
                            <circle cx="23" cy="28" r="4.5" fill="rgba(0,0,0,0.55)" />
                            <circle cx="41" cy="28" r="4.5" fill="rgba(0,0,0,0.55)" />
                            <circle cx="24.5" cy="26.5" r="1.5" fill="rgba(255,255,255,0.5)" />
                            <circle cx="42.5" cy="26.5" r="1.5" fill="rgba(255,255,255,0.5)" />
                            <line x1="24" y1="40" x2="40" y2="40" stroke="rgba(0,0,0,0.55)" strokeWidth="2.5" strokeLinecap="round" />
                          </svg>
                          {aiLoading === word._id ? "확인 중…" : "AI에게 질문"}
                        </button>
                      </div>
                      {aiCache[word._id] && (
                        <div style={aiAnswerWrap}>
                          <div style={aiAnswerHeader}>
                            <span style={{ fontSize: 14 }}>🤖</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>AI 답변</span>
                            <div style={{ flex: 1 }} />
                            <button onClick={() => setAiCache((prev) => { const n = { ...prev }; delete n[word._id]; return n; })} style={aiAnswerCloseBtn}>✕</button>
                          </div>
                          <div className="chat-md" style={aiAnswerBody}>
                            <Markdown>{aiCache[word._id]}</Markdown>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <div style={{ flexShrink: 0, height: `${PEEK_PCT}%` }} />
          </div>
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
  borderRadius: "var(--radius-lg)",
  padding: "1.5rem 1.25rem",
  background: "var(--bg-card)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const flipBtnStyle: CSSProperties = {
  display: "block",
  marginTop: 24,
  fontSize: 13,
  padding: "0.4rem 0.85rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg-elevated)",
  color: "var(--text-secondary)",
  cursor: "pointer",
  marginLeft: "auto",
  marginRight: "auto",
};

const dictBtnStyle: CSSProperties = {
  display: "inline-block",
  padding: "0.4rem 0.85rem",
  borderRadius: 999,
  background: "var(--accent-subtle)",
  color: "var(--accent)",
  fontWeight: 600,
  textDecoration: "none",
  fontSize: 13,
};

const aiBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "0.4rem 0.85rem",
  borderRadius: 999,
  background: "var(--accent)",
  color: "#fff",
  fontWeight: 600,
  fontSize: 13,
  border: "none",
  cursor: "pointer",
};

const aiAnswerWrap: CSSProperties = {
  marginTop: 12,
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--accent)",
  background: "var(--accent-subtle)",
  overflow: "hidden",
};

const aiAnswerHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 12px",
  borderBottom: "1px solid var(--border)",
  background: "var(--bg-elevated)",
};

const aiAnswerCloseBtn: CSSProperties = {
  background: "none",
  border: "none",
  fontSize: 14,
  color: "var(--text-muted)",
  cursor: "pointer",
  padding: "2px 6px",
};

const aiAnswerBody: CSSProperties = {
  padding: "10px 14px",
  fontSize: 13,
  lineHeight: 1.7,
  color: "var(--text-secondary)",
  maxHeight: 250,
  overflowY: "auto",
};
