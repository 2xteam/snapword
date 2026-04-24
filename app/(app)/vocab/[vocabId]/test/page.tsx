"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadSession, type SessionUser } from "@/lib/session";
import {
  buildMcqQuestionsFromPool,
  clueTypeLabelKo,
  normalizeWordFromApi,
  type McqQuestion,
  type TestClueType,
  type WordForMcq,
} from "@/lib/testMcq";

type W = WordForMcq;
type Q = McqQuestion;
type TestResultType = TestClueType;

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

export default function TestPage() {
  const { vocabId } = useParams<{ vocabId: string }>();
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [words, setWords] = useState<W[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [qs, setQs] = useState<Q[]>([]);
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [answers, setAnswers] = useState<{ wordId: string; isCorrect: boolean; type: TestResultType }[]>([]);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const submitted = useRef(false);
  useEffect(() => {
    submitted.current = false;
  }, [vocabId]);

  useEffect(() => {
    const s = loadSession();
    if (!s) router.replace("/");
    else setSession(s);
  }, [router]);

  useEffect(() => {
    if (!session || !vocabId) return;
    (async () => {
      const [dr, wr] = await Promise.all([
        fetch(`/api/vocabularies/${vocabId}?phone=${encodeURIComponent(session.phone)}`),
        fetch(`/api/words?vocabId=${encodeURIComponent(vocabId)}`),
      ]);
      const dj = (await dr.json()) as { ok: boolean; item?: { folderId: string } };
      const wj = (await wr.json()) as { ok: boolean; items?: unknown[] };
      if (dj.ok && dj.item?.folderId) setFolderId(String(dj.item.folderId));
      if (wj.ok && wj.items) {
        const list = wj.items.map(normalizeWordFromApi);
        setWords(list);
        setQs(buildMcqQuestionsFromPool(list));
      }
      setLoaded(true);
    })();
  }, [session, vocabId]);

  const q = qs[step];
  const progress = useMemo(() => (qs.length ? Math.round((step / qs.length) * 100) : 0), [step, qs.length]);

  const pick = (opt: string) => {
    if (!q || picked) return;
    setPicked(opt);
    const isCorrect = opt === q.answer;
    setAnswers((prev) => [...prev, { wordId: q.wordId, isCorrect, type: q.type }]);
  };

  const next = () => {
    setPicked(null);
    if (step + 1 >= qs.length) setDone(true);
    else setStep((s) => s + 1);
  };

  const submitSession = useCallback(async () => {
    if (!session || !vocabId || !folderId || answers.length === 0) return;
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/test-sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phone: session.phone,
          userId: session.id,
          vocabId,
          folderId,
          answers,
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string; score?: number };
      if (!res.ok || !json.ok) setMsg(json.error ?? "제출 실패");
      else setMsg(`제출 완료! 점수 ${json.score}점`);
    } finally {
      setSubmitting(false);
    }
  }, [session, vocabId, folderId, answers]);

  useEffect(() => {
    if (done && answers.length && !submitted.current) {
      submitted.current = true;
      void submitSession();
    }
  }, [done, answers.length, submitSession]);

  if (!session) return null;

  const correctN = answers.filter((a) => a.isCorrect).length;
  const scorePct = answers.length ? Math.round((correctN / answers.length) * 100) : 0;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.75rem" }}>
        <Link href={`/vocab/${vocabId}`} style={backBtnStyle} title="뒤로">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <h1 style={{ margin: 0, fontSize: "1.2rem", color: "var(--text-primary)" }}>Test</h1>
      </div>

      {!done && q ? (
        <div style={{ marginTop: "1rem" }}>
          <div style={{ height: 3, borderRadius: 2, background: "var(--bg-elevated)", overflow: "hidden", marginBottom: "1rem" }}>
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                background: "var(--accent)",
                transition: "width 0.3s ease",
              }}
            />
          </div>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            힌트 유형: <strong>{clueTypeLabelKo(q.type)}</strong> · {step + 1}/{qs.length}
          </p>
          <div
            style={{
              padding: "1.25rem",
              borderRadius: "var(--radius-lg)",
              background: "var(--bg-card)",
              marginBottom: "1rem",
              fontSize: "1.05rem",
              lineHeight: 1.5,
              color: "var(--text-primary)",
            }}
          >
            {q.clue}
          </div>
          <p style={{ fontWeight: 700, marginBottom: 8, color: "var(--text-primary)" }}>정답 단어 고르기</p>
          <div style={{ display: "grid", gap: 8 }}>
            {q.options.map((opt) => {
              const show = picked !== null;
              const hit = opt === q.answer;
              const wrongPick = show && opt === picked && !hit;
              return (
                <button
                  key={opt}
                  type="button"
                  disabled={picked !== null}
                  onClick={() => pick(opt)}
                  style={{
                    textAlign: "left",
                    padding: "0.75rem 1rem",
                    borderRadius: "var(--radius-sm)",
                    border: show && hit
                      ? "2px solid var(--success)"
                      : wrongPick
                        ? "2px solid var(--danger)"
                        : "1px solid var(--border)",
                    background: show && hit
                      ? "var(--success-subtle)"
                      : wrongPick
                        ? "var(--danger-subtle)"
                        : "var(--bg-elevated)",
                    color: show && hit
                      ? "#4ade80"
                      : wrongPick
                        ? "#fca5a5"
                        : "var(--text-primary)",
                    fontSize: 15,
                    cursor: picked !== null ? "default" : "pointer",
                  }}
                >
                  {opt}
                </button>
              );
            })}
          </div>
          {picked ? (
            <button
              type="button"
              onClick={next}
              style={{
                marginTop: "1rem",
                width: "100%",
                background: "var(--accent)",
                color: "#000",
                border: "none",
                fontWeight: 600,
              }}
            >
              {step + 1 >= qs.length ? "결과 보기" : "다음 문제"}
            </button>
          ) : null}
        </div>
      ) : done ? (
        <ResultPanel scorePct={scorePct} correct={correctN} total={answers.length} msg={msg} submitting={submitting} />
      ) : !loaded ? (
        <p style={{ color: "var(--text-muted)" }}>로딩중입니다…</p>
      ) : (
        <p style={{ color: "var(--text-secondary)" }}>
          문제를 만들 수 없습니다. 단어가 2개 이상이고 힌트 필드를 채워 주세요.
        </p>
      )}
    </div>
  );
}

