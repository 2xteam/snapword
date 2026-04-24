"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { VocabularyPayload } from "@/lib/vocabularyTypes";
import { clearSession, loadSession, saveSession, type SessionUser } from "@/lib/session";

export function VocabWorkbench() {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPin, setRegPin] = useState("");
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPin, setLoginPin] = useState("");
  const [vocabId, setVocabId] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"vision" | "save" | "auth" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string>("");
  const [words, setWords] = useState<VocabularyPayload[]>([]);

  useEffect(() => {
    setSession(loadSession());
  }, []);

  const canSave = useMemo(() => {
    return Boolean(
      session?.phone &&
        vocabId.trim() &&
        words.length > 0 &&
        words.some((w) => w.word.trim().length > 0),
    );
  }, [words, session, vocabId]);

  const onPickFile = useCallback((next: File | null) => {
    setFile(next);
    setMessage(null);
  }, []);

  const register = useCallback(async () => {
    setBusy("auth");
    setMessage(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: regName,
          phone: regPhone,
          pin: regPin,
          pinConfirm: regPin,
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        user?: SessionUser;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.user) {
        setMessage(json.error ?? "회원가입에 실패했습니다.");
        return;
      }
      saveSession(json.user);
      setSession(json.user);
      setMessage("가입 및 로그인되었습니다.");
    } catch {
      setMessage("회원가입 요청에 실패했습니다.");
    } finally {
      setBusy(null);
    }
  }, [regName, regPhone, regPin]);

  const login = useCallback(async () => {
    setBusy("auth");
    setMessage(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: loginPhone, pin: loginPin }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        user?: SessionUser;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.user) {
        setMessage(json.error ?? "로그인에 실패했습니다.");
        return;
      }
      saveSession(json.user);
      setSession(json.user);
      setMessage("로그인되었습니다.");
    } catch {
      setMessage("로그인 요청에 실패했습니다.");
    } finally {
      setBusy(null);
    }
  }, [loginPhone, loginPin]);

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
    setMessage("로그아웃되었습니다.");
  }, []);

  const runOpenAiVision = useCallback(async () => {
    if (!file) {
      setMessage("이미지를 먼저 선택하세요.");
      return;
    }

    setBusy("vision");
    setMessage(null);
    try {
      const fd = new FormData();
      fd.set("file", file);

      const res = await fetch("/api/openai-vision", { method: "POST", body: fd });
      const json = (await res.json()) as {
        ok: boolean;
        note?: string;
        words?: VocabularyPayload[];
        error?: string;
      };

      if (!res.ok || !json.ok || !json.words?.length) {
        setPreviewText("");
        setWords([]);
        setMessage(json.error ?? "OpenAI Vision 분석에 실패했습니다.");
        return;
      }

      setPreviewText(json.note ?? "");
      setWords(json.words);
      setMessage(`OpenAI Vision 완료 (${json.words.length}개 단어).`);
    } catch {
      setMessage("요청에 실패했습니다. 네트워크를 확인해 주세요.");
    } finally {
      setBusy(null);
    }
  }, [file]);

  const saveWord = useCallback(async () => {
    if (!session) {
      setMessage("먼저 로그인하세요.");
      return;
    }
    if (words.length === 0) {
      setMessage("저장할 단어가 없습니다. 먼저 Vision을 실행하세요.");
      return;
    }
    const toSave = words.filter((w) => w.word.trim().length > 0);
    if (toSave.length === 0) {
      setMessage("유효한 word가 있는 항목이 없습니다.");
      return;
    }
    if (!vocabId.trim()) {
      setMessage("단어장 ID(vocabId)를 입력하세요. (Mongo ObjectId)");
      return;
    }

    setBusy("save");
    setMessage(null);
    try {
      const res = await fetch("/api/words", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          vocabId: vocabId.trim(),
          phone: session.phone,
          words: toSave,
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        count?: number;
        skipped?: string[];
        error?: string;
      };

      if (!res.ok || !json.ok) {
        setMessage(json.error ?? "저장에 실패했습니다.");
        return;
      }

      const saved = json.count ?? toSave.length;
      const skippedMsg = json.skipped && json.skipped.length > 0
        ? ` (중복 ${json.skipped.length}개 제외: ${json.skipped.join(", ")})`
        : "";
      setMessage(`words 컬렉션에 ${saved}개 단어를 저장했습니다.${skippedMsg}`);
    } catch {
      setMessage("저장 요청에 실패했습니다. 네트워크를 확인해 주세요.");
    } finally {
      setBusy(null);
    }
  }, [words, session, vocabId]);

  return (
    <div style={{ display: "grid", gap: "1rem", maxWidth: 920 }}>
      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: "var(--radius-sm)",
          padding: "1rem",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: "0.75rem" }}>회원 (phone 공유 / 학습은 userId)</div>
        {session ? (
          <div style={{ display: "grid", gap: "0.5rem", fontSize: 14, color: "#374151" }}>
            <div>
              로그인됨: <strong>{session.name}</strong> · {session.phone} · userId{" "}
              <code>{session.id}</code>
            </div>
            <button type="button" onClick={logout} disabled={busy !== null}>
              로그아웃
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>회원가입</div>
            <div style={{ display: "grid", gap: "0.35rem" }}>
              <input
                placeholder="이름 (필수)"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
              />
              <input
                placeholder="전화번호"
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
              />
              <input
                placeholder="PIN (4자 이상)"
                type="password"
                value={regPin}
                onChange={(e) => setRegPin(e.target.value)}
              />
              <button type="button" onClick={register} disabled={busy !== null}>
                가입
              </button>
            </div>
            <div style={{ fontWeight: 600, fontSize: 14, marginTop: "0.25rem" }}>로그인</div>
            <div style={{ display: "grid", gap: "0.35rem" }}>
              <input
                placeholder="전화번호"
                value={loginPhone}
                onChange={(e) => setLoginPhone(e.target.value)}
              />
              <input
                placeholder="PIN"
                type="password"
                value={loginPin}
                onChange={(e) => setLoginPin(e.target.value)}
              />
              <button type="button" onClick={login} disabled={busy !== null}>
                로그인
              </button>
            </div>
          </div>
        )}
      </section>

      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: "var(--radius-sm)",
          padding: "1rem",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: "0.5rem" }}>단어 저장 대상</div>
        <label style={{ display: "grid", gap: "0.35rem", fontSize: 14 }}>
          <span style={{ color: "#4b5563" }}>
            vocabularies 컬렉션의 단어장 ObjectId (폴더 → 단어장 생성 후 복사)
          </span>
          <input
            placeholder="예: 674a…"
            value={vocabId}
            onChange={(e) => setVocabId(e.target.value)}
          />
        </label>
      </section>

      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: "var(--radius-sm)",
          padding: "1rem",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: "0.35rem" }}>이미지 업로드 (OpenAI Vision)</div>
        <p style={{ margin: "0 0 0.75rem", fontSize: 13, color: "#6b7280" }}>
          <code>OPENAI_API_KEY</code> 필요. <code>POST /api/openai-vision</code>로 이미지에서 단어 목록(
          <code>words</code>)을 추출합니다.
        </p>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
        />
        <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button type="button" onClick={runOpenAiVision} disabled={busy !== null}>
            {busy === "vision" ? "Vision 중…" : "OpenAI Vision (이미지→JSON)"}
          </button>
          <button type="button" onClick={saveWord} disabled={busy !== null || !canSave}>
            {busy === "save" ? "저장 중…" : "단어 일괄 저장 (words)"}
          </button>
        </div>
        {file ? (
          <div style={{ marginTop: "0.75rem", color: "#374151", fontSize: 14 }}>
            선택됨: {file.name} ({Math.round(file.size / 1024)} KB)
          </div>
        ) : null}
      </section>

      {message ? (
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: "var(--radius-sm)",
            padding: "1rem",
            background: "#f9fafb",
          }}
        >
          {message}
        </div>
      ) : null}

      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: "var(--radius-sm)",
          padding: "1rem",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: "0.75rem" }}>안내 / Vision 요약</div>
        <pre
          style={{
            margin: 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {previewText || "(없음)"}
        </pre>
      </section>

      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: "var(--radius-sm)",
          padding: "1rem",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: "0.75rem" }}>LLM JSON (words 배열)</div>
        <pre
          style={{
            margin: 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {words.length > 0 ? JSON.stringify({ words }, null, 2) : "(없음)"}
        </pre>
      </section>
    </div>
  );
}
