"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
    <div style={{ paddingTop: "0.25rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "1.5rem" }}>
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
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0.6rem",
          maxWidth: 400,
          margin: "0 auto",
        }}
      >
        <HubButton href={`${base}/words`} label="단어 추가·편집" sub="수동 / 사진" icon={<EditIcon />} />
        <HubButton href={`${base}/study`} label="Study" sub="카드 암기" icon={<BookIcon />} />
        <HubButton href={`${base}/test`} label="Test" sub="객관식 5지선다" icon={<CheckIcon />} />
        <HubButton href={`${base}/scores`} label="Score" sub="시험 기록" icon={<ChartIcon />} />
      </div>
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

function HubButton({ href, label, sub, icon }: { href: string; label: string; sub: string; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "1.1rem 0.75rem",
        borderRadius: 14,
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
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
