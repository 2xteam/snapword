"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Platform = "android" | "ios" | "other";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as Record<string, unknown>).standalone === true)
  );
}

export function InstallButton() {
  const [platform, setPlatform] = useState<Platform>("other");
  const [installed, setInstalled] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [canPrompt, setCanPrompt] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    setInstalled(isStandalone());

    const handler = (e: Event) => {
      e.preventDefault();
      deferredRef.current = e as BeforeInstallPromptEvent;
      setCanPrompt(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const appInstalled = () => setInstalled(true);
    window.addEventListener("appinstalled", appInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", appInstalled);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (platform === "ios") {
      setShowIosGuide(true);
      return;
    }
    if (deferredRef.current) {
      await deferredRef.current.prompt();
      const { outcome } = await deferredRef.current.userChoice;
      if (outcome === "accepted") setInstalled(true);
      deferredRef.current = null;
      setCanPrompt(false);
    }
  }, [platform]);

  if (installed) return null;
  if (platform === "other") return null;
  if (platform === "android" && !canPrompt) return null;

  return (
    <>
      <button
        type="button"
        onClick={handleInstall}
        style={btnStyle}
        data-guide="install-btn"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
          <path d="M12 16V4m0 12l-4-4m4 4l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M20 21H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span>홈 화면에 바로가기 추가</span>
      </button>

      {/* iOS 안내 모달 */}
      {showIosGuide && (
        <div style={overlayStyle} onClick={() => setShowIosGuide(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowIosGuide(false)} style={closeBtnStyle} aria-label="닫기">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <div style={{ fontSize: 36, textAlign: "center", marginBottom: 8 }}>📱</div>
            <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700, color: "var(--text-primary)", textAlign: "center" }}>
              홈 화면에 추가하기
            </h3>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8 }}>
              <div style={stepStyle}>
                <span style={stepNumStyle}>1</span>
                하단의 <strong>공유 버튼</strong>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ verticalAlign: "middle", margin: "0 2px" }}>
                  <path d="M12 3v12m0-12l-4 4m4-4l4 4M4 15v4h16v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                을 누르세요
              </div>
              <div style={stepStyle}>
                <span style={stepNumStyle}>2</span>
                <strong>&quot;홈 화면에 추가&quot;</strong>를 선택하세요
              </div>
              <div style={stepStyle}>
                <span style={stepNumStyle}>3</span>
                <strong>&quot;추가&quot;</strong>를 누르면 완료!
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Styles ── */

const btnStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  width: "100%",
  padding: "14px 0",
  borderRadius: 14,
  border: "1px solid var(--border)",
  background: "var(--bg-card)",
  color: "var(--text-primary)",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  transition: "background 0.15s",
};

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 10010,
  background: "rgba(0,0,0,0.5)",
  backdropFilter: "blur(3px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  animation: "rss-modal-overlay-in 0.25s ease",
};

const modalStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  maxWidth: 320,
  background: "var(--bg-card, #fff)",
  borderRadius: 20,
  padding: "2rem 1.5rem 1.5rem",
  boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
  animation: "rss-modal-slide-up 0.3s ease",
};

const closeBtnStyle: CSSProperties = {
  position: "absolute",
  top: 12,
  right: 12,
  background: "none",
  border: "none",
  color: "var(--text-muted)",
  cursor: "pointer",
  padding: 4,
  borderRadius: 8,
  display: "flex",
};

const stepStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 8,
};

const stepNumStyle: CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: "50%",
  background: "var(--accent)",
  color: "#fff",
  fontSize: 12,
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};
