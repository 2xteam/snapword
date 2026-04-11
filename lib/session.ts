export type SessionUser = { id: string; name: string; phone: string };

export const SESSION_KEY = "snapword_user";

export function loadSession(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionUser;
    if (!parsed?.id || !parsed?.phone) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(user: SessionUser) {
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function clearSession() {
  window.sessionStorage.removeItem(SESSION_KEY);
}
