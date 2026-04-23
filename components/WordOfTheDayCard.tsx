"use client";

import type { CSSProperties } from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import Markdown from "react-markdown";
import { openFloatingChat } from "./FloatingChat";
import { showToast } from "./Toast";
import { loadSession } from "@/lib/session";

export interface WotdData {
  word: string;
  pronunciation: string;
  partOfSpeech: string;
  definition: string;
  example: string;
  didYouKnow: string;
  link: string;
  pubDate: string;
}

export function WordOfTheDayCard({ data }: { data: WotdData }) {
  const [open, setOpen] = useState(false);

  const dateStr = data.pubDate
    ? new Date(data.pubDate).toLocaleDateString("ko-KR", {
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <>
      <section>
        <h2 style={sectionTitle}>오늘의 Word!</h2>
        <button type="button" onClick={() => setOpen(true)} style={card}>
          <div style={cardLeft}>
            <span style={wordStyle}>{data.word}</span>
            {data.pronunciation && (
              <span style={pronStyle}>{data.pronunciation}</span>
            )}
            {data.partOfSpeech && (
              <span style={posStyle}>{data.partOfSpeech}</span>
            )}
          </div>
          <div style={cardRight}>
            <div style={defStyle}>{data.definition}</div>
            <div style={dateStyle}>{dateStr}</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, opacity: 0.5 }}>
            <path d="M9 6l6 6-6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </section>

      {open && <WotdModal data={data} onClose={() => setOpen(false)} />}
    </>
  );
}

type DeckOption = { _id: string; name: string };

