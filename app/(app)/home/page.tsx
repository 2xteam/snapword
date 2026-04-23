"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { loadSession, type SessionUser } from "@/lib/session";
import { useDragScroll } from "@/lib/useDragScroll";
import { WordOfTheDayCard, type WotdData } from "@/components/WordOfTheDayCard";
import { EgArticleList, type EgItem } from "@/components/DwtArticleList";

type FolderRow = { _id: string; name: string };
type DeckRow = { _id: string; name: string };

export default function HomePage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [decks, setDecks] = useState<DeckRow[]>([]);
  const [hasTests, setHasTests] = useState(false);
  const [wrongCount, setWrongCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [wotd, setWotd] = useState<WotdData | null>(null);
  const [rssLoading, setRssLoading] = useState(true);
  const [egItems, setEgItems] = useState<EgItem[]>([]);
  const deckDragRef = useDragScroll();
  const folderDragRef = useDragScroll();

  useEffect(() => {
    const s = loadSession();
    if (!s) { router.replace("/"); return; }
    setSession(s);
  }, [router]);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const [fRes, vRes, wRes] = await Promise.all([
        fetch(`/api/folders?phone=${encodeURIComponent(session.phone)}&parentId=`),
        fetch(`/api/vocabularies?phone=${encodeURIComponent(session.phone)}`),
        fetch(`/api/wrong-words?phone=${encodeURIComponent(session.phone)}&userId=${encodeURIComponent(session.id)}&limit=50`),
      ]);
      const fj = (await fRes.json()) as { ok: boolean; items?: FolderRow[] };
      const vj = (await vRes.json()) as { ok: boolean; items?: DeckRow[] };
      const wj = (await wRes.json()) as { ok: boolean; items?: unknown[]; hasTests?: boolean };
      if (fj.ok && fj.items) setFolders(fj.items.slice(0, 10));
      if (vj.ok && vj.items) setDecks(vj.items.slice(0, 10));
      if (wj.ok) {
        setHasTests(!!wj.hasTests);
        setWrongCount(wj.items?.length ?? 0);
      }
      setLoaded(true);
    })();
  }, [session]);

  useEffect(() => {
    fetch("/api/rss-feeds")
      .then((r) => r.json())
      .then((j: { ok: boolean; wotd?: WotdData; eg?: EgItem[] }) => {
        if (j.ok) {
          if (j.wotd) setWotd(j.wotd);
          if (j.eg) setEgItems(j.eg);
        }
      })
      .catch(() => {})
      .finally(() => setRssLoading(false));
  }, []);

  if (!session) return null;

  return (
    <div style={{ display: "grid", gap: "1.5rem", minWidth: 0 }}>
      {/* Word of the Day */}
      {rssLoading ? (
        <section>
          <h2 style={sectionTitle}>오늘의 Word!</h2>
          <div style={wotdSkeletonBox}>
            <div style={{ width: 100, height: 18, borderRadius: 6, background: "var(--border)" }} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ width: "80%", height: 12, borderRadius: 4, background: "var(--border)" }} />
              <div style={{ width: "60%", height: 12, borderRadius: 4, background: "var(--border)" }} />
            </div>
          </div>
        </section>
      ) : wotd ? (
        <WordOfTheDayCard data={wotd} />
      ) : null}

      {!loaded ? (
        <>
          <ThumbRowSkeleton title="최근 단어장" />
          <ThumbRowSkeleton title="최근 폴더" />
          <ReviewSkeleton />
        </>
      ) : (
        <>
          {/* 최근 단어장 */}
          <section data-guide="deck-section" style={{ minWidth: 0, overflow: "hidden" }}>
            <h2 style={sectionTitle}>최근 단어장</h2>
            {decks.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>단어장이 없습니다.</p>
            ) : (
              <div ref={deckDragRef} className="home-scroll-row" style={scrollRow}>
                {decks.map((d) => (
                  <Link key={d._id} href={`/vocab/${d._id}`} style={thumbCard}>
                    <FileIcon />
                    <span style={thumbLabel}>{d.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* 최근 폴더 */}
          <section data-guide="folder-section" style={{ minWidth: 0, overflow: "hidden" }}>
            <h2 style={sectionTitle}>최근 폴더</h2>
            {folders.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>폴더가 없습니다.</p>
            ) : (
              <div ref={folderDragRef} className="home-scroll-row" style={scrollRow}>
                {folders.map((f) => (
                  <Link key={f._id} href={`/folders/${f._id}`} style={thumbCard}>
                    <FolderIcon />
                    <span style={thumbLabel}>{f.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* 많이 틀린 단어 복습 */}
          <section data-guide="review-section">
            <div style={{ display: "flex", alignItems: "center", marginBottom: "0.6rem" }}>
              <h2 style={{ margin: 0, fontSize: "1rem", color: "var(--text-primary)", flex: 1 }}>복습</h2>
            </div>
            <Link
              href={hasTests && wrongCount > 0 ? "/home/wrong-words" : "#"}
              onClick={(e) => { if (!hasTests || wrongCount === 0) e.preventDefault(); }}
              style={{
                ...reviewBtn,
                opacity: hasTests && wrongCount > 0 ? 1 : 0.45,
                cursor: hasTests && wrongCount > 0 ? "pointer" : "not-allowed",
              }}
            >
              <span style={{ fontSize: 22, flexShrink: 0, lineHeight: 1 }}>📝</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>
                  많이 틀린 단어 보기
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                  {!hasTests
                    ? "아직 시험을 본 적이 없습니다"
                    : wrongCount === 0
                      ? "틀린 단어가 없습니다"
                      : `${wrongCount}개의 단어를 복습하세요`}
                </div>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <path d="M9 6l6 6-6 6" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </section>

          {/* 최하단: English Grammar */}
          {rssLoading ? (
            <EgCarouselSkeleton />
          ) : egItems.length > 0 ? (
            <EgArticleList items={egItems} limit={5} />
          ) : null}
        </>
      )}
    </div>
  );
}

function ThumbRowSkeleton({ title }: { title: string }) {
  return (
    <section style={{ minWidth: 0, overflow: "hidden" }}>
      <h2 style={sectionTitle}>{title}</h2>
      <div className="home-scroll-row" style={{ ...scrollRow, animation: "pulse 1.5s ease-in-out infinite" }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ ...thumbCard, border: "1px solid var(--border)", background: "var(--bg-elevated)", pointerEvents: "none" }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: "var(--border)" }} />
            <div style={{ width: "70%", height: 10, borderRadius: 4, background: "var(--border)" }} />
          </div>
        ))}
      </div>
    </section>
  );
}

function ReviewSkeleton() {
  return (
    <section>
      <h2 style={{ ...sectionTitle, marginBottom: "0.6rem" }}>복습</h2>
      <div style={{ ...reviewBtn, animation: "pulse 1.5s ease-in-out infinite", pointerEvents: "none" }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--border)", flexShrink: 0 }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ width: "55%", height: 14, borderRadius: 4, background: "var(--border)" }} />
          <div style={{ width: "85%", height: 11, borderRadius: 4, background: "var(--border)" }} />
        </div>
        <div style={{ width: 18, height: 18, borderRadius: 4, background: "var(--border)", flexShrink: 0 }} />
      </div>
    </section>
  );
}

function EgCarouselSkeleton() {
  return (
    <section style={{ minWidth: 0, overflow: "hidden" }}>
      <h2 style={sectionTitle}>더 공부해 볼까?</h2>
      <div className="home-scroll-row" style={{ ...scrollRow, maxWidth: "100%", animation: "pulse 1.5s ease-in-out infinite" }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              flexShrink: 0,
              width: 200,
              minWidth: 200,
              height: 140,
              borderRadius: 14,
              border: "1px solid var(--border)",
              background: "var(--bg-elevated)",
              padding: "0.75rem",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ width: 48, height: 14, borderRadius: 6, background: "var(--border)" }} />
            <div style={{ width: "90%", height: 12, borderRadius: 4, background: "var(--border)" }} />
            <div style={{ width: "75%", height: 12, borderRadius: 4, background: "var(--border)" }} />
            <div style={{ flex: 1 }} />
            <div style={{ width: "40%", height: 10, borderRadius: 4, background: "var(--border)" }} />
          </div>
        ))}
      </div>
    </section>
  );
}

function FolderIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="var(--text-muted)" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="var(--accent)" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M14 2v6h6" stroke="var(--accent)" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

const sectionTitle: CSSProperties = {
  margin: "0 0 0.6rem",
  fontSize: "1rem",
  color: "var(--text-primary)",
};

const wotdSkeletonBox: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  width: "100%",
  padding: "1rem 1.1rem",
  borderRadius: 16,
  background: "var(--bg-elevated)",
  animation: "pulse 1.5s ease-in-out infinite",
};

const scrollRow: CSSProperties = {
  display: "flex",
  flexWrap: "nowrap",
  gap: 10,
  overflowX: "auto",
  overflowY: "hidden",
  paddingBottom: 4,
  scrollSnapType: "x mandatory",
  WebkitOverflowScrolling: "touch",
  maxWidth: "100%",
};

const thumbCard: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  width: 100,
  minWidth: 100,
  height: 100,
  flexShrink: 0,
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--bg-card)",
  textDecoration: "none",
  scrollSnapAlign: "start",
  padding: "0.5rem",
  transition: "background 0.1s",
};

const thumbLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-primary)",
  textAlign: "center",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  width: "100%",
  padding: "0 2px",
};

const reviewBtn: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  width: "100%",
  padding: "0.85rem 1rem",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--bg-card)",
  textDecoration: "none",
};
