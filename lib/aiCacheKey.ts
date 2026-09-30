/**
 * AI 캐시 조회/저장 시 사용하는 키 정규화.
 * RSS 제목 등에 섞인 HTML·공백 차이로 캐시가 어긋나지 않도록 통일합니다.
 */
import { DEFAULT_STUDY_LANGUAGE, type StudyLanguage } from "@/lib/studyLanguage";

/**
 * 캐시는 모두가 공유하고 키가 단어 문자열 하나다. 한자 설명은 한자 지시문으로
 * 만든 답이라 영어 쪽과 섞이면 안 된다 — 한자는 `hanja:` 를 앞에 붙인다.
 * 영어 키는 그대로라 이미 쌓인 캐시가 계속 맞는다.
 */
export function aiCacheKeyFor(
  raw: string,
  language: StudyLanguage = DEFAULT_STUDY_LANGUAGE,
): string {
  const word = normalizeAiCacheKey(raw);
  if (!word) return "";
  return language === "hanja" ? `hanja:${word}` : word;
}

export function normalizeAiCacheKey(raw: string): string {
  let s = raw.replace(/<[^>]+>/g, " ");
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&[a-z]+;/gi, " ");
  return s.replace(/\s+/g, " ").trim();
}
