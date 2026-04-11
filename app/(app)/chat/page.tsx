"use client";

import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import { loadSession, type SessionUser } from "@/lib/session";

type Thread = { _id: string; title: string; updatedAt: string };
type Msg = { _id: string; role: string; content: string; createdAt: string };

const DRAFT_ID = "__draft__";

export default function ChatPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const s = loadSession();
    if (!s) router.replace("/");
    else setSession(s);
  }, [router]);

  const loadThreads = useCallback(async (s: SessionUser) => {
    const res = await fetch(
      `/api/chat/threads?phone=${encodeURIComponent(s.phone)}&userId=${encodeURIComponent(s.id)}`,
    );
    const json = (await res.json()) as { ok: boolean; items?: Thread[] };
    if (json.ok && json.items) setThreads(json.items);
  }, []);

  const fetchMessages = useCallback(
    async (s: SessionUser, threadId: string) => {
      const res = await fetch(
        `/api/chat/threads/${threadId}/messages?phone=${encodeURIComponent(s.phone)}&userId=${encodeURIComponent(s.id)}`,
      );
      const json = (await res.json()) as { ok: boolean; items?: Msg[] };
      if (json.ok && json.items) setMessages(json.items);
      else setMessages([]);
    },
    [],
  );

  const openThread = useCallback(
    async (id: string, s: SessionUser) => {
      setActive(id);
      setSidebarOpen(false);
      if (id === DRAFT_ID) {
        setMessages([]);
        return;
      }
      await fetchMessages(s, id);
    },
    [fetchMessages],
  );

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    (async () => {
      const res = await fetch(
        `/api/chat/threads?phone=${encodeURIComponent(session.phone)}&userId=${encodeURIComponent(session.id)}`,
      );
      const json = (await res.json()) as { ok: boolean; items?: Thread[] };
      if (cancelled) return;
      const list = json.ok && json.items ? json.items : [];
      setThreads(list);

      if (list.length > 0) {
        const latest = list[0]!;
        setActive(latest._id);
        await fetchMessages(session, latest._id);
      } else {
        setActive(DRAFT_ID);
        setMessages([]);
      }
    })();

    return () => { cancelled = true; };
  }, [session, fetchMessages]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const startNewDraft = () => {
    setActive(DRAFT_ID);
    setMessages([]);
    setInput("");
    setSidebarOpen(false);
  };

  const send = async () => {
    if (!session || !input.trim()) return;
    const text = input.trim();
    setInput("");

    let threadId = active;

    if (threadId === DRAFT_ID || !threadId) {
      const res = await fetch("/api/chat/threads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: session.phone, userId: session.id }),
      });
      const json = (await res.json()) as { ok: boolean; id?: string };
      if (!json.ok || !json.id) return;
      threadId = json.id;
      setActive(threadId);
      const now = new Date().toISOString();
      setThreads((prev) => [{ _id: threadId!, title: "새 대화", updatedAt: now }, ...prev]);
    }

    const pendingUserId = `local-user-${Date.now()}`;
    const pendingAiId = `local-ai-${Date.now()}`;
    const now = new Date().toISOString();
    setMessages((m) => [
      ...m,
      { _id: pendingUserId, role: "user", content: text, createdAt: now },
      { _id: pendingAiId, role: "assistant", content: "", createdAt: now },
    ]);
    setBusy(true);
    try {
      const res = await fetch(`/api/chat/threads/${threadId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: session.phone, userId: session.id, text }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        threadTitle?: string | null;
      };
      if (!res.ok || !json.ok) {
        setMessages((m) =>
          m.filter((x) => x._id !== pendingUserId && x._id !== pendingAiId).concat([
            { _id: `err-${Date.now()}`, role: "assistant", content: json.error ?? "오류", createdAt: new Date().toISOString() },
          ]),
        );
        setInput(text);
        return;
      }
      if (json.threadTitle) {
        setThreads((prev) =>
          prev.map((t) => (t._id === threadId ? { ...t, title: json.threadTitle! } : t)),
        );
      }
      await fetchMessages(session, threadId);
      await loadThreads(session);
    } catch {
      setMessages((m) =>
        m.filter((x) => x._id !== pendingUserId && x._id !== pendingAiId).concat([
          { _id: `err-${Date.now()}`, role: "assistant", content: "네트워크 오류로 전송에 실패했습니다.", createdAt: new Date().toISOString() },
        ]),
      );
      setInput(text);
    } finally {
      setBusy(false);
    }
  };

  if (!session) return null;

  const activeTitle = active === DRAFT_ID
    ? "새 대화"
    : threads.find((t) => t._id === active)?.title ?? "대화";

  const SIDEBAR_W = 260;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - var(--nav-height) - var(--nav-top) - 3rem)", minHeight: 0 }}>
      <section
        style={{
          position: "relative",
          border: "1px solid var(--border)",
          borderRadius: 14,
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-card)",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {/* 메인 채팅: 항상 section 전체 너비 (이력 패널이 레이아웃을 밀지 않음) */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "0.6rem 0.75rem",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={() => setSidebarOpen((o) => !o)}
              title={sidebarOpen ? "대화 이력 접기" : "대화 이력 펼치기"}
              aria-expanded={sidebarOpen}
              aria-label={sidebarOpen ? "대화 이력 접기" : "대화 이력 펼치기"}
              style={{
                background: "none",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "0.3rem 0.45rem",
                cursor: "pointer",
                color: "var(--text-secondary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {sidebarOpen ? <IconChevronLeft /> : <IconChevronRight />}
            </button>
            <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 14, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {activeTitle}
            </span>
            <button
              type="button"
              onClick={startNewDraft}
              style={{
                background: "none",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "0.3rem 0.5rem",
                cursor: "pointer",
                color: "var(--text-secondary)",
                fontSize: 12,
                flexShrink: 0,
              }}
            >
              + 새 채팅
            </button>
          </div>

          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              overflowX: "hidden",
              padding: "0.75rem",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {messages.length === 0 && active === DRAFT_ID ? (
              <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <p style={{ color: "var(--text-muted)", fontSize: 14 }}>메시지를 입력하여 대화를 시작하세요.</p>
              </div>
            ) : (
              messages.map((m) => {
                const isPendingAi = m._id.startsWith("local-ai-") && busy;
                const isUser = m.role === "user";
                return (
                  <div
                    key={m._id}
                    style={{ display: "flex", width: "100%", justifyContent: isUser ? "flex-end" : "flex-start", flexShrink: 0 }}
                  >
                    <div
                      className={`chat-md ${isUser ? "chat-md-user" : ""}`}
                      style={{
                        maxWidth: "min(92%, 28rem)",
                        padding: "0.55rem 0.75rem",
                        borderRadius: isUser ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                        background: isUser ? "var(--accent)" : m._id.startsWith("err-") ? "var(--danger-subtle)" : "var(--bg-elevated)",
                        color: isUser ? "#fff" : m._id.startsWith("err-") ? "#fca5a5" : "var(--text-primary)",
                        fontSize: 14,
                        border: isPendingAi ? "1px dashed var(--text-muted)" : undefined,
                      }}
                    >
                      {isPendingAi ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <span className="snapword-chat-wait" style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                            응답을 작성하는 중입니다…
                          </span>
                          <span style={{ display: "flex", alignItems: "center" }} aria-hidden>
                            <span className="snapword-chat-dot" />
                            <span className="snapword-chat-dot" />
                            <span className="snapword-chat-dot" />
                          </span>
                        </div>
                      ) : (
                        <Markdown>{m.content}</Markdown>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottom} />
          </div>

          <div style={{ display: "flex", gap: 8, padding: "0.5rem", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={busy ? "응답 대기 중…" : "메시지를 입력하세요…"}
              disabled={busy}
              style={{ flex: 1, fontSize: 14, opacity: busy ? 0.75 : 1, minWidth: 0 }}
              onKeyDown={(e) => e.key === "Enter" && !busy && void send()}
            />
            <button
              type="button"
              disabled={busy || !input.trim()}
              onClick={() => void send()}
              style={{ ...btnSend, opacity: busy ? 0.85 : 1, cursor: busy ? "wait" : "pointer" }}
            >
              {busy ? "대기…" : "전송"}
            </button>
          </div>
        </div>

        {sidebarOpen && (
          <div
            role="presentation"
            aria-hidden
            onClick={() => setSidebarOpen(false)}
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 4,
              background: "rgba(0, 0, 0, 0.42)",
              borderRadius: 13,
            }}
          />
        )}

        <aside
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            width: SIDEBAR_W,
            zIndex: 5,
            transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
            transition: "transform 0.22s ease",
            background: "var(--bg-elevated)",
            borderRight: "1px solid var(--border)",
            borderTopLeftRadius: 13,
            borderBottomLeftRadius: 13,
            display: "flex",
            flexDirection: "column",
            boxShadow: sidebarOpen ? "4px 0 20px rgba(0, 0, 0, 0.2)" : "none",
            pointerEvents: sidebarOpen ? "auto" : "none",
            overflow: "hidden",
          }}
          aria-hidden={!sidebarOpen}
        >
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: "0.75rem",
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>대화 이력</span>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                title="이력 패널 접기"
                aria-label="대화 이력 패널 접기"
                style={{
                  background: "none",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "0.25rem",
                  cursor: "pointer",
                  color: "var(--text-secondary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <IconChevronLeft />
              </button>
            </div>
            <button type="button" onClick={startNewDraft} style={btnNewChat}>
              + 새 채팅
            </button>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minHeight: 0, overflowY: "auto" }}>
              {threads.map((t) => (
                <button
                  key={t._id}
                  type="button"
                  onClick={() => void openThread(t._id, session)}
                  style={{
                    ...btnThread,
                    border: active === t._id ? "2px solid var(--accent)" : "1px solid var(--border)",
                    background: active === t._id ? "var(--accent-subtle)" : "var(--bg-card)",
                    color: active === t._id ? "var(--text-primary)" : "var(--text-secondary)",
                    fontWeight: active === t._id ? 600 : 500,
                    height: 38,
                    flexShrink: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t.title}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function IconChevronLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const btnNewChat: CSSProperties = {
  width: "100%",
  textAlign: "center",
  padding: "0.5rem 0.65rem",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--bg-elevated)",
  color: "var(--text-primary)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const btnThread: CSSProperties = {
  textAlign: "left",
  padding: "0.5rem",
  borderRadius: 10,
  fontSize: 13,
  cursor: "pointer",
};

const btnSend: CSSProperties = {
  padding: "0.5rem 1rem",
  borderRadius: 10,
  border: "none",
  background: "var(--accent)",
  color: "#fff",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};
