"use client";

import type { CSSProperties } from "react";
import { useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { RssDetailModal } from "./RssDetailModal";

export interface EgItem {
  title: string;
  snippet: string;
  fullContent: string;
  link: string;
  pubDate: string;
  category: string;
}

const CARD_W = 200;
const CARD_GAP = 12;

export function EgArticleList({
  items,
  limit = 10,
}: {
  items: EgItem[];
  limit?: number;
}) {
  const [selected, setSelected] = useState<EgItem | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const visible = items.slice(0, limit);

  /* drag-scroll for desktop */
  const isDrag = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const onDown = useCallback((e: React.MouseEvent) => {
    isDrag.current = true;
    startX.current = e.pageX - (scrollRef.current?.offsetLeft ?? 0);
    scrollLeft.current = scrollRef.current?.scrollLeft ?? 0;
  }, []);

  const onMove = useCallback((e: React.MouseEvent) => {
    if (!isDrag.current || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    scrollRef.current.scrollLeft = scrollLeft.current - (x - startX.current);
  }, []);

  const onUp = useCallback(() => {
    isDrag.current = false;
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => { isDrag.current = false; };
    el.addEventListener("mouseleave", handler);
    return () => el.removeEventListener("mouseleave", handler);
  }, []);

  if (visible.length === 0) return null;

  return (
    <>
      <section style={{ minWidth: 0, overflow: "hidden" }}>
        <h2 style={sectionTitle}>더 공부해 볼까?</h2>
        <div
          ref={scrollRef}
          style={scrollContainer}
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
        >
          {visible.map((item, i) => {
            const dateStr = item.pubDate
              ? new Date(item.pubDate).toLocaleDateString("ko-KR", {
                  month: "short",
                  day: "numeric",
                })
              : "";

            return (
              <button
                key={item.link || i}
                type="button"
                onClick={() => setSelected(item)}
                style={cardStyle}
              >
                <span style={categoryBadge}>{item.category}</span>
                <div style={cardTitle}>{item.title}</div>
                <div style={cardSnippet}>{item.snippet}</div>
                <div style={cardDate}>{dateStr}</div>
              </button>
            );
          })}

          {/* 더보기 카드 */}
          <Link href="/home/writing-tips" style={moreCard}>
            <div style={moreIcon}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span style={moreText}>더보기</span>
          </Link>
        </div>
      </section>

      {selected && (
        <RssDetailModal
          feed={{
            id: "eg",
            label: "English Grammar",
            item: {
              title: selected.title,
              snippet: selected.snippet,
              fullContent: selected.fullContent,
              link: selected.link,
              image: "",
              audio: "",
              pubDate: selected.pubDate,
            },
          }}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

const sectionTitle: CSSProperties = {
  margin: "0 0 0.6rem",
  fontSize: "1rem",
  color: "var(--text-primary)",
};

const scrollContainer: CSSProperties = {
  display: "flex",
  gap: CARD_GAP,
  overflowX: "auto",
  scrollSnapType: "x mandatory",
  WebkitOverflowScrolling: "touch",
  paddingBottom: 4,
  msOverflowStyle: "none",
  scrollbarWidth: "none",
  maxWidth: "100%",
};

const cardStyle: CSSProperties = {
  flex: `0 0 ${CARD_W}px`,
  minHeight: 180,
  scrollSnapAlign: "start",
  display: "flex",
  flexDirection: "column",
  gap: 6,
  padding: "1rem",
  borderRadius: 16,
  border: "1px solid var(--border)",
  background: "var(--bg-card)",
  cursor: "pointer",
  textAlign: "left",
  transition: "box-shadow 0.15s",
};

const categoryBadge: CSSProperties = {
  alignSelf: "flex-start",
  fontSize: 10,
  fontWeight: 700,
  color: "var(--accent)",
  background: "var(--accent-subtle)",
  padding: "2px 7px",
  borderRadius: 6,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

const cardTitle: CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "var(--text-primary)",
  lineHeight: 1.35,
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

const cardSnippet: CSSProperties = {
  flex: 1,
  fontSize: 12,
  color: "var(--text-secondary)",
  lineHeight: 1.4,
  display: "-webkit-box",
  WebkitLineClamp: 3,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

const cardDate: CSSProperties = {
  fontSize: 10,
  color: "var(--text-muted)",
  marginTop: "auto",
};

const moreCard: CSSProperties = {
  flex: `0 0 ${CARD_W * 0.6}px`,
  minHeight: 180,
  scrollSnapAlign: "start",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  borderRadius: 16,
  border: "1px dashed var(--border)",
  background: "var(--bg-elevated, var(--bg-card))",
  textDecoration: "none",
  color: "var(--text-secondary)",
  transition: "background 0.12s",
};

const moreIcon: CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: "50%",
  background: "var(--accent-subtle)",
  color: "var(--accent)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const moreText: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
};
