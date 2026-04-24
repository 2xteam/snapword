"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { loadSession, type SessionUser } from "@/lib/session";
import { useDragScroll } from "@/lib/useDragScroll";
import { WordOfTheDayCard, type WotdData } from "@/components/WordOfTheDayCard";
import { EgArticleList, type EgItem } from "@/components/DwtArticleList";
import { InstallButton } from "@/components/InstallButton";

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

  const canReview = hasTests && wrongCount > 0;

  return (
    <div style={{ display: "grid", gap: "1rem", minWidth: 0 }}>
      {/* Row 1: 오늘의 Word | 복습 */}
      <div style={twoColGrid}>
        <section data-guide="wotd-section">
          <h2 style={sectionLabel}>오늘의 Word</h2>
          {rssLoading ? (
            <div style={{ ...squareCard, animation: "pulse 1.5s ease-in-out infinite" }}>
              <div style={{ width: 60, height: 14, borderRadius: 4, background: "var(--border)" }} />
              <div style={{ width: "70%", height: 10, borderRadius: 4, background: "var(--border)" }} />
            </div>
          ) : wotd ? (
            <WordOfTheDayCard data={wotd} compact />
          ) : (
            <div style={squareCard}>
              <span style={{ fontSize: 28 }}>📖</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>데이터 없음</span>
            </div>
          )}
        </section>

        <section>
          <h2 style={sectionLabel}>복습</h2>
          <Link
            href={canReview ? "/home/wrong-words" : "#"}
            onClick={(e) => { if (!canReview) e.preventDefault(); }}
            data-guide="review-section"
            style={{
              ...squareCard,
              textDecoration: "none",
              opacity: loaded ? (canReview ? 1 : 0.5) : 1,
              cursor: canReview ? "pointer" : "default",
            }}
          >
            <SmileyIcon score={-2} size={36} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
              많이 틀린 단어
            </span>
            <span style={{ fontSize: 11, color: "var(--text-secondary)", textAlign: "center", lineHeight: 1.4 }}>
              {!loaded ? "로딩중…" : !hasTests ? "아직 시험 기록이 없어요" : wrongCount === 0 ? "틀린 단어가 없어요!" : `${wrongCount}개 복습하러 가기`}
            </span>
          </Link>
        </section>
      </div>

      {/* Row 2: 최근 단어장 | 최근 폴더 — 정사각 카드, 가로 스크롤 */}
      <div style={twoColGrid}>
        <section data-guide="deck-section" style={{ minWidth: 0 }}>
          <h2 style={sectionLabel}>최근 단어장</h2>
          <div ref={deckDragRef} style={scrollRow}>
            {!loaded ? (
              [0, 1].map((i) => <div key={i} style={{ ...thumbCard, background: "var(--bg-elevated)", animation: "pulse 1.5s ease-in-out infinite" }} />)
            ) : decks.length === 0 ? (
              <div style={{ ...thumbCard, justifyContent: "center" }}>
                <SmileyIcon score={0} size={28} />
              </div>
            ) : (
              decks.map((d) => (
                <Link key={d._id} href={`/vocab/${d._id}`} style={thumbCard}>
                  <FileIcon />
                  <span style={thumbLabel}>{d.name}</span>
                </Link>
              ))
            )}
          </div>
        </section>

        <section data-guide="folder-section" style={{ minWidth: 0 }}>
          <h2 style={sectionLabel}>최근 폴더</h2>
          <div ref={folderDragRef} style={scrollRow}>
            {!loaded ? (
              [0, 1].map((i) => <div key={i} style={{ ...thumbCard, background: "var(--bg-elevated)", animation: "pulse 1.5s ease-in-out infinite" }} />)
            ) : folders.length === 0 ? (
              <div style={{ ...thumbCard, justifyContent: "center" }}>
                <SmileyIcon score={0} size={28} />
              </div>
            ) : (
              folders.map((f) => (
                <Link key={f._id} href={`/folders/${f._id}`} style={thumbCard}>
                  <FolderIcon />
                  <span style={thumbLabel}>{f.name}</span>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Row 3: 더 공부해 볼까? — 현재 유지 */}
      {rssLoading ? (
        <EgCarouselSkeleton />
      ) : egItems.length > 0 ? (
        <EgArticleList items={egItems} limit={5} />
      ) : null}

      <InstallButton />
    </div>
  );
}


function EgCarouselSkeleton() {
  return (
    <section style={{ minWidth: 0, overflow: "hidden" }}>
      <h2 style={{ margin: "0 0 0.6rem", fontSize: "1rem", color: "var(--text-primary)" }}>더 공부해 볼까?</h2>
      <div className="home-scroll-row" style={{ display: "flex", flexWrap: "nowrap", gap: 10, overflowX: "auto", overflowY: "hidden", paddingBottom: 4, WebkitOverflowScrolling: "touch" as never, maxWidth: "100%", animation: "pulse 1.5s ease-in-out infinite" }}>
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

const sectionLabel: CSSProperties = {
  margin: "0 0 0.4rem",
  fontSize: 12,
  color: "var(--text-muted)",
  fontWeight: 600,
};

const twoColGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "0.6rem",
};

const squareCard: CSSProperties = {
  aspectRatio: "1",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  borderRadius: "var(--radius-lg)",
  background: "var(--bg-card)",
  padding: "0.75rem",
};

const scrollRow: CSSProperties = {
  display: "flex",
  flexWrap: "nowrap",
  gap: 8,
  overflowX: "auto",
  overflowY: "hidden",
  paddingBottom: 4,
  WebkitOverflowScrolling: "touch" as never,
};

const thumbCard: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  aspectRatio: "1",
  width: "100%",
  minWidth: "85%",
  flexShrink: 0,
  borderRadius: "var(--radius-lg)",
  background: "var(--bg-card)",
  textDecoration: "none",
  padding: "0.75rem",
  scrollSnapAlign: "start",
};

const thumbLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-primary)",
  textAlign: "center",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  width: "100%",
};

