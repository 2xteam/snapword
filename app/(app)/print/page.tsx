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
import { languageOfWord, wordFontSize } from "@/lib/studyLanguage";

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
  const [loadingWords, setLoadingWords] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  /*
    불러오기 차례 번호. 불러오는 중에 단어장을 더 체크하면 새로 부르고, **마지막 차례의 결과만**
    반영한다. 예전에는 불러오는 중이면 새 요청을 건너뛰어서, 응답이 느리면 첫 단어장만 나오거나
    0개로 남았다(2026-10-01).
  */
  const loadSeq = useRef(0);

  useEffect(() => {
    const s = loadSession();
    if (!s) router.replace("/");
    else setSession(s);
  }, [router]);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const res = await fetch(`/api/vocabularies`);
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
      loadSeq.current++; // 불러오던 결과가 뒤늦게 들어오지 않게
      setWords([]);
      setPick({});
      setLoadingWords(false);
      return;
    }
    const seq = ++loadSeq.current;
    setLoadingWords(true);
    try {
      const statsRes = await fetch(
        `/api/test-word-stats?vocabIds=${selectedVocabIds.join(",")}`,
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
      if (seq !== loadSeq.current) return; // 그사이 선택이 바뀌었다 — 새 차례가 반영한다
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
    } catch {
      if (seq === loadSeq.current) setNotice("단어를 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
    } finally {
      if (seq === loadSeq.current) setLoadingWords(false);
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

  const pickedCount = filteredList.filter((w) => pick[w._id]).length;

  /** 필터마다 몇 개인지 — 옵션에 보여 준다. 시험 기록이 없으면 "틀린 단어" 는 0 이다 */
  const filterCounts = useMemo(
    () => ({
      wrong: words.filter((w) => w.wrongCount >= 1).length,
      wrong2: words.filter((w) => w.wrongCount >= 2).length,
      all: words.length,
    }),
    [words],
  );
  const hasDecks = selectedVocabIds.length > 0;

  const doPrint = () => {
    setNotice(null);
    const chosen = filteredList.filter((w) => pick[w._id]);
    if (chosen.length === 0) {
      setNotice("인쇄할 단어를 체크해 주세요.");
      return;
    }
    const pool = words.map(toWordForMcq);
    const qs = buildMcqQuestionsForPrint(chosen.map(toWordForMcq), pool);
    if (qs.length === 0) {
      window.alert(
        "인쇄할 문제를 만들 수 없습니다. 설명(훈음·뜻)·예문·동의어·반의어 중 최소 하나가 있는 단어만 문제를 만들 수 있습니다.",
      );
      return;
    }
    printHtml(buildFillInPrintHtml(qs));
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
            <label key={d._id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--text-primary)", cursor: "pointer" }}>
              <input
                type="checkbox"
                className="custom-checkbox"
                checked={Boolean(sel[d._id])}
                onChange={(e) => setSel((s) => ({ ...s, [d._id]: e.target.checked }))}
              />
              {d.name}
            </label>
          ))}
        </div>
        <div style={{ marginTop: 10 }}>
          <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
            <option value="wrong">틀린 단어만 (1회+){hasDecks ? ` · ${filterCounts.wrong}개` : ""}</option>
            <option value="wrong2">2회 이상 틀림{hasDecks ? ` · ${filterCounts.wrong2}개` : ""}</option>
            <option value="all">모든 단어 후 수동 선택{hasDecks ? ` · ${filterCounts.all}개` : ""}</option>
          </select>
        </div>
      </section>

      <section style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <strong>
            단어 ({filteredList.length}){loadingWords ? <span style={{ fontWeight: 400, fontSize: 12, color: "var(--text-muted)" }}> · 불러오는 중…</span> : null}
          </strong>
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" onClick={() => toggleAll(true)}>
              전체 선택
            </button>
            <button type="button" onClick={() => toggleAll(false)}>
              전체 해제
            </button>
          </div>
        </div>
        {/*
          목록이 비었을 때 이유를 말한다. 기본 필터가 "틀린 단어만" 이라 시험을 본 적이 없으면
          단어장을 모두 골라도 0 개였고, 고장 난 것처럼 보였다(2026-10-01).
        */}
        {!loadingWords && filteredList.length === 0 ? (
          <p style={{ margin: "4px 0 8px", fontSize: 13, color: "var(--text-secondary)" }}>
            {!hasDecks ? (
              "위에서 단어장을 골라 주세요."
            ) : filterCounts.all === 0 ? (
              "고른 단어장에 단어가 없어요."
            ) : (
              <>
                {filter === "wrong2" ? "2회 이상 틀린 단어가 없어요." : "틀린 단어가 없어요(시험 기록이 없으면 0개예요)."}{" "}
                <button type="button" onClick={() => setFilter("all")} style={{ marginLeft: 4 }}>
                  모든 단어 보기 ({filterCounts.all})
                </button>
              </>
            )}
          </p>
        ) : null}
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
                className="custom-checkbox"
                checked={Boolean(pick[w._id])}
                onChange={(e) => setPick((p) => ({ ...p, [w._id]: e.target.checked }))}
                style={{ marginTop: 2 }}
              />
              <span>
                <strong style={{ fontSize: wordFontSize(w.word, 14) }}>{w.word}</strong>
                <span style={{ color: "var(--text-secondary)", marginLeft: 8 }}>
                  오답 {w.wrongCount} / 시도 {w.attempts}
                </span>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{w.meaning}</div>
              </span>
            </label>
          ))}
        </div>
        {notice ? (
          <p role="status" style={{ margin: "10px 0 0", fontSize: 13, color: "var(--danger-ink)" }}>
            {notice}
          </p>
        ) : null}
        <button
          type="button"
          onClick={doPrint}
          disabled={pickedCount === 0 || loadingWords}
          style={{
            marginTop: 12,
            width: "100%",
            padding: "0.75rem",
            background: "var(--accent)",
            color: "var(--on-accent)",
            border: "none",
            fontWeight: 600,
            opacity: pickedCount === 0 || loadingWords ? 0.5 : 1,
            cursor: pickedCount === 0 || loadingWords ? "default" : "pointer",
          }}
        >
          {pickedCount > 0 ? `${pickedCount}개 인쇄` : "인쇄할 단어를 체크하세요"}
        </button>
      </section>
    </div>
  );
}

