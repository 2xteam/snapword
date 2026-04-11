"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { VocabularyPayload } from "@/lib/vocabularyTypes";
import { emptyVocabularyPayload } from "@/lib/vocabularyTypes";
import { loadSession, type SessionUser } from "@/lib/session";

type WordRow = VocabularyPayload & { _id?: string };

type DialogMode = "manual" | "vision" | null;

export default function VocabWordsEditPage() {
  const { vocabId } = useParams<{ vocabId: string }>();
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [rows, setRows] = useState<WordRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [dialogRow, setDialogRow] = useState<WordRow>(emptyVocabularyPayload());
  const [visionRows, setVisionRows] = useState<WordRow[]>([]);

  useEffect(() => {
    const s = loadSession();
    if (!s) router.replace("/");
    else setSession(s);
  }, [router]);

  const load = useCallback(async () => {
    if (!vocabId) return;
    const res = await fetch(`/api/words?vocabId=${encodeURIComponent(vocabId)}`);
    const json = (await res.json()) as {
      ok: boolean;
      items?: Array<VocabularyPayload & { _id: string; word: string; meaning: string }>;
    };
    if (!json.ok || !json.items) { setLoaded(true); return; }
    setRows(
      json.items.map((w) => ({
        _id: w._id, word: w.word, meaning: w.meaning,
        example: w.example ?? "", synonyms: w.synonyms ?? [], antonyms: w.antonyms ?? [],
      })).reverse(),
    );
    setLoaded(true);
  }, [vocabId]);

  useEffect(() => { void load(); }, [load]);

  const updateRow = (i: number, patch: Partial<WordRow>) => {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };

  const openAddDialog = () => {
    setDialogRow(emptyVocabularyPayload());
    setDialogMode("manual");
  };

  const closeDialog = () => { setDialogMode(null); setVisionRows([]); };

  const submitManual = () => {
    if (!dialogRow.word.trim() || !dialogRow.meaning.trim()) return;
    setRows((prev) => [{ ...dialogRow }, ...prev]);
    closeDialog();
  };

  const submitVision = () => {
    setRows((prev) => [...visionRows, ...prev]);
    closeDialog();
  };

  const updateVisionRow = (i: number, patch: Partial<WordRow>) => {
    setVisionRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };

  const removeVisionRow = (i: number) => {
    setVisionRows((prev) => prev.filter((_, j) => j !== i));
  };

  const runVision = async (file: File | null) => {
    if (!file || !session) return;
    setBusy("vision");
    setMsg(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/openai-vision", { method: "POST", body: fd });
      const json = (await res.json()) as {
        ok: boolean;
        words?: VocabularyPayload[];
        error?: string;
      };
      if (!res.ok || !json.ok || !json.words?.length) {
        setMsg(json.error ?? "Vision 실패");
        return;
      }
      setVisionRows(json.words.map((w) => ({ ...w })));
      setDialogMode("vision");
    } catch {
      setMsg("네트워크 오류");
    } finally {
      setBusy(null);
    }
  };

  const removeRow = async (i: number) => {
    const row = rows[i];
    if (!session) return;
    if (row._id) {
      const res = await fetch(
        `/api/words/${row._id}?phone=${encodeURIComponent(session.phone)}`,
        { method: "DELETE" },
      );
      const json = (await res.json()) as { ok: boolean };
      if (!res.ok || !json.ok) { setMsg("삭제 실패"); return; }
    }
    setRows((prev) => prev.filter((_, j) => j !== i));
  };

  const saveAll = async () => {
    if (!session || !vocabId) return;
    const invalid = rows.find((r) => !r.word.trim() || !r.meaning.trim());
    if (invalid) { setMsg("단어와 설명은 모두 필수입니다."); return; }
    setBusy("save");
    setMsg(null);
    try {
      const newOnes = rows.filter((r) => !r._id);
      const existing = rows.filter((r) => r._id);
      if (newOnes.length > 0) {
        const res = await fetch("/api/words", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ vocabId, phone: session.phone, words: newOnes.map(({ _id: _, ...w }) => w) }),
        });
        const json = (await res.json()) as { ok: boolean; error?: string };
        if (!res.ok || !json.ok) { setMsg(json.error ?? "일괄 저장 실패"); return; }
      }
      for (const r of existing) {
        const res = await fetch(`/api/words/${r._id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phone: session.phone, word: r.word, meaning: r.meaning, example: r.example, synonyms: r.synonyms, antonyms: r.antonyms }),
        });
        const json = (await res.json()) as { ok: boolean; error?: string };
        if (!res.ok || !json.ok) { setMsg(json.error ?? "수정 실패"); return; }
      }
      setMsg("저장되었습니다.");
      await load();
    } finally {
      setBusy(null);
    }
  };

  if (!session) return null;

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      {busy === "vision" && (
        <div style={overlayFull}>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 40, height: 40, border: "3px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
            <p style={{ color: "var(--text-primary)", fontSize: 15, fontWeight: 600 }}>업로드 중…</p>
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Link href={`/vocab/${vocabId}`} style={backBtnStyle} title="뒤로">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <h1 style={{ margin: 0, fontSize: "1.2rem", color: "var(--text-primary)" }}>단어 추가·편집</h1>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={openAddDialog} style={btn}>+ 수동 추가</button>
        <label style={{ ...btn, cursor: "pointer", display: "inline-block" }}>
          사진으로 추가
          <input type="file" accept="image/*" hidden onChange={(e) => void runVision(e.target.files?.[0] ?? null)} />
        </label>
      </div>

      {msg ? <p style={{ fontSize: 13, color: "var(--success)" }}>{msg}</p> : null}

      <div style={{ display: "grid", gap: "1rem" }}>
        {!loaded ? (
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>로딩중입니다…</p>
        ) : rows.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>단어가 없습니다. 위 버튼으로 추가하세요.</p>
        ) : (
          rows.map((r, i) => (
            <div key={`${r._id ?? "new"}-${i}`} style={{ border: "1px solid var(--border)", borderRadius: 14, padding: "0.85rem", background: "var(--bg-card)" }}>
              <Field label="단어 *" value={r.word} onChange={(v) => updateRow(i, { word: v })} />
              <Field label="설명 *" value={r.meaning} onChange={(v) => updateRow(i, { meaning: v })} multiline />
              <Field label="예문" value={r.example} onChange={(v) => updateRow(i, { example: v })} multiline />
              <Field label="동의어 (쉼표 구분)" value={r.synonyms.join(", ")} onChange={(v) => updateRow(i, { synonyms: v.split(",").map((s) => s.trim()).filter(Boolean) })} />
              <Field label="반의어 (쉼표 구분)" value={r.antonyms.join(", ")} onChange={(v) => updateRow(i, { antonyms: v.split(",").map((s) => s.trim()).filter(Boolean) })} />
              <button type="button" onClick={() => void removeRow(i)} style={btnDanger}>이 항목 삭제</button>
            </div>
          ))
        )}
      </div>

      <button
        type="button"
        onClick={() => void saveAll()}
        disabled={busy !== null || rows.length === 0}
        style={{ width: "100%", padding: "0.9rem", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
      >
        {busy === "save" ? "저장 중…" : "저장"}
      </button>

      {/* Manual add dialog */}
      {dialogMode === "manual" && (
        <>
          <div style={overlayStyle} onClick={closeDialog} />
          <div style={dialogBoxStyle}>
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", color: "var(--text-primary)" }}>수동 추가</h3>
            <Field label="단어 *" value={dialogRow.word} onChange={(v) => setDialogRow((d) => ({ ...d, word: v }))} />
            <Field label="설명 *" value={dialogRow.meaning} onChange={(v) => setDialogRow((d) => ({ ...d, meaning: v }))} multiline />
            <Field label="예문" value={dialogRow.example} onChange={(v) => setDialogRow((d) => ({ ...d, example: v }))} multiline />
            <Field label="동의어 (쉼표 구분)" value={dialogRow.synonyms.join(", ")} onChange={(v) => setDialogRow((d) => ({ ...d, synonyms: v.split(",").map((s) => s.trim()).filter(Boolean) }))} />
            <Field label="반의어 (쉼표 구분)" value={dialogRow.antonyms.join(", ")} onChange={(v) => setDialogRow((d) => ({ ...d, antonyms: v.split(",").map((s) => s.trim()).filter(Boolean) }))} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: "0.75rem" }}>
              <button type="button" onClick={closeDialog} style={btnCancel}>취소</button>
              <button type="button" onClick={submitManual} disabled={!dialogRow.word.trim() || !dialogRow.meaning.trim()} style={btnAccent}>추가</button>
            </div>
          </div>
        </>
      )}

      {/* Vision result dialog */}
      {dialogMode === "vision" && (
        <>
          <div style={overlayStyle} onClick={closeDialog} />
          <div style={dialogBoxStyle}>
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", color: "var(--text-primary)" }}>
              사진에서 {visionRows.length}개 단어 추출
            </h3>
            <div style={{ display: "grid", gap: "0.75rem", maxHeight: "55vh", overflowY: "auto", paddingBottom: 60 }}>
              {visionRows.map((vr, i) => (
                <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "0.75rem", background: "var(--bg-elevated)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>#{i + 1}</span>
                    <button type="button" onClick={() => removeVisionRow(i)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: 12 }}>삭제</button>
                  </div>
                  <Field label="단어" value={vr.word} onChange={(v) => updateVisionRow(i, { word: v })} />
                  <Field label="설명" value={vr.meaning} onChange={(v) => updateVisionRow(i, { meaning: v })} />
                </div>
              ))}
            </div>
            {/* Floating save button */}
            <button
              type="button"
              onClick={submitVision}
              disabled={visionRows.length === 0}
              style={fabStyle}
              title="목록에 추가"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, value, onChange, multiline }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  return (
    <label style={{ display: "block", marginBottom: "0.5rem", fontSize: 12, color: "var(--text-secondary)" }}>
      {label}
      {multiline ? (
        <textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", marginTop: 4 }} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", marginTop: 4 }} />
      )}
    </label>
  );
}

const backBtnStyle: CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  width: 32, height: 32, borderRadius: 8,
  background: "var(--bg-elevated)", border: "1px solid var(--border)",
  color: "var(--text-secondary)", textDecoration: "none",
};

const btn: CSSProperties = {
  padding: "0.45rem 0.75rem", borderRadius: 10,
  border: "1px solid var(--border)", background: "var(--bg-elevated)",
  color: "var(--text-primary)", fontSize: 13, cursor: "pointer",
};

const btnDanger: CSSProperties = {
  ...btn, marginTop: 8,
  borderColor: "rgba(239, 68, 68, 0.3)", color: "#fca5a5", background: "var(--danger-subtle)",
};

const btnAccent: CSSProperties = {
  padding: "0.55rem 1rem", borderRadius: 10, border: "none",
  background: "var(--accent)", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13,
};

const btnCancel: CSSProperties = {
  padding: "0.55rem 1rem", borderRadius: 10,
  border: "1px solid var(--border)", background: "var(--bg-elevated)",
  color: "var(--text-secondary)", fontWeight: 500, cursor: "pointer", fontSize: 13,
};

const overlayStyle: CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200 };

const dialogBoxStyle: CSSProperties = {
  position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
  zIndex: 201, width: "min(90vw, 480px)",
  background: "var(--bg-card)", border: "1px solid var(--border)",
  borderRadius: 16, padding: "1.5rem", boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
  maxHeight: "85vh", overflowY: "auto",
};

const overlayFull: CSSProperties = {
  position: "fixed", inset: 0, zIndex: 300,
  background: "rgba(10,10,15,0.85)",
  display: "flex", alignItems: "center", justifyContent: "center",
};

const fabStyle: CSSProperties = {
  position: "absolute",
  bottom: 20,
  right: 20,
  width: 52,
  height: 52,
  borderRadius: "50%",
  background: "var(--accent)",
  border: "none",
  boxShadow: "0 4px 16px rgba(59,130,246,0.4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};
