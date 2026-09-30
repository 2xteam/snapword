/*
  학습 언어. 화면 문구(한국어)가 아니라 **공부하는 대상**의 언어다.

  - 단어장마다 `VocabularyDeck.language` 로 저장된다. 없으면 영어다.
  - 홈 화면의 전환 탭은 이 브라우저에만 기억한다(localStorage).
    회원 공용 `users` 컬렉션에는 넣지 않는다 — 여섯 앱이 함께 쓴다.
  - 한자일 때는 영어 RSS(오늘의 Word · English Grammar)를 부르지도, 보이지도 않는다.
*/

export const STUDY_LANGUAGES = ["en", "hanja"] as const;
export type StudyLanguage = (typeof STUDY_LANGUAGES)[number];

export const DEFAULT_STUDY_LANGUAGE: StudyLanguage = "en";

export const STUDY_LANGUAGE_LABEL: Record<StudyLanguage, string> = {
  en: "English",
  hanja: "漢字",
};

export function normalizeStudyLanguage(v: unknown): StudyLanguage {
  return v === "hanja" ? "hanja" : DEFAULT_STUDY_LANGUAGE;
}

/** 영어 RSS 콘텐츠(오늘의 Word · 문법 글)를 보여주는 언어인가 */
export function showsEnglishFeeds(lang: StudyLanguage): boolean {
  return lang === "en";
}

const HAN_RE = /\p{Script=Han}/u;

/** 네이버 한자사전 첫 화면 — 검색어 없이 연다(홈의 한자사전 카드) */
export const HANJA_DICTIONARY_HOME = "https://hanja.dict.naver.com/";

/**
 * 사전은 **언제나 새 창**으로 연다. `target="_blank"` 만으로는 설치한 앱(PWA)·인앱
 * 브라우저에서 같은 창으로 넘어가 학습 화면을 잃는다. 링크의 onClick 에서 부른다.
 * `href` 는 그대로 두어 길게 누르기·새 탭 열기도 된다.
 */
export function openInNewWindow(e: { preventDefault: () => void }, url: string): void {
  e.preventDefault();
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * 네이버 사전 링크. 단어에 한자가 섞여 있으면 한자사전, 아니면 영어사전.
 * 단어 글자로 고르므로 여러 단어장이 섞이는 오답 화면에서도 맞게 열린다.
 */
export function naverDictionaryUrl(word: string): string {
  const q = encodeURIComponent(word);
  if (HAN_RE.test(word)) {
    return `https://hanja.dict.naver.com/#/search?query=${q}&range=all`;
  }
  return `https://en.dict.naver.com/#/search?range=all&query=${q}&from=nsearch`;
}

/** 한자는 획이 많아 같은 크기로는 읽기 어렵다 — 단어를 이 배수로 키운다 */
export const HANJA_WORD_SCALE = 2;

/**
 * 단어 글자 크기. 한자가 섞인 단어면 `HANJA_WORD_SCALE` 배로 키운다.
 * 숫자(px)와 `"1.8rem"` 같은 문자열을 모두 받는다. 영어 단어는 그대로다.
 */
export function wordFontSize<T extends number | string>(word: string, size: T): T {
  if (!HAN_RE.test(word)) return size;
  if (typeof size === "number") return (size * HANJA_WORD_SCALE) as T;
  const m = /^([\d.]+)([a-z%]*)$/i.exec(size);
  return (m ? `${Number(m[1]) * HANJA_WORD_SCALE}${m[2]}` : size) as T;
}

/** 단어에 한자가 섞였는가 — 여러 단어장이 섞이는 화면(오답 복습)에서 쓴다 */
export function languageOfWord(word: string): StudyLanguage {
  return HAN_RE.test(word) ? "hanja" : "en";
}

/**
 * 단어 칸 이름. 저장 키는 두 언어가 같고(word · meaning · example · synonyms · antonyms)
 * **보이는 이름만** 다르다. 한자는 훈·음을 meaning 맨 앞에 담는다 → lib/llm.ts
 */
export type WordFieldLabels = {
  word: string;
  meaning: string;
  example: string;
  synonyms: string;
  antonyms: string;
};

export const WORD_FIELD_LABELS: Record<StudyLanguage, WordFieldLabels> = {
  en: { word: "단어", meaning: "설명", example: "예문", synonyms: "동의어", antonyms: "반의어" },
  hanja: { word: "한자", meaning: "훈음·뜻", example: "한자어·예문", synonyms: "유의자", antonyms: "반의자" },
};

/** 학습·오답 카드의 "AI에게 질문" 이 채팅에 보내는 첫 질문 */
export function explainWordPrompt(word: string, lang: StudyLanguage): string {
  if (lang === "hanja") {
    return `${word} 의 훈·음과 뜻, 부수·획수, 이 한자가 들어간 한자어를 자세히 설명해줘`;
  }
  return `${word} 에 대해서 더 자세히 설명해줘`;
}
