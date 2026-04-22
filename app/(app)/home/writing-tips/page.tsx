"use client";

import type { CSSProperties } from "react";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loadSession } from "@/lib/session";
import { RssDetailModal, type ModalFeedData } from "@/components/RssDetailModal";

interface EgItem {
  title: string;
  snippet: string;
  fullContent: string;
  link: string;
  pubDate: string;
  category: string;
}

export default function WritingTipsPage() {
  const router = useRouter();
  const [items, setItems] = useState<EgItem[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selected, setSelected] = useState<EgItem | null>(null);

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/");
    }
  }, [router]);

  const loadPage = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/rss-feeds/dwt-page?page=${p}`);
      const json = (await res.json()) as {
        ok: boolean;
        items?: EgItem[];
      };
      if (json.ok && json.items) {
        if (json.items.length === 0) {
          setHasMore(false);
        } else {
          setItems((prev) => [...prev, ...json.items!]);
          setPage(p);
        }
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPage(1);
  }, [loadPage]);

  const modalFeed: ModalFeedData | null = selected
    ? {
        id: "eg",
        label: "English Grammar",
        category: selected.category,
        item: {
          title: selected.title,
          snippet: selected.snippet,
          fullContent: selected.fullContent,
          link: selected.link,
          image: "",
          audio: "",
          pubDate: selected.pubDate,
        },
      }
    : null;

  return (
    <div style={{ display: "grid", gap: "1rem", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Link href="/home" style={backBtn} title="뒤로">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <h1 style={{ margin: 0, fontSize: "1.2rem", color: "var(--text-primary)", flex: 1 }}>
          English Grammar
        </h1>
      </div>

      <div style={listWrap}>
        {items.map((item, i) => (
          <button
            key={item.link || i}
            type="button"
            onClick={() => setSelected(item)}
            style={articleRow}
          >
            <div style={articleMeta}>
              <span style={categoryBadge}>{item.category}</span>
              <span style={dateStyle}>
                {item.pubDate
                  ? new Date(item.pubDate).toLocaleDateString("ko-KR", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })
                  : ""}
              </span>
            </div>
            <div style={articleTitle}>{item.title}</div>
            <div style={articleSnippet}>{item.snippet}</div>
          </button>
        ))}
      </div>

      {loading && (
        <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
          불러오는 중…
        </p>
      )}

      {!loading && hasMore && items.length > 0 && (
        <button
          type="button"
          onClick={() => loadPage(page + 1)}
          style={moreBtn}
        >
          더 불러오기
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      {!hasMore && (
        <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
          마지막 페이지입니다
        </p>
      )}

      {modalFeed && (
        <RssDetailModal feed={modalFeed} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

const backBtn: CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  width: 32, height: 32, borderRadius: 8,
  background: "var(--bg-elevated)", border: "1px solid var(--border)",
  color: "var(--text-secondary)", textDecoration: "none",
};

const listWrap: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 1,
  borderRadius: 14,
  overflow: "hidden",
  border: "1px solid var(--border)",
};

const articleRow: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  padding: "0.85rem 1rem",
  background: "var(--bg-card)",
  border: "none",
  borderBottom: "1px solid var(--border)",
  cursor: "pointer",
  textAlign: "left",
  width: "100%",
};

const articleMeta: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const categoryBadge: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: "var(--accent)",
  background: "var(--accent-subtle)",
  padding: "2px 7px",
  borderRadius: 6,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

const dateStyle: CSSProperties = {
  fontSize: 11,
  color: "var(--text-muted)",
};

const articleTitle: CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "var(--text-primary)",
  lineHeight: 1.35,
};

const articleSnippet: CSSProperties = {
  fontSize: 12,
  color: "var(--text-secondary)",
  lineHeight: 1.4,
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

const moreBtn: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  width: "100%",
  padding: "0.75rem",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--bg-card)",
  color: "var(--text-secondary)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