function WotdModal({ data, onClose }: { data: WotdData; onClose: () => void }) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const handleClose = useCallback(() => onClose(), [onClose]);

  const [showDeckPicker, setShowDeckPicker] = useState(false);
  const [decks, setDecks] = useState<DeckOption[]>([]);
  const [decksLoading, setDecksLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  const [cachedAnswer, setCachedAnswer] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [handleClose]);

  const loadDecks = useCallback(async () => {
    setDecksLoading(true);
    try {
      const s = loadSession();
      if (!s) return;
      const res = await fetch(`/api/vocabularies?phone=${encodeURIComponent(s.phone)}`);
      const j = (await res.json()) as { ok: boolean; items?: DeckOption[] };
      if (j.ok && j.items) setDecks(j.items);
    } catch { /* ignore */ } finally { setDecksLoading(false); }
  }, []);

  const handleAddToDeck = useCallback(async (deckId: string, deckName: string) => {
    const s = loadSession();
    if (!s) return;
    setAdding(true);
    try {
      const res = await fetch("/api/words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vocabId: deckId,
          phone: s.phone,
          word: data.word,
          meaning: data.definition,
          example: data.example || "",
        }),
      });
      const j = (await res.json()) as { ok: boolean; duplicate?: boolean; message?: string };
      if (j.ok && j.duplicate) {
        showToast(j.message ?? "이미 단어장에 있는 단어입니다", "warn");
      } else if (j.ok) {
        showToast(`"${deckName}"에 추가되었습니다`);
      } else {
        showToast("단어 추가에 실패했습니다", "err");
      }
    } catch {
      showToast("네트워크 오류로 추가에 실패했습니다", "err");
    }
    setAdding(false);
    setShowDeckPicker(false);
  }, [data]);

  return (
    <div
      ref={overlayRef}
      style={overlay}
      onClick={(e) => { if (e.target === overlayRef.current) handleClose(); }}
    >
      <div style={modal}>
        <div style={modalHeader}>
          <span style={{ fontSize: 20 }}>📖</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>
            Word of the Day
          </span>
          <div style={{ flex: 1 }} />
          <button onClick={handleClose} style={closeBtn} aria-label="닫기">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div style={modalScroll}>
          <div style={modalWord}>{data.word}</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
            {data.pronunciation && (
              <span style={{ fontSize: 14, color: "var(--text-secondary)", fontStyle: "italic" }}>
                {data.pronunciation}
              </span>
            )}
            {data.partOfSpeech && (
              <span style={modalPos}>{data.partOfSpeech}</span>
            )}
          </div>

          <div style={modalSection}>
            <div style={modalLabel}>Definition</div>
            <p style={modalBodyText}>{data.definition}</p>
          </div>

          {data.example && (
            <div style={modalSection}>
              <div style={modalLabel}>Example</div>
              <p style={{ ...modalBodyText, fontStyle: "italic", color: "var(--text-secondary)" }}>
                {data.example}
              </p>
            </div>
          )}

          {data.didYouKnow && (
            <div style={modalSection}>
              <div style={modalLabel}>Did you know?</div>
              <p style={modalBodyText}>{data.didYouKnow}</p>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a href={data.link} target="_blank" rel="noopener noreferrer" style={modalLink}>
              Merriam-Webster에서 보기 ↗
            </a>
            <button
              type="button"
              disabled={aiLoading}
              onClick={async () => {
                setAiLoading(true);
                try {
                  const res = await fetch(`/api/ai-cache?word=${encodeURIComponent(data.word)}`);
                  const j = (await res.json()) as { ok: boolean; hit?: boolean; answer?: string };
                  if (j.ok && j.hit && j.answer) {
                    setCachedAnswer(j.answer);
                    setAiLoading(false);
                    return;
                  }
                } catch { /* 캐시 조회 실패 시 채팅으로 fallback */ }
                setAiLoading(false);
                const prompt = `오늘의 단어 "${data.word}" (${data.partOfSpeech})에 대해 더 알려줘! 뜻: ${data.definition}`;
                handleClose();
                openFloatingChat(prompt, data.word);
              }}
              style={{ ...askAiBtn, opacity: aiLoading ? 0.6 : 1 }}
            >
              <RobotIcon />
              {aiLoading ? "확인 중…" : "AI에게 질문"}
            </button>
            <button
              type="button"
              onClick={() => { setShowDeckPicker(true); loadDecks(); }}
              style={addVocabBtn}
            >
              📚 단어장에 추가
            </button>
          </div>

          {/* 캐시된 AI 답변 */}
          {cachedAnswer && (
            <div style={cachedAnswerWrap}>
              <div style={cachedAnswerHeader}>
                <span style={{ fontSize: 14 }}>🤖</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>AI 답변</span>
                <div style={{ flex: 1 }} />
                <button onClick={() => setCachedAnswer(null)} style={cachedAnswerClose}>✕</button>
              </div>
              <div className="chat-md" style={cachedAnswerBody}>
                <Markdown>{cachedAnswer}</Markdown>
              </div>
            </div>
          )}

          {/* 단어장 선택 UI */}
          {showDeckPicker && (
            <div style={deckPickerWrap}>
              <div style={deckPickerHeader}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                  단어장 선택
                </span>
                <button onClick={() => setShowDeckPicker(false)} style={deckPickerClose}>✕</button>
              </div>
              {decksLoading ? (
                <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: 12 }}>
                  불러오는 중…
                </p>
              ) : decks.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: 12 }}>
                  단어장이 없습니다
                </p>
              ) : (
                <div style={deckList}>
                  {decks.map((d) => (
                    <button
                      key={d._id}
                      type="button"
                      disabled={adding}
                      onClick={() => handleAddToDeck(d._id, d.name)}
                      style={{ ...deckItem, opacity: adding ? 0.5 : 1 }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="var(--accent)" strokeWidth="1.4" strokeLinejoin="round" />
                      </svg>
                      <span style={{ flex: 1, textAlign: "left", fontSize: 13, color: "var(--text-primary)" }}>{d.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const sectionTitle: CSSProperties = {
  margin: "0 0 0.6rem",
  fontSize: "1rem",
  color: "var(--text-primary)",
};

const card: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  width: "100%",
  padding: "1rem 1.1rem",
  borderRadius: 16,
  border: "none",
  background: "var(--accent)",
  color: "#fff",
  cursor: "pointer",
  textAlign: "left",
};

const cardLeft: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  flexShrink: 0,
  minWidth: 0,
};

const wordStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 800,
  lineHeight: 1.15,
};

const pronStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  opacity: 0.8,
  fontStyle: "italic",
};

const posStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  opacity: 0.6,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const cardRight: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const defStyle: CSSProperties = {
  fontSize: 12,
  lineHeight: 1.45,
  opacity: 0.92,
  display: "-webkit-box",
  WebkitLineClamp: 3,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

const dateStyle: CSSProperties = {
  fontSize: 10,
  opacity: 0.55,
};

/* ── Modal ── */

const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  background: "rgba(0,0,0,0.45)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
  animation: "rss-modal-overlay-in 0.2s ease",
};

const modal: CSSProperties = {
  width: "100%",
  maxWidth: 480,
  maxHeight: "85vh",
  background: "var(--bg-card, #fff)",
  borderRadius: "20px 20px 0 0",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  animation: "rss-modal-slide-up 0.25s ease",
};

const modalHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "1.2rem 1.3rem 0.7rem",
  flexShrink: 0,
  background: "var(--bg-card, #fff)",
};

const modalScroll: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "0.8rem 1.3rem 2rem",
};

const closeBtn: CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "var(--text-muted, #9CA3AF)",
  padding: 4,
  borderRadius: 8,
  display: "flex",
};

