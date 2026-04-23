const DISMISS_KEY = "guide_dismiss";
const TODAY_KEY = "guide_today";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export function shouldShowGuide(): boolean {
  if (getCookie(DISMISS_KEY) === "1") return false;
  const today = new Date().toISOString().slice(0, 10);
  if (getCookie(TODAY_KEY) === today) return false;
  return true;
}

export function dismissGuideForever() {
  document.cookie = `${DISMISS_KEY}=1; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

export function dismissGuideToday() {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const today = new Date().toISOString().slice(0, 10);
  document.cookie = `${TODAY_KEY}=${today}; path=/; expires=${end.toUTCString()}; SameSite=Lax`;
}
