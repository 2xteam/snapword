import { NextResponse } from "next/server";
import { normalizeStudyLanguage, type StudyLanguage } from "@/lib/studyLanguage";

/**
 * 이어서 물어볼 것.
 *
 * 선택항목이 **첫 화면에만** 있어서, 대화가 시작되면 사라졌다. 그 뒤로는 무엇을
 * 더 물어도 되는지 알 수 없어 계속 직접 타이핑해야 했다.
 *
 * FitLog는 사용자의 검사 기록에서 칩을 뽑지만 이 앱에는 그런 수치 기록이 없다.
 * 그래서 지금은 고정 목록이다. 나중에 최근 단어장·오답노트에서 뽑을 수 있다.
 */

export const runtime = "nodejs";

type Chip = { text: string; from: "general" };

/** 대화를 이어갈 때 — 대화방의 학습 언어별로 */
const GENERAL_EN: Chip[] = [
  { text: "이 단어 예문 만들어줘", from: "general" },
  { text: "비슷한 단어랑 뭐가 달라?", from: "general" },
  { text: "이거 어떻게 외워?", from: "general" },
];

/** 아직 아무것도 안 물어봤을 때 — 무엇을 할 수 있는 곳인지 알려주는 쪽으로 */
const EMPTY_EN: Chip[] = [
  { text: "여기서 뭘 할 수 있어?", from: "general" },
  { text: "단어장은 어떻게 만들어?", from: "general" },
  { text: "시험은 어떻게 봐?", from: "general" },
  { text: "영어 공부는 어떻게 시작해?", from: "general" },
];

const GENERAL_HANJA: Chip[] = [
  { text: "이 한자가 들어간 한자어 알려줘", from: "general" },
  { text: "모양이 비슷한 한자랑 뭐가 달라?", from: "general" },
  { text: "이 한자 어떻게 외워?", from: "general" },
];

const EMPTY_HANJA: Chip[] = [
  { text: "여기서 뭘 할 수 있어?", from: "general" },
  { text: "한자 단어장은 어떻게 만들어?", from: "general" },
  { text: "시험은 어떻게 봐?", from: "general" },
  { text: "한자 공부는 어떻게 시작해?", from: "general" },
];

const CHIPS: Record<StudyLanguage, { general: Chip[]; empty: Chip[] }> = {
  en: { general: GENERAL_EN, empty: EMPTY_EN },
  hanja: { general: GENERAL_HANJA, empty: EMPTY_HANJA },
};

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const started = params.get("started") === "1";
  const set = CHIPS[normalizeStudyLanguage(params.get("language"))];
  return NextResponse.json({ ok: true, chips: started ? set.general : set.empty });
}
