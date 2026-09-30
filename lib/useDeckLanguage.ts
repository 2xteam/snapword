"use client";

import { useEffect, useState } from "react";
import { DEFAULT_STUDY_LANGUAGE, normalizeStudyLanguage, type StudyLanguage } from "@/lib/studyLanguage";

/**
 * 단어장의 학습 언어. 칸 이름·AI 질문·채팅 언어를 이 값으로 고른다.
 * 불러오기 전과 실패했을 때는 영어다 — 옛 단어장은 원래 영어다.
 */
export function useDeckLanguage(vocabId: string | undefined): StudyLanguage {
  const [language, setLanguage] = useState<StudyLanguage>(DEFAULT_STUDY_LANGUAGE);

  useEffect(() => {
    if (!vocabId) return;
    let cancelled = false;
    fetch(`/api/vocabularies/${encodeURIComponent(vocabId)}`)
      .then((r) => r.json())
      .then((j: { ok: boolean; item?: { language?: string } }) => {
        if (!cancelled && j.ok) setLanguage(normalizeStudyLanguage(j.item?.language));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [vocabId]);

  return language;
}
