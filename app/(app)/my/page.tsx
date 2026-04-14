"use client";

import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { PRESET_THEMES, type ThemeCustomColor, type ThemeId } from "@/lib/theme";
import { loadSession, type SessionUser } from "@/lib/session";

export default function MyPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [vocabCount, setVocabCount] = useState(0);
  const [testCount, setTestCount] = useState(0);
  const [avg, setAvg] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  const { themeId, custom, setTheme } = useTheme();
  const [customAccent, setCustomAccent] = useState(custom.accent);
  const [customBg, setCustomBg] = useState(custom.bg);

  useEffect(() => {
    const s = loadSession();
    if (!s) router.replace("/");
    else setSession(s);
  }, [router]);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const res = await fetch(
        `/api/stats/me?phone=${encodeURIComponent(session.phone)}&userId=${encodeURIComponent(session.id)}`,
      );
      const json = (await res.json()) as {
        ok: boolean;
        vocabularyCount?: number;
        testCount?: number;
        averageScore?: number | null;
      };
      if (json.ok) {
        setVocabCount(json.vocabularyCount ?? 0);
        setTestCount(json.testCount ?? 0);
        setAvg(json.averageScore ?? null);
      }
      setLoaded(true);
    })();
  }, [session]);

  // 커스텀 색상이 외부에서 바뀌면 동기화
  useEffect(() => {
    setCustomAccent(custom.accent);
    setCustomBg(custom.bg);
  }, [custom]);

  const applyCustom = () => {
    const c: ThemeCustomColor = { accent: customAccent, bg: customBg };
    setTheme("custom", c);
  };

  if (!session) return null;

  const tier =
    (avg ?? 0) >= 85 ? "gold" : (avg ?? 0) >= 70 ? "silver" : "starter";

  const tierConfig = {
    gold: { label: "골드 모멘텀", icon: "🏆", color: "#fbbf24", border: "rgba(234,179,8,0.25)" },
    silver: { label: "실버 스텝", icon: "✨", color: "#94a3b8", border: "rgba(148,163,184,0.25)" },
    starter: { label: "스타터 파워", icon: "🌱", color: "var(--accent)", border: "var(--border)" },
  }[tier];

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      {/* Profile */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "1rem", borderRadius: 14, background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--accent-subtle)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
          {session.name.charAt(0)}
        </div>
        <div>
          <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 15 }}>{session.name}</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{session.phone}</div>
        </div>
      </div>

      {/* Tier */}
      <div style={{ padding: "1rem 1.25rem", borderRadius: 14, background: "var(--bg-card)", border: `1px solid ${tierConfig.border}`, display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ fontSize: 28 }}>{tierConfig.icon}</span>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>현재 등급</div>
          <div style={{ fontSize: "1.15rem", fontWeight: 700, color: tierConfig.color }}>{tierConfig.label}</div>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
            {tier === "starter"
              ? "매일 한 세트만 꾸준히 하면 평균이 빠르게 따라옵니다."
              : "꾸준함이 보여요. 복습 타이밍을 지키는 것도 큰 성취입니다."}
          </p>
        </div>
      </div>

      {/* Stats */}
      {!loaded ? (
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>로딩중입니다…</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.6rem" }}>
          <StatCard label="단어장" value={String(vocabCount)} />
          <StatCard label="시험 횟수" value={String(testCount)} />
          <StatCard label="평균 점수" value={avg === null ? "—" : `${avg}점`} />
        </div>
      )}

      {/* Theme selector */}
      <div style={{ borderRadius: 14, background: "var(--bg-card)", border: "1px solid var(--border)", overflow: "hidden" }}>
        <div style={{ padding: "0.85rem 1rem 0.6rem", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>테마</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>앱 전체 색상 분위기를 변경합니다.</div>
        </div>

        {/* Preset swatches */}
        <div style={{ padding: "0.85rem 1rem", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.6rem" }}>
          {PRESET_THEMES.map((t) => {
            const isActive = themeId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  if (t.id === "custom") {
                    // 커스텀 카드 클릭 → 색상 패널 활성화만(아직 적용 안 함)
                    setTheme("custom", { accent: customAccent, bg: customBg });
                  } else {
                    setTheme(t.id as ThemeId);
                  }
                }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  padding: "0.65rem 0.4rem",
                  borderRadius: 12,
                  border: isActive
                    ? `2px solid var(--accent)`
                    : "1px solid var(--border)",
                  background: isActive ? "var(--accent-subtle)" : "var(--bg-elevated)",
                  cursor: "pointer",
                  transition: "border-color 0.15s, background 0.15s",
                }}
              >
                {/* 미니 프리뷰 */}
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: t.id === "custom"
                    ? `linear-gradient(135deg, ${customBg} 50%, ${customAccent} 50%)`
                    : t.preview.bg,
                  border: `3px solid ${t.preview.accent}`,
                  flexShrink: 0,
                  position: "relative",
                  overflow: "hidden",
                }}>
                  {t.id !== "custom" && (
                    <div style={{
                      position: "absolute", bottom: 4, left: "50%",
                      transform: "translateX(-50%)",
                      width: 16, height: 3,
                      borderRadius: 2,
                      background: t.preview.accent,
                    }} />
                  )}
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: isActive ? "var(--accent)" : "var(--text-secondary)" }}>
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Custom color pickers — 항상 렌더, 비활성 시 흐리게 */}
        <div style={{
          margin: "0 1rem 0.85rem",
          padding: "0.85rem",
          borderRadius: 12,
          background: "var(--bg-elevated)",
          border: `1px solid ${themeId === "custom" ? "var(--accent)" : "var(--border-subtle)"}`,
          opacity: themeId === "custom" ? 1 : 0.45,
          pointerEvents: themeId === "custom" ? "auto" : "none",
          transition: "opacity 0.2s, border-color 0.2s",
        }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.65rem" }}>
              커스텀 색상 설정
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <ColorPicker
                label="배경색"
                value={customBg}
                onChange={setCustomBg}
              />
              <ColorPicker
                label="강조색"
                value={customAccent}
                onChange={setCustomAccent}
              />
            </div>
            <button
              type="button"
              onClick={applyCustom}
              style={{
                marginTop: "0.65rem",
                width: "100%",
                padding: "0.55rem",
                borderRadius: 10,
                border: "none",
                background: customAccent,
                color: "#fff",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                transition: "filter 0.15s",
              }}
            >
              커스텀 테마 적용
            </button>
          </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={statStyle}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--text-primary)", marginTop: 4 }}>{value}</div>
    </div>
  );
}

function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label style={{ display: "grid", gap: 5, fontSize: 12, color: "var(--text-muted)", cursor: "pointer" }}>
      {label}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: 34,
            height: 34,
            padding: 2,
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--input-bg)",
            cursor: "pointer",
            flexShrink: 0,
          }}
        />
        <input
          type="text"
          value={value}
          maxLength={7}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v);
          }}
          style={{ fontSize: 12, width: "100%", fontFamily: "monospace" }}
          placeholder="#rrggbb"
        />
      </div>
    </label>
  );
}

const statStyle: CSSProperties = {
  padding: "0.85rem",
  borderRadius: 12,
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  textAlign: "center",
};
