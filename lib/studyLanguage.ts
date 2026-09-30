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
