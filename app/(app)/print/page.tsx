"use client";

import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadSession, type SessionUser } from "@/lib/session";
import {
  buildMcqQuestionsForPrint,
  clueTypeLabelKo,
  normalizeWordFromApi,
  type McqQuestion,
  type WordForMcq,
} from "@/lib/testMcq";

type Deck = { _id: string; name: string; folderId?: string };
type WordRow = {
  _id: string;
  word: string;
  meaning: string;
  example: string;
  synonyms: string[];
  antonyms: string[];
  vocabId: string;
  wrongCount: number;
  attempts: number;
};

export default function PrintPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [words, setWords] = useState<WordRow[]>([]);
  const [filter, setFilter] = useState<"wrong" | "wrong2" | "all">("wrong");
  const [pick, setPick] = useState<Record<string, boolean>>({});
  const loadingRef = useRef(false);

  useEffect(() => {
    const s = loadSession();
    if (!s) router.replace("/");
    else setSession(s);
  }, [router]);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const res = await fetch(`/api/vocabularies?phone=${encodeURIComponent(session.phone)}`);
      const json = (await res.json()) as { ok: boolean; items?: Deck[] };
      if (json.ok && json.items) setDecks(json.items);
    })();
  }, [session]);

  const selectedVocabIds = useMemo(
    () => Object.entries(sel).filter(([, v]) => v).map(([k]) => k),
    [sel],
  );

  const loadWords = useCallback(async () => {
    if (!session || selectedVocabIds.length === 0) {
      setWords([]);
      setPick({});
      return;
    }
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const statsRes = await fetch(
        `/api/test-word-stats?phone=${encodeURIComponent(session.phone)}&userId=${encodeURIComponent(session.id)}&vocabIds=${selectedVocabIds.join(",")}`,
      );
      const sj = (await statsRes.json()) as {
        ok: boolean;
        byWord?: { wordId: string; wrongCount: number; attempts: number }[];
      };
      const statMap = new Map<string, { wrongCount: number; attempts: number }>();
      if (sj.ok && sj.byWord) {
        for (const b of sj.byWord) statMap.set(b.wordId, { wrongCount: b.wrongCount, attempts: b.attempts });
      }

      const all: WordRow[] = [];
      for (const vid of selectedVocabIds) {
        const wr = await fetch(`/api/words?vocabId=${encodeURIComponent(vid)}`);
        const wj = (await wr.json()) as { ok: boolean; items?: unknown[] };
        if (!wj.ok || !wj.items) continue;
        for (const it of wj.items) {
          const n = normalizeWordFromApi(it);
          const st = statMap.get(n._id) ?? { wrongCount: 0, attempts: 0 };
          const raw = it as { vocabId?: string };
          all.push({
            ...n,
            vocabId: typeof raw.vocabId === "string" ? raw.vocabId : vid,
            wrongCount: st.wrongCount,
            attempts: st.attempts,
          });
        }
      }
      setWords(all);
      const init: Record<string, boolean> = {};
      for (const w of all) {
        const ok =
          filter === "all"
            ? true
            : filter === "wrong"
              ? w.wrongCount >= 1
              : w.wrongCount >= 2;
        if (ok) init[w._id] = false;
      }
      setPick(init);
    } finally {
      loadingRef.current = false;
    }
  }, [session, selectedVocabIds, filter]);

  useEffect(() => {
    void loadWords();
  }, [loadWords]);

  const filteredList = useMemo(() => {
    return words.filter((w) =>
      filter === "all" ? true : filter === "wrong" ? w.wrongCount >= 1 : w.wrongCount >= 2,
    );
  }, [words, filter]);

  const toggleAll = (on: boolean) => {
    const next: Record<string, boolean> = { ...pick };
    for (const w of filteredList) next[w._id] = on;
    setPick(next);
  };

  const toWordForMcq = (r: WordRow): WordForMcq => ({
    _id: r._id,
    word: r.word,
    meaning: r.meaning,
    example: r.example,
    synonyms: r.synonyms,
    antonyms: r.antonyms,
  });

  const doPrint = () => {
    const chosen = filteredList.filter((w) => pick[w._id]);
    if (chosen.length === 0) return;
    const pool = words.map(toWordForMcq);
    const qs = buildMcqQuestionsForPrint(chosen.map(toWordForMcq), pool);
    if (qs.length === 0) {
      window.alert(
        "인쇄할 문제를 만들 수 없습니다. 설명·예문·동의어·반의어 중 최소 하나가 있는 단어만 문제를 만들 수 있습니다.",
      );
      return;
    }
    const w = window.open("", "_blank");
    if (!w) return;
    const html = buildFillInPrintHtml(qs);
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.print();
  };

  if (!session) return null;

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <h1 style={{ margin: 0, fontSize: "1.25rem", color: "var(--text-primary)" }}>Print</h1>
      <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 14 }}>
        단어장을 선택하면 자동으로 단어가 조회됩니다. 체크한 항목만 인쇄됩니다.
      </p>

      <section style={card}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>단어장 선택</div>
        <div style={{ display: "grid", gap: 6, maxHeight: 200, overflow: "auto" }}>
          {decks.map((d) => (
            <label key={d._id} style={{ display: "flex", gap: 8, fontSize: 14, color: "var(--text-primary)" }}>
              <input
                type="checkbox"
                checked={Boolean(sel[d._id])}
                onChange={(e) => setSel((s) => ({ ...s, [d._id]: e.target.checked }))}
              />
              {d.name}
            </label>
          ))}
        </div>
        <div style={{ marginTop: 10 }}>
          <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
            <option value="wrong">틀린 단어만 (1회+)</option>
            <option value="wrong2">2회 이상 틀림</option>
            <option value="all">모든 단어 후 수동 선택</option>
          </select>
        </div>
      </section>

      <section style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <strong>단어 ({filteredList.length})</strong>
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" onClick={() => toggleAll(true)}>
              전체 선택
            </button>
            <button type="button" onClick={() => toggleAll(false)}>
              전체 해제
            </button>
          </div>
        </div>
        <div style={{ display: "grid", gap: 6, maxHeight: 320, overflow: "auto" }}>
          {filteredList.map((w) => (
            <label
              key={w._id}
              style={{
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
                padding: "0.5rem",
                borderRadius: 8,
                background: "var(--bg-elevated)",
                fontSize: 14,
                color: "var(--text-primary)",
              }}
            >
              <input
                type="checkbox"
                checked={Boolean(pick[w._id])}
                onChange={(e) => setPick((p) => ({ ...p, [w._id]: e.target.checked }))}
              />
              <span>
                <strong>{w.word}</strong>
                <span style={{ color: "var(--text-secondary)", marginLeft: 8 }}>
                  오답 {w.wrongCount} / 시도 {w.attempts}
                </span>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{w.meaning}</div>
              </span>
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={doPrint}
          style={{
            marginTop: 12,
            width: "100%",
            padding: "0.75rem",
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            fontWeight: 600,
          }}
        >
          인쇄
        </button>
      </section>
    </div>
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildFillInPrintHtml(qs: McqQuestion[]): string {
  const when = new Date().toLocaleString("ko-KR");

  const blocks = qs
    .map((q, i) => {
      return `<div class="q">
  <div class="line1"><span class="qnum">${i + 1}.</span> ${escapeHtml(q.clue)}</div>
  <div class="line2">힌트: ${escapeHtml(clueTypeLabelKo(q.type))} &nbsp;│&nbsp; 정답: <span class="blank"></span></div>
</div>`;
    })
    .join("");

  const answerRows = qs
    .map(
      (q, i) =>
        `<tr><td class="anum">${i + 1}</td><td class="aword">${escapeHtml(q.answer)}</td></tr>`,
    )
    .join("");

  return `<!DOCTYPE html><html lang="ko"><head>
<meta charset="utf-8"/>
<title>SnapWord 연습지</title>
<style>
  body { font-family: "Malgun Gothic", "Apple SD Gothic Neo", system-ui, sans-serif; color: #111; max-width: 800px; margin: 20px auto; padding: 0 16px; font-size: 13px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .meta { color: #555; font-size: 12px; margin-bottom: 16px; }
  .q { padding: 6px 0; border-bottom: 1px solid #e5e7eb; }
  .line1 { font-size: 13px; line-height: 1.5; }
  .qnum { font-weight: 700; color: #333; }
  .line2 { font-size: 12px; color: #666; margin-top: 2px; }
  .blank { display: inline-block; min-width: 180px; border-bottom: 1.5px solid #111; margin-left: 4px; }
  .answer-page { page-break-before: always; }
  .answer-page h2 { font-size: 16px; margin: 0 0 12px; border-bottom: 2px double #111; padding-bottom: 8px; }
  .answer-table { border-collapse: collapse; width: 100%; }
  .answer-table td { padding: 5px 10px; border-bottom: 1px solid #ddd; font-size: 13px; }
  .anum { width: 40px; font-weight: 700; color: #555; text-align: center; }
  .aword { font-weight: 700; color: #1d4ed8; }
  @media print { body { margin: 0; } .answer-page { break-before: page; } }
</style></head><body>
<h1>SnapWord — 단어 연습지</h1>
<p class="meta">인쇄: ${escapeHtml(when)} · ${qs.length}문항</p>
${blocks}
<div class="answer-page">
  <h2>정답</h2>
  <table class="answer-table">
    ${answerRows}
  </table>
</div>
</body></html>`;
}

const card: CSSProperties = {
  background: "var(--bg-card)",
  borderRadius: 16,
  padding: "1rem",
  border: "1px solid var(--border)",
};
