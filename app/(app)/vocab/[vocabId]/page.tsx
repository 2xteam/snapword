"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";
import { loadSession, type SessionUser } from "@/lib/session";

type Deck = { _id: string; name: string; folderId: string };

export default function VocabHubPage() {
  const { vocabId } = useParams<{ vocabId: string }>();
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [deck, setDeck] = useState<Deck | null>(null);

  useEffect(() => {
    const s = loadSession();
    if (!s) { router.replace("/"); return; }
    setSession(s);
  }, [router]);

  useEffect(() => {
    if (!session || !vocabId) return;
    (async () => {
      const res = await fetch(
        `/api/vocabularies/${vocabId}?phone=${encodeURIComponent(session.phone)}`,
      );
      const json = (await res.json()) as { ok: boolean; item?: Deck };
      if (json.ok && json.item) setDeck(json.item);
    })();
  }, [session, vocabId]);

  if (!session || !vocabId) return null;

  const base = `/vocab/${vocabId}`;

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "calc(100vh - var(--nav-height) - var(--nav-top))",
      margin: "0 -1rem",
      marginTop: "-1rem",
      marginBottom: "-2rem",
      position: "relative",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0.75rem 1rem", flexShrink: 0 }}>
        <Link
          href={deck?.folderId ? `/home/folder/${deck.folderId}` : "/home"}
          style={backBtnStyle}
          title="뒤로"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <h1 style={{ margin: 0, fontSize: "1.2rem", color: "var(--text-primary)", flex: 1 }}>
          {deck?.name ?? "단어장"}
        </h1>
      </div>

      {/* Center grid */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.6rem",
            maxWidth: 400,
            width: "100%",
            padding: "0 1rem",
          }}
        >
          <HubButton href={`${base}/words`} label="단어 추가·편집" sub="수동 / 사진" icon={<EditIcon />} guide="hub-words" />
          <HubButton href={`${base}/study`} label="Study" sub="카드 암기" icon={<BookIcon />} guide="hub-study" />
          <HubButton href={`${base}/test`} label="Test" sub="객관식 5지선다" icon={<CheckIcon />} guide="hub-test" />
          <HubButton href={`${base}/scores`} label="Score" sub="시험 기록" icon={<ChartIcon />} guide="hub-score" />
        </div>
      </div>

      {/* Bottom rolling smiley */}
      <RollingSmiley />
    </div>
  );
}

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

function HubButton({ href, label, sub, icon, guide }: { href: string; label: string; sub: string; icon: React.ReactNode; guide?: string }) {
  return (
    <Link
      href={href}
      {...(guide ? { "data-guide": guide } : {})}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "1.1rem 0.75rem",
        borderRadius: "var(--radius-lg)",
        background: "var(--bg-card)",
        textDecoration: "none",
        transition: "border-color 0.15s, background 0.15s",
      }}
    >
      <span style={{ color: "var(--text-muted)" }}>{icon}</span>
      <span style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: 14 }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-muted)" }}>{sub}</span>
    </Link>
  );
}

function EditIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M15.232 5.232l3.536 3.536M9 13l-2 2v3h3l9-9-3.536-3.536L9 13Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M18 20V10M12 20V4M6 20v-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const NEON = [
  "#2ee8ae","#00e5ff","#76ff03","#ffea00","#ff6d00","#ff1744",
  "#f50057","#d500f9","#651fff","#00b0ff","#1de9b6","#ff4ecd",
];
const BALL = 48;

function RollingSmiley() {
  const containerRef = useRef<HTMLDivElement>(null);
  const ballRef = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  const st = useRef({ x: 0, dir: 1, rot: 0, color: NEON[0], cry: false, init: false });

  useEffect(() => {
    const ct = containerRef.current;
    const bl = ballRef.current;
    if (!ct || !bl) return;
    const o = st.current;

    if (!o.init) {
      o.color = NEON[Math.floor(Math.random() * NEON.length)];
      o.init = true;
    }

    const SPEED = 1.5;

    const pick = (exc: string) => {
      const p = NEON.filter((c) => c !== exc);
      return p[Math.floor(Math.random() * p.length)];
    };

    const tick = () => {
      const maxX = ct.offsetWidth - BALL;
      o.x += o.dir * SPEED;
      o.rot += o.dir * SPEED * 3;

      if (o.x >= maxX) {
        o.x = maxX;
        o.dir = -1;
        o.cry = true;
        o.color = pick(o.color);
      } else if (o.x <= 0) {
        o.x = 0;
        o.dir = 1;
        o.cry = false;
        o.color = pick(o.color);
      }

      bl.style.transform = `translateX(${o.x}px) rotate(${o.rot}deg)`;
      bl.style.backgroundImage = `url("${buildFaceSvg(o.color, o.cry)}")`;
      raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  return (
    <div ref={containerRef} style={{ position: "relative", height: BALL, flexShrink: 0, overflow: "hidden" }}>
      <div
        ref={ballRef}
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: BALL,
          height: BALL,
          backgroundSize: "contain",
          backgroundRepeat: "no-repeat",
          willChange: "transform",
        }}
      />
    </div>
  );
}

function buildFaceSvg(color: string, crying: boolean): string {
  const dk = "rgba(0,0,0,0.55)";
  const wh = "rgba(255,255,255,0.5)";
  const mouth = crying
    ? `<path d="M24 44 Q32 36, 40 44" fill="none" stroke="${dk}" stroke-width="2.5" stroke-linecap="round"/>
       <ellipse cx="21" cy="48" rx="2" ry="3.5" fill="rgba(100,180,255,0.6)"/>
       <ellipse cx="43" cy="48" rx="2" ry="3.5" fill="rgba(100,180,255,0.6)"/>`
    : `<path d="M22 40 Q32 50, 42 40" fill="none" stroke="${dk}" stroke-width="2.5" stroke-linecap="round"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 64 64">
    <circle cx="32" cy="32" r="30" fill="${color}"/>
    <circle cx="23" cy="28" r="4.5" fill="${dk}"/>
    <circle cx="41" cy="28" r="4.5" fill="${dk}"/>
    <circle cx="24.5" cy="26.5" r="1.5" fill="${wh}"/>
    <circle cx="42.5" cy="26.5" r="1.5" fill="${wh}"/>
    ${mouth}
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
