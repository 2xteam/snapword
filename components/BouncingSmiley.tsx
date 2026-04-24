"use client";

import { useEffect, useRef, useCallback, memo } from "react";

const NEON_COLORS = [
  "#2ee8ae", "#00e5ff", "#76ff03", "#ffea00",
  "#ff6d00", "#ff1744", "#f50057", "#d500f9",
  "#651fff", "#00b0ff", "#1de9b6", "#ffd600",
  "#ff4ecd", "#00ffa3", "#7c4dff", "#18ffff",
];

const SIZE = 52;
const SPEED = 1.8;

function pickRandom<T>(arr: T[], exclude?: T): T {
  const pool = exclude ? arr.filter((c) => c !== exclude) : arr;
  return pool[Math.floor(Math.random() * pool.length)];
}

function randomAngle(): number {
  const minDeg = 25;
  const maxDeg = 65;
  const quadrant = Math.floor(Math.random() * 4);
  const deg = minDeg + Math.random() * (maxDeg - minDeg);
  const rad = (deg * Math.PI) / 180;
  switch (quadrant) {
    case 0: return rad;
    case 1: return Math.PI - rad;
    case 2: return Math.PI + rad;
    default: return 2 * Math.PI - rad;
  }
}

function buildSvg(score: number, color: string): string {
  const dk = "rgba(0,0,0,0.6)";
  const wh = "rgba(255,255,255,0.55)";

  let mouth = "";
  switch (score) {
    case 2:
      mouth = `<path d="M22 42 Q32 54, 42 42" fill="none" stroke="${dk}" stroke-width="3" stroke-linecap="round"/>
               <line x1="25" y1="43" x2="39" y2="43" stroke="${dk}" stroke-width="1.5"/>`;
      break;
    case 1:
      mouth = `<path d="M24 40 Q32 48, 40 40" fill="none" stroke="${dk}" stroke-width="2.5" stroke-linecap="round"/>`;
      break;
    case 0:
      mouth = `<line x1="24" y1="40" x2="40" y2="40" stroke="${dk}" stroke-width="2.5" stroke-linecap="round"/>`;
      break;
    case -1:
      mouth = `<path d="M24 44 Q32 36, 40 44" fill="none" stroke="${dk}" stroke-width="2.5" stroke-linecap="round"/>`;
      break;
    case -2:
      mouth = `<ellipse cx="32" cy="42" rx="8" ry="5" fill="${dk}"/>
               <ellipse cx="21" cy="50" rx="2.5" ry="4" fill="rgba(100,180,255,0.7)"/>
               <ellipse cx="43" cy="50" rx="2.5" ry="4" fill="rgba(100,180,255,0.7)"/>`;
      break;
    default:
      mouth = `<line x1="24" y1="40" x2="40" y2="40" stroke="${dk}" stroke-width="2.5" stroke-linecap="round"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <circle cx="32" cy="32" r="30" fill="${color}"/>
    <circle cx="23" cy="28" r="4.5" fill="${dk}"/>
    <circle cx="41" cy="28" r="4.5" fill="${dk}"/>
    <circle cx="24.5" cy="26.5" r="1.5" fill="${wh}"/>
    <circle cx="42.5" cy="26.5" r="1.5" fill="${wh}"/>
    ${mouth}
  </svg>`;
}

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

interface Props {
  score: number;
  seed: string;
  paused?: boolean;
}

function BouncingSmileyInner({ score, seed, paused }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({
    x: 0, y: 0, vx: 0, vy: 0,
    color: NEON_COLORS[0], initialized: false,
  });
  const elRef = useRef<HTMLDivElement>(null);
  const rafId = useRef(0);
  const prevSeed = useRef(seed);

  const clampedScore = Math.max(-2, Math.min(2, Math.round(score)));

  const applyColor = useCallback((color: string) => {
    stateRef.current.color = color;
    const el = elRef.current;
    if (!el) return;
    const svg = buildSvg(clampedScore, color);
    el.style.backgroundImage = `url("${svgToDataUrl(svg)}")`;
  }, [clampedScore]);

  useEffect(() => {
    const container = containerRef.current;
    const el = elRef.current;
    if (!container || !el) return;

    const needsInit = !stateRef.current.initialized || prevSeed.current !== seed;
    prevSeed.current = seed;

    if (needsInit) {
      const cw = container.offsetWidth;
      const ch = container.offsetHeight;
      const margin = SIZE + 4;

      stateRef.current.x = margin + Math.random() * Math.max(0, cw - 2 * margin);
      stateRef.current.y = margin + Math.random() * Math.max(0, ch - 2 * margin);

      const newColor = pickRandom(NEON_COLORS);
      applyColor(newColor);

      const angle = randomAngle();
      stateRef.current.vx = Math.cos(angle) * SPEED;
      stateRef.current.vy = Math.sin(angle) * SPEED;
      stateRef.current.initialized = true;
    }

    if (paused) return;

    const tick = () => {
      const s = stateRef.current;
      const cw = container.offsetWidth;
      const ch = container.offsetHeight;
      let bounced = false;

      s.x += s.vx;
      s.y += s.vy;

      if (s.x <= 0) { s.x = 0; s.vx = Math.abs(s.vx); bounced = true; }
      else if (s.x + SIZE >= cw) { s.x = cw - SIZE; s.vx = -Math.abs(s.vx); bounced = true; }

      if (s.y <= 0) { s.y = 0; s.vy = Math.abs(s.vy); bounced = true; }
      else if (s.y + SIZE >= ch) { s.y = ch - SIZE; s.vy = -Math.abs(s.vy); bounced = true; }

      if (bounced) {
        applyColor(pickRandom(NEON_COLORS, s.color));
      }

      el.style.transform = `translate(${s.x}px, ${s.y}px) rotate(180deg)`;
      rafId.current = requestAnimationFrame(tick);
    };

    rafId.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId.current);
  }, [seed, paused, applyColor]);

  const handleTap = useCallback(() => {
    const s = stateRef.current;
    const angle = randomAngle();
    s.vx = Math.cos(angle) * SPEED;
    s.vy = Math.sin(angle) * SPEED;
    applyColor(pickRandom(NEON_COLORS, s.color));
  }, [applyColor]);

  const initSvg = buildSvg(clampedScore, stateRef.current.color);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 0,
        borderRadius: "inherit",
      }}
    >
      <div
        ref={elRef}
        onClick={handleTap}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: SIZE,
          height: SIZE,
          willChange: "transform",
          backgroundImage: `url("${svgToDataUrl(initSvg)}")`,
          backgroundSize: "contain",
          opacity: paused ? 0.4 : 1,
          transition: "opacity 0.3s",
          transform: "rotate(180deg)",
          pointerEvents: "auto",
          cursor: "pointer",
        }}
      />
    </div>
  );
}

export const BouncingSmiley = memo(BouncingSmileyInner);