const modalWord: CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  color: "var(--text-primary)",
  marginBottom: 2,
};

const modalPos: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--accent)",
  background: "var(--accent-subtle)",
  padding: "2px 8px",
  borderRadius: 6,
  textTransform: "uppercase",
};

const modalSection: CSSProperties = {
  marginBottom: 14,
};

const modalLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "var(--accent)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  marginBottom: 4,
};

const modalBodyText: CSSProperties = {
  fontSize: 14,
  lineHeight: 1.65,
  color: "var(--text-secondary, #374151)",
  margin: 0,
};

const modalLink: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  fontSize: 13,
  fontWeight: 600,
  color: "var(--accent)",
  textDecoration: "none",
  padding: "8px 16px",
  borderRadius: 999,
  border: "none",
  background: "var(--accent-subtle)",
};

const askAiBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  fontSize: 13,
  fontWeight: 600,
  color: "var(--chat-fab-fg)",
  padding: "8px 16px",
  borderRadius: 999,
  border: "none",
  background: "var(--chat-fab-bg)",
  cursor: "pointer",
};

const addVocabBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  fontSize: 13,
  fontWeight: 600,
  color: "var(--accent)",
  padding: "8px 16px",
  borderRadius: 999,
  border: "none",
  background: "var(--accent-subtle)",
  cursor: "pointer",
};

const deckPickerWrap: CSSProperties = {
  marginTop: 14,
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--bg-elevated)",
  overflow: "hidden",
};

const deckPickerHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "8px 12px",
  borderBottom: "1px solid var(--border)",
};

const deckPickerClose: CSSProperties = {
  background: "none",
  border: "none",
  fontSize: 14,
  color: "var(--text-muted)",
  cursor: "pointer",
  padding: "2px 6px",
};

const deckList: CSSProperties = {
  maxHeight: 200,
  overflowY: "auto",
};

const deckItem: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  padding: "10px 12px",
  border: "none",
  borderBottom: "1px solid var(--border)",
  background: "transparent",
  cursor: "pointer",
  transition: "background 0.1s",
};


const cachedAnswerWrap: CSSProperties = {
  marginTop: 14,
  borderRadius: 12,
  border: "1px solid var(--accent)",
  background: "var(--accent-subtle)",
  overflow: "hidden",
};

const cachedAnswerHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 12px",
  borderBottom: "1px solid var(--border)",
  background: "var(--bg-elevated)",
};

const cachedAnswerClose: CSSProperties = {
  background: "none",
  border: "none",
  fontSize: 14,
  color: "var(--text-muted)",
  cursor: "pointer",
  padding: "2px 6px",
};

const cachedAnswerBody: CSSProperties = {
  padding: "10px 14px",
  fontSize: 13,
  lineHeight: 1.7,
  color: "var(--text-secondary)",
  maxHeight: 300,
  overflowY: "auto",
};

function RobotIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden style={{ flexShrink: 0 }}>
      <rect x="4" y="8" width="16" height="12" rx="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="9" cy="14" r="1.5" fill="currentColor" />
      <circle cx="15" cy="14" r="1.5" fill="currentColor" />
      <path d="M12 4v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="3.5" r="1.5" fill="currentColor" />
    </svg>
  );
}
