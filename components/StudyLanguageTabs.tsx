"use client";

import type { CSSProperties } from "react";
import { STUDY_LANGUAGES, STUDY_LANGUAGE_LABEL } from "@/lib/studyLanguage";
import { useStudyLanguage } from "@/lib/useStudyLanguage";

/**
 * 학습 언어 전환 탭 — 홈 · 폴더 목록 맨 위. 기본은 영어.
 * 고른 값은 이 브라우저에 기억되고, 탭이 있는 모든 화면이 함께 바뀐다 → lib/useStudyLanguage.ts
 */
export function StudyLanguageTabs({ guide }: { guide?: string }) {
  const { language, setLanguage } = useStudyLanguage();
  return (
    <div role="tablist" aria-label="학습 언어" style={tabs} {...(guide ? { "data-guide": guide } : {})}>
      {STUDY_LANGUAGES.map((l) => (
        <button
          key={l}
          type="button"
          role="tab"
          aria-selected={language === l}
          onClick={() => setLanguage(l)}
          style={language === l ? { ...tab, ...tabOn } : tab}
        >
          {STUDY_LANGUAGE_LABEL[l]}
        </button>
      ))}
    </div>
  );
}

const tabs: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 4,
  padding: 4,
  borderRadius: "var(--radius-sm)",
  background: "var(--bg-card)",
};

const tab: CSSProperties = {
  padding: "0.5rem 0",
  border: "none",
  borderRadius: 8,
  background: "transparent",
  color: "var(--text-secondary)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const tabOn: CSSProperties = {
  background: "var(--accent)",
  color: "var(--on-accent)",
};
