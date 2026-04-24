export type GuideStep = {
  selector: string;
  title: string;
  description: string;
};

export type PageGuide = {
  /** 페이지 매칭 함수 */
  match: (pathname: string) => boolean;
  steps: GuideStep[];
};

const PAGE_GUIDES: PageGuide[] = [
  // ── 홈 ──
  {
    match: (p) => p === "/home",
    steps: [
      {
        selector: "[data-guide='wotd-section']",
        title: "오늘의 Word",
        description: "매일 새로운 영단어를 확인할 수 있어요. 카드를 눌러 자세한 내용을 확인해 보세요!",
      },
      {
        selector: "[data-guide='review-section']",
        title: "복습",
        description: "시험에서 많이 틀린 단어를 모아 복습할 수 있어요.",
      },
      {
        selector: "[data-guide='deck-section']",
        title: "최근 단어장",
        description: "최근에 사용한 단어장을 좌우로 넘기며 바로 열 수 있어요.",
      },
      {
        selector: "[data-guide='folder-section']",
        title: "최근 폴더",
        description: "폴더별로 단어장을 정리할 수 있어요. 좌우로 넘겨 확인하세요.",
      },
      {
        selector: "[data-guide='eg-section']",
        title: "더 공부해 볼까?",
        description: "영어 문법 글을 읽고, AI에게 번역을 요청해 볼 수도 있어요.",
      },
      {
        selector: "[data-guide='hamburger-btn']",
        title: "메뉴",
        description: "오른쪽 상단의 메뉴 버튼을 눌러 폴더, 단어장 등 다른 페이지로 이동할 수 있어요.",
      },
      {
        selector: "[data-guide='install-btn']",
        title: "홈 화면에 추가",
        description: "이 버튼을 눌러 SnapWord를 홈 화면에 추가하면, 앱처럼 바로 실행할 수 있어요!",
      },
      {
        selector: "[data-guide='chat-fab']",
        title: "AI 채팅",
        description: "궁금한 점이 있으면 이 버튼을 눌러 AI에게 질문할 수 있어요!",
      },
      {
        selector: "[data-guide='guide-fab']",
        title: "가이드 버튼",
        description: "언제든 이 버튼을 누르면 현재 페이지의 사용법 가이드를 다시 볼 수 있어요!",
      },
    ],
  },
  // ── 폴더 목록 ──
  {
    match: (p) => p === "/folders",
    steps: [
      {
        selector: "[data-guide='create-folder-btn']",
        title: "폴더 만들기",
        description: "이 버튼을 눌러 새 폴더를 만들 수 있어요.",
      },
    ],
  },
  // ── 폴더 상세 ──
  {
    match: (p) => /^\/folders\/.+$/.test(p),
    steps: [
      {
        selector: "[data-guide='create-deck-btn']",
        title: "단어장 만들기",
        description: "이 버튼으로 폴더 안에 단어장을 만들 수 있어요.",
      },
    ],
  },
  // ── 단어장 허브 (/vocab/[id]) ──
  {
    match: (p) => /^\/vocab\/[^/]+$/.test(p),
    steps: [
      {
        selector: "[data-guide='hub-words']",
        title: "단어 추가·편집",
        description: "단어를 수동으로 추가하거나, 사진을 찍어 한번에 추가할 수 있어요.",
      },
      {
        selector: "[data-guide='hub-study']",
        title: "Study",
        description: "카드를 넘기며 단어를 학습할 수 있어요.",
      },
      {
        selector: "[data-guide='hub-test']",
        title: "Test",
        description: "5지선다 객관식으로 단어를 테스트해 보세요.",
      },
      {
        selector: "[data-guide='hub-score']",
        title: "Score",
        description: "시험 결과와 기록을 확인할 수 있어요.",
      },
    ],
  },
  // ── 단어 편집 ──
  {
    match: (p) => p.endsWith("/words"),
    steps: [
      {
        selector: "[data-guide='photo-add-btn']",
        title: "사진으로 추가",
        description: "사진을 찍어 단어를 한번에 추가할 수 있어요! \"추가\" 버튼으로 수동 추가도 가능합니다.",
      },
    ],
  },
  // ── Study ──
  {
    match: (p) => p.endsWith("/study"),
    steps: [
      {
        selector: ".study-carousel",
        title: "학습 카드",
        description: "단어를 보고 \"뜻·예문 보기\"를 눌러 의미를 확인하세요. Naver 사전으로 발음을 확인하거나 AI에게 질문해 보세요!",
      },
    ],
  },
];

/** 현재 pathname에 해당하는 PageGuide를 반환 (없으면 null) */
export function getPageGuide(pathname: string): PageGuide | null {
  return PAGE_GUIDES.find((g) => g.match(pathname)) ?? null;
}
