"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  shouldShowGuide,
  dismissGuideForever,
  dismissGuideToday,
} from "@/lib/onboardingCookie";
import { getPageGuide, type GuideStep } from "@/lib/onboardingSteps";

type Phase = "idle" | "intro" | "running" | "done";

type Rect = { top: number; left: number; width: number; height: number };

export function OnboardingGuide() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("idle");
  const [localIdx, setLocalIdx] = useState(0);
  const [spotRect, setSpotRect] = useState<Rect | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const pageGuide = getPageGuide(pathname);
  const steps: GuideStep[] = pageGuide?.steps ?? [];
  const currentStep: GuideStep | null = phase === "running" && localIdx < steps.length ? steps[localIdx] : null;

  // Reset to idle when page changes
  useEffect(() => {
    setPhase("idle");
    setLocalIdx(0);
    setSpotRect(null);
  }, [pathname]);

  // Show intro popup on /home first visit
  useEffect(() => {
    if (pathname === "/home" && shouldShowGuide()) {
      const t = setTimeout(() => setPhase("intro"), 1200);
      return () => clearTimeout(t);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      observerRef.current?.disconnect();
    };
  }, []);

  // ── Spotlight positioning ──
  const positionSpotlight = useCallback(() => {
    if (!currentStep?.selector) { setSpotRect(null); return; }
    const el = document.querySelector(currentStep.selector);
    if (!el) { setSpotRect(null); return; }
    const r = el.getBoundingClientRect();
    const pad = 6;
    setSpotRect({
      top: r.top - pad + window.scrollY,
      left: r.left - pad,
      width: r.width + pad * 2,
      height: r.height + pad * 2,
    });
    const viewTop = window.scrollY;
    const viewBottom = viewTop + window.innerHeight;
    const elTop = r.top + window.scrollY;
    const elBottom = elTop + r.height;
    if (elTop < viewTop + 80 || elBottom > viewBottom - 160) {
      window.scrollTo({ top: Math.max(0, elTop - 120), behavior: "smooth" });
    }
  }, [currentStep]);

  useEffect(() => {
    if (phase !== "running" || !currentStep) return;
    timerRef.current = setTimeout(() => {
      positionSpotlight();
      observerRef.current?.disconnect();
      const obs = new MutationObserver(() => positionSpotlight());
      obs.observe(document.body, { childList: true, subtree: true });
      observerRef.current = obs;
      setTimeout(() => obs.disconnect(), 3000);
    }, 300);
    const handleResize = () => positionSpotlight();
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      observerRef.current?.disconnect();
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize);
    };
  }, [phase, localIdx, currentStep, positionSpotlight]);

  // Click outside spotlight+tooltip → close guide
  useEffect(() => {
    if (phase !== "running") return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (tooltipRef.current?.contains(target)) return;
      if (currentStep?.selector) {
        const spotEl = document.querySelector(currentStep.selector);
        if (spotEl?.contains(target)) return;
      }
      setPhase("idle");
      setSpotRect(null);
    };
    const t = setTimeout(() => {
      document.addEventListener("click", handler, true);
    }, 400);
    return () => {
      clearTimeout(t);
      document.removeEventListener("click", handler, true);
    };
  }, [phase, localIdx, currentStep]);

  // Reset spotRect when step changes so tooltip waits for position
  useEffect(() => {
    setSpotRect(null);
  }, [localIdx]);

  // ── Actions ──
  const goNext = useCallback(() => {
    if (localIdx + 1 >= steps.length) {
      setPhase("done");
      setSpotRect(null);
    } else {
      setLocalIdx(localIdx + 1);
    }
  }, [localIdx, steps.length]);

  const endGuide = useCallback(() => {
    setPhase("idle");
    setSpotRect(null);
  }, []);

  const startGuideFromFab = useCallback(() => {
    if (!steps.length) return;
    setLocalIdx(0);
    setPhase("running");
  }, [steps.length]);

  const startGuide = () => {
    setLocalIdx(0);
    setPhase("running");
  };

  // ═════════ RENDER ═════════

  // ── Intro popup ──
  if (phase === "intro") {
    return (
      <div style={introOverlay}>
        <div style={introCard}>
          <button onClick={() => { dismissGuideToday(); setPhase("idle"); }} style={introCloseBtn} aria-label="닫기">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <div style={{ fontSize: 40, textAlign: "center", marginBottom: 8 }}>📖</div>
          <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: "var(--text-primary)", textAlign: "center" }}>
            SnapWord 사용법을 안내해 드릴까요?
          </h2>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--text-secondary)", textAlign: "center", lineHeight: 1.6 }}>
            단어장 만들기부터 학습까지,{"\n"}
            주요 기능을 단계별로 알려드려요.
          </p>
          <button onClick={startGuide} style={introStartBtn}>
            네, 안내해 주세요!
          </button>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 12 }}>
            <button onClick={() => { dismissGuideToday(); setPhase("idle"); }} style={introSmallBtn}>오늘 보지 않기</button>
            <button onClick={() => { dismissGuideForever(); setPhase("idle"); }} style={introSmallBtn}>다시 보지 않기</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Done toast ──
  if (phase === "done") {
    setTimeout(() => setPhase("idle"), 1500);
    return <div style={doneToast}>가이드 완료!</div>;
  }

  // ── idle → FAB (only on pages with guide) ──
  if (phase === "idle") {
    if (!pageGuide) return null;
    return (
      <button type="button" onClick={startGuideFromFab} style={guideFab} aria-label="사용법 가이드" data-guide="guide-fab">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8 7h8M8 11h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    );
  }

  // ── Running ──
  if (!currentStep) return null;

  const isLast = localIdx === steps.length - 1;
  const ready = !!spotRect;
  const isFabStep = currentStep.selector === "[data-guide='guide-fab']";

  return (
    <>
      {/* Render FAB during the fab-explanation step so it can be spotlighted */}
      {isFabStep && (
        <div style={guideFab} data-guide="guide-fab">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M8 7h8M8 11h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      )}

      {/* Spotlight + Tooltip — appear together with fade-in */}
      {ready && (
        <>
          <div
            style={{
              position: "absolute",
              top: spotRect.top,
              left: spotRect.left,
              width: spotRect.width,
              height: spotRect.height,
              borderRadius: 12,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
              zIndex: 10000,
              pointerEvents: "none",
              animation: "guide-fade-in 0.5s ease",
            }}
          />
          <div
            ref={tooltipRef}
            style={{
              ...tooltipCard,
              ...getTooltipPosition(spotRect),
              animation: "guide-fade-in 0.5s ease",
            }}
          >
            {steps.length > 1 && (
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                {localIdx + 1} / {steps.length}
              </div>
            )}
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
              {currentStep.title}
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-secondary)", margin: "0 0 14px" }}>
              {currentStep.description}
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={endGuide} style={tooltipSkipBtn}>
                {steps.length === 1 ? "닫기" : "건너뛰기"}
              </button>
              {steps.length > 1 && (
                <button onClick={goNext} style={tooltipNextBtn}>
                  {isLast ? "완료" : "다음"}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ── Helpers ──

function getTooltipPosition(rect: Rect): CSSProperties {
  const viewH = typeof window !== "undefined" ? window.innerHeight : 800;
  const scrollY = typeof window !== "undefined" ? window.scrollY : 0;
  const viewW = typeof window !== "undefined" ? window.innerWidth : 400;
  const tooltipW = Math.min(320, viewW - 32);

  const spotScreenTop = rect.top - scrollY;
  const spotScreenBottom = spotScreenTop + rect.height;
  const belowSpace = viewH - spotScreenBottom;
  const aboveSpace = spotScreenTop;

  let left = rect.left + rect.width / 2 - tooltipW / 2;
  left = Math.max(16, Math.min(left, viewW - tooltipW - 16));

  // Prefer below the spotlight
  if (belowSpace > 180) {
    return { position: "absolute", top: rect.top + rect.height + 12, left, width: tooltipW };
  }
  // If not enough space below, try above
  if (aboveSpace > 180) {
    return { position: "absolute", top: rect.top - 12, left, width: tooltipW, transform: "translateY(-100%)" };
  }
  // Fallback: fixed center of the visible viewport
  return { position: "fixed", bottom: 24, left: 16, right: 16, width: "auto", maxWidth: tooltipW };
}

/* ── Styles ── */

const introOverlay: CSSProperties = {
  position: "fixed", inset: 0, zIndex: 10010,
  background: "rgba(0,0,0,0.5)", backdropFilter: "blur(3px)",
  display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
  animation: "rss-modal-overlay-in 0.25s ease",
};

const introCard: CSSProperties = {
  position: "relative", width: "100%", maxWidth: 340,
  background: "var(--bg-card, #fff)", borderRadius: 20,
  padding: "2rem 1.5rem 1.5rem", boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
  animation: "rss-modal-slide-up 0.3s ease",
};

const introCloseBtn: CSSProperties = {
  position: "absolute", top: 12, right: 12,
  background: "none", border: "none", color: "var(--text-muted)",
  cursor: "pointer", padding: 4, borderRadius: 8, display: "flex",
};

const introStartBtn: CSSProperties = {
  width: "100%", padding: "12px 0", borderRadius: 12,
  border: "none", background: "var(--accent)", color: "#fff",
  fontSize: 14, fontWeight: 700, cursor: "pointer",
};

const introSmallBtn: CSSProperties = {
  background: "none", border: "none", fontSize: 12,
  color: "var(--text-muted)", cursor: "pointer", padding: "4px 0",
  textDecoration: "underline",
};

const fullOverlay: CSSProperties = {
  position: "fixed", inset: 0, zIndex: 10000,
  background: "rgba(0,0,0,0.55)", pointerEvents: "none",
};

const tooltipCard: CSSProperties = {
  position: "absolute", zIndex: 10003,
  background: "var(--bg-card, #fff)", borderRadius: 14,
  padding: "16px 18px", boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
  maxWidth: 320, width: 320,
};

const tooltipSkipBtn: CSSProperties = {
  background: "none", border: "none", fontSize: 12,
  color: "var(--text-muted)", cursor: "pointer", padding: "6px 10px",
};

const tooltipNextBtn: CSSProperties = {
  padding: "6px 18px", borderRadius: 8, border: "none",
  background: "var(--accent)", color: "#fff", fontSize: 13,
  fontWeight: 600, cursor: "pointer",
};

const doneToast: CSSProperties = {
  position: "fixed", top: 24, left: "50%", transform: "translateX(-50%)",
  zIndex: 99999, padding: "10px 24px", borderRadius: 12,
  background: "var(--accent)", color: "#fff", fontSize: 14,
  fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
  animation: "rss-modal-overlay-in 0.2s ease",
};

const guideFab: CSSProperties = {
  position: "fixed", bottom: 88, right: 24, zIndex: 9998,
  width: 52, height: 52, borderRadius: "50%", border: "none",
  background: "var(--accent)", color: "#fff",
  cursor: "pointer", display: "flex", alignItems: "center",
  justifyContent: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
  transition: "transform 0.15s ease",
};