/**
 * 인쇄 — **새 창을 열지 않는다.** 보이지 않는 iframe 에 연습지를 그리고 그 안에서 인쇄 창을 연다.
 *
 * 예전에는 window.open("") 으로 새 창을 열었는데, 팝업을 막는 브라우저(설치한 앱 창·인앱 브라우저·
 * 모바일·Claude 브라우저)에서는 null 이 돌아와 **아무 일도 일어나지 않았다**(2026-10-01).
 * 글꼴·레이아웃이 그려진 뒤(load) 인쇄하고, 인쇄 창이 닫히면 iframe 을 치운다.
 */
function printHtml(html: string) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);

  const cleanup = () => {
    window.setTimeout(() => frame.remove(), 1000);
  };

  frame.onload = () => {
    const win = frame.contentWindow;
    if (!win) {
      cleanup();
      return;
    }
    win.addEventListener("afterprint", cleanup, { once: true });
    win.focus();
    win.print();
    // afterprint 를 주지 않는 브라우저도 있다 — 넉넉히 뒤에 치운다
    window.setTimeout(() => frame.remove(), 60_000);
  };
  frame.srcdoc = html;
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
  <div class="line1"><span class="qnum">${i + 1}.</span> <span class="tag">${escapeHtml(clueTypeLabelKo(q.type, languageOfWord(q.answer)))}</span> ${escapeHtml(q.clue)}</div>
  <div class="answer-blank"></div>
</div>`;
    })
    .join("");

  const answerRows = qs
    .map(
      (q, i) =>
        `<tr><td class="anum">${i + 1}</td><td class="aword${languageOfWord(q.answer) === "hanja" ? " hanja" : ""}">${escapeHtml(q.answer)}</td></tr>`,
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
  .tag { display: inline-block; font-size: 11px; font-weight: 600; color: #fff; background: #6b7280; border-radius: 3px; padding: 1px 6px; margin-right: 6px; vertical-align: middle; }
  .answer-blank { margin-top: 4px; height: 20px; }
  .answer-page { page-break-before: always; }
  .answer-page h2 { font-size: 16px; margin: 0 0 12px; border-bottom: 2px double #111; padding-bottom: 8px; }
  .answer-table { border-collapse: collapse; width: 100%; }
  .answer-table td { padding: 5px 10px; border-bottom: 1px solid #ddd; font-size: 13px; }
  .anum { width: 40px; font-weight: 700; color: #555; text-align: center; }
  .aword { font-weight: 700; color: #1d4ed8; }
  .aword.hanja { font-size: 2em; }
  @media print { body { margin: 0; } .answer-page { break-before: page; } }
</style></head><body>
<h1>SnapWord — ${qs.every((q) => languageOfWord(q.answer) === "hanja") ? "한자" : "단어"} 연습지</h1>
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
  borderRadius: "var(--radius-lg)",
  padding: "1rem",
};
