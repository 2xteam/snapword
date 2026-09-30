"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_STUDY_LANGUAGE,
  normalizeStudyLanguage,
  type StudyLanguage,
} from "@/lib/studyLanguage";

const STORAGE_KEY = "snapword.studyLanguage";
const CHANGE_EVENT = "snapword:study-language";

function readStored(): StudyLanguage {
  try {
    return normalizeStudyLanguage(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_STUDY_LANGUAGE;
  }
}

/**
 * 홈 전환 탭이 고른 학습 언어. 첫 렌더는 항상 기본값(영어)이고,
 * 마운트 뒤에 저장값을 읽는다 — 서버 렌더와 어긋나지 않게.
 * `ready` 가 false 인 동안은 RSS 를 부르지 않도록 쓰는 쪽에서 기다린다.
 */
export function useStudyLanguage(): {
  language: StudyLanguage;
  ready: boolean;
  setLanguage: (lang: StudyLanguage) => void;
} {
  const [language, setLang] = useState<StudyLanguage>(DEFAULT_STUDY_LANGUAGE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLang(readStored());
    setReady(true);
    const sync = () => setLang(readStored());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setLanguage = useCallback((lang: StudyLanguage) => {
    setLang(lang);
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* 저장이 막힌 브라우저 — 이번 화면에서만 적용된다 */
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { language, ready, setLanguage };
}