function ResultPanel({
  scorePct,
  correct,
  total,
  msg,
  submitting,
}: {
  scorePct: number;
  correct: number;
  total: number;
  msg: string | null;
  submitting: boolean;
}) {
  const great = scorePct >= 90;
  const ok = scorePct >= 60;
  const low = scorePct < 60;
  return (
    <div
      style={{
        marginTop: "1.5rem",
        padding: "1.75rem 1.25rem",
        borderRadius: "var(--radius-lg)",
        textAlign: "center",
        background: great
          ? "rgba(234, 179, 8, 0.1)"
          : ok
            ? "rgba(59, 130, 246, 0.1)"
            : "rgba(236, 72, 153, 0.1)",
        border: great
          ? "2px solid rgba(234, 179, 8, 0.4)"
          : ok
            ? "2px solid rgba(96, 165, 250, 0.4)"
            : "2px solid rgba(244, 114, 182, 0.4)",
        boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
      }}
    >
      <div style={{ fontSize: 56, lineHeight: 1 }}>{great ? "\u{1F3C6}" : ok ? "\u2728" : "\u{1F4AA}"}</div>
      <h2 style={{ margin: "0.5rem 0", fontSize: "1.75rem", color: "var(--text-primary)" }}>{scorePct}점</h2>
      <p style={{ margin: "0 0 1rem", color: "var(--text-secondary)", fontSize: 15 }}>
        {correct} / {total} 정답
      </p>
      {great ? (
        <p style={{ color: "#fbbf24", fontWeight: 600 }}>훌륭해요! 이 흐름을 유지해 보세요.</p>
      ) : ok ? (
        <p style={{ color: "#60a5fa", fontWeight: 600 }}>좋은 페이스예요. 조금만 더 다듬으면 만점도 가깝습니다.</p>
      ) : (
        <p style={{ color: "#f472b6", fontWeight: 600 }}>
          점수는 한때의 숫자일 뿐이에요. 틀린 단어가 곧 성장 포인트입니다. Study에서 다시 만나요!
        </p>
      )}
      {low ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}>
          작은 목표: 오늘 3개만 완벽하게. 반복이 실력을 만듭니다.
        </p>
      ) : null}
      <p style={{ marginTop: "1rem", fontSize: 13, color: "var(--text-secondary)" }}>
        {submitting ? "서버에 기록하는 중…" : msg ?? ""}
      </p>
    </div>
  );
}
