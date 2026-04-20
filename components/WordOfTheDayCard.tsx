"use client";

import type { CSSProperties } from "react";
import { useState, useEffect, useRef, useCallback } from "react";

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

function WotdModal({ data, onClose }: { data: WotdData; onClose: () => void }) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [handleClose]);

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

          <a
            href={data.link}
            target="_blank"
            rel="noopener noreferrer"
            style={modalLink}
          >
            Merriam-Webster에서 보기 ↗
          </a>
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
  gap: 4,
  fontSize: 13,
  fontWeight: 600,
  color: "var(--accent)",
  textDecoration: "none",
  padding: "8px 16px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--accent-subtle)",
};
