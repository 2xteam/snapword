"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";

export interface ModalFeedData {
  id: string;
  label: string;
  item: {
    title: string;
    snippet: string;
    fullContent: string;
    link: string;
    image: string;
    audio: string;
    pubDate: string;
  } | null;
}

const CARD_ICONS: Record<string, string> = {
  eg: "📝",
  wotd: "📖",
};

export function RssDetailModal({
  feed,
  onClose,
}: {
  feed: ModalFeedData;
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const icon = CARD_ICONS[feed.id] ?? "📰";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  if (!feed.item) return null;

  return (
    <div
      ref={overlayRef}
      style={overlay}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div style={modal}>
        {/* 헤더 - sticky */}
        <div style={header}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
            <span style={{ fontSize: 20 }}>{icon}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>
              {feed.label}
            </span>
          </div>
          <button onClick={onClose} style={closeBtn} aria-label="닫기">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* 스크롤 본문 */}
        <div style={modalBody}>
          <h2 style={titleStyle}>{feed.item.title}</h2>

          {feed.item.pubDate && (
            <div style={dateStyle}>
              {new Date(feed.item.pubDate).toLocaleDateString("ko-KR", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
          )}

          {feed.item.audio && (
            <div style={audioWrap}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M12 3v18M8 8v8M4 11v2M16 6v12M20 9v6" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>
                  Listen
                </span>
              </div>
              <audio controls preload="none" style={audioPlayer}>
                <source src={feed.item.audio} type="audio/mpeg" />
              </audio>
            </div>
          )}

          {feed.item.image && (
            <div style={imageWrap}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={feed.item.image} alt="" style={imageStyle} />
            </div>
          )}

          <div style={bodyContentStyle}>
            {renderContent(feed.item.fullContent)}
          </div>

          <a
            href={feed.item.link}
            target="_blank"
            rel="noopener noreferrer"
            style={linkBtnStyle}
          >
            원문 보기 ↗
          </a>
        </div>
      </div>
    </div>
  );
}

function renderContent(text: string) {
  const lines = text.split("\n").filter((l) => l.trim() !== "");

  // 번호 리스트 패턴 감지: "1." 로 시작하는 줄이 3개 이상
  const numbered = lines.filter((l) => /^\d+\.\s*$/.test(l.trim()));
  if (numbered.length >= 3) {
    return renderNumberedList(lines);
  }

  return lines.map((line, i) => (
    <p key={i} style={{ margin: "0 0 0.6em" }}>{line}</p>
  ));
}

function renderNumberedList(lines: string[]) {
  const items: { num: string; word: string; def: string }[] = [];
  let headerLines: string[] = [];
  let i = 0;

  // 헤더 줄 스킵 (No. / Item / Definition 등)
  while (i < lines.length && !/^\d+\.\s*$/.test(lines[i].trim())) {
    headerLines.push(lines[i]);
    i++;
  }

  while (i < lines.length) {
    const numMatch = lines[i].trim().match(/^(\d+)\.\s*$/);
    if (numMatch) {
      const num = numMatch[1];
      const word = lines[i + 1]?.trim() ?? "";
      const def = lines[i + 2]?.trim() ?? "";
      items.push({ num, word, def });
      i += 3;
    } else {
      i++;
    }
  }

  if (items.length === 0) {
    return [...headerLines, ...lines].map((l, idx) => (
      <p key={idx} style={{ margin: "0 0 0.6em" }}>{l}</p>
    ));
  }

  return (
    <>
      {headerLines.length > 0 && headerLines.some((h) => !/^(No\.|Item|Definition)\s*$/i.test(h.trim())) && (
        headerLines.map((h, idx) => (
          <p key={`h-${idx}`} style={{ margin: "0 0 0.6em" }}>{h}</p>
        ))
      )}
      <div style={listGrid}>
        {items.map((it) => (
          <div key={it.num} style={listItem}>
            <span style={listNum}>{it.num}</span>
            <div style={{ flex: 1 }}>
              <div style={listWord}>{it.word}</div>
              {it.def && <div style={listDef}>{it.def}</div>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

const listGrid: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const listItem: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  padding: "8px 10px",
  borderRadius: 10,
  background: "var(--bg-elevated, #F9FAFB)",
};

const listNum: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "var(--text-muted, #9CA3AF)",
  minWidth: 22,
  textAlign: "right",
  flexShrink: 0,
  paddingTop: 2,
};

const listWord: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "var(--text-primary, #111)",
  lineHeight: 1.3,
};

const listDef: CSSProperties = {
  fontSize: 12,
  color: "var(--text-secondary, #6B7280)",
  lineHeight: 1.4,
  marginTop: 1,
};

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

const header: CSSProperties = {
  display: "flex",
  alignItems: "center",
  padding: "1.2rem 1.3rem 0.7rem",
  flexShrink: 0,
  background: "var(--bg-card, #fff)",
};

const modalBody: CSSProperties = {
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

const titleStyle: CSSProperties = {
  margin: "0 0 4px",
  fontSize: 18,
  fontWeight: 700,
  color: "var(--text-primary, #111)",
  lineHeight: 1.35,
};

const dateStyle: CSSProperties = {
  fontSize: 12,
  color: "var(--text-muted, #9CA3AF)",
  marginBottom: 14,
};

const audioWrap: CSSProperties = {
  background: "var(--bg-elevated, #F9FAFB)",
  borderRadius: 12,
  padding: "10px 12px",
  marginBottom: 14,
};

const audioPlayer: CSSProperties = {
  width: "100%",
  height: 36,
  borderRadius: 8,
};

const imageWrap: CSSProperties = {
  borderRadius: 12,
  overflow: "hidden",
  marginBottom: 14,
};

const imageStyle: CSSProperties = {
  width: "100%",
  height: "auto",
  display: "block",
};

const bodyContentStyle: CSSProperties = {
  fontSize: 14,
  lineHeight: 1.7,
  color: "var(--text-secondary, #374151)",
  marginBottom: 16,
  wordBreak: "keep-all",
};

const linkBtnStyle: CSSProperties = {
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
  transition: "background 0.15s",
};