function SmileyIcon({ score, size = 24 }: { score: number; size?: number }) {
  const dk = "rgba(0,0,0,0.55)";
  const wh = "rgba(255,255,255,0.5)";
  let mouth;
  switch (score) {
    case 2:
      mouth = <><path d="M22 40 Q32 50, 42 40" fill="none" stroke={dk} strokeWidth="2.5" strokeLinecap="round" /><line x1="25" y1="41" x2="39" y2="41" stroke={dk} strokeWidth="1.5" /></>;
      break;
    case 1:
      mouth = <path d="M24 38 Q32 46, 40 38" fill="none" stroke={dk} strokeWidth="2.5" strokeLinecap="round" />;
      break;
    case -1:
      mouth = <path d="M24 44 Q32 36, 40 44" fill="none" stroke={dk} strokeWidth="2.5" strokeLinecap="round" />;
      break;
    case -2:
      mouth = <><ellipse cx="32" cy="42" rx="8" ry="5" fill={dk} /><ellipse cx="21" cy="50" rx="2.5" ry="4" fill="rgba(100,180,255,0.7)" /><ellipse cx="43" cy="50" rx="2.5" ry="4" fill="rgba(100,180,255,0.7)" /></>;
      break;
    default:
      mouth = <line x1="24" y1="40" x2="40" y2="40" stroke={dk} strokeWidth="2.5" strokeLinecap="round" />;
  }
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <circle cx="32" cy="32" r="30" fill="var(--accent)" />
      <circle cx="23" cy="28" r="4.5" fill={dk} />
      <circle cx="41" cy="28" r="4.5" fill={dk} />
      <circle cx="24.5" cy="26.5" r="1.5" fill={wh} />
      <circle cx="42.5" cy="26.5" r="1.5" fill={wh} />
      {mouth}
    </svg>
  );
}
