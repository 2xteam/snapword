export type SessionUser = { id: string; name: string; phone: string };

export const SESSION_KEY = "snapword_user";

/** 로그인 유지 기간(밀리초). 기본 30일. */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type StoredPayload = { v: 1; user: SessionUser; expiresAt: number };

function isSessionUser(x: unknown): x is SessionUser {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return typeof o.id === "string" && typeof o.phone === "string";
}

function readPayload(raw: string): StoredPayload | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as Record<string, unknown>;
    if (o.v === 1 && isSessionUser(o.user) && typeof o.expiresAt === "number") {
      return { v: 1, user: o.user, expiresAt: o.expiresAt };
    }
    return null;
  } catch {
    return null;
  }
}

/** 예전 sessionStorage 형식(만료 없음) → 한 번만 localStorage로 이전 */
function migrateSessionStorageOnce(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as unknown;
    if (!isSessionUser(parsed)) return;
    window.sessionStorage.removeItem(SESSION_KEY);
    saveSession(parsed);
  } catch {
    /* ignore */
  }
}

export function loadSession(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    migrateSessionStorageOnce();

    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const payload = readPayload(raw);
    if (!payload) {
      window.localStorage.removeItem(SESSION_KEY);
      return null;
    }

    if (Date.now() > payload.expiresAt) {
      window.localStorage.removeItem(SESSION_KEY);
      return null;
    }

    return payload.user;
  } catch {
    return null;
  }
}

export function saveSession(user: SessionUser) {
  if (typeof window === "undefined") return;
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const body: StoredPayload = { v: 1, user, expiresAt };
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(body));
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function clearSession() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SESSION_KEY);
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}
