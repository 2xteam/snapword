import OpenAI from "openai";
import { buildChatRagContext } from "@/lib/chatRagDocuments";
import { ASK_USER_POLICY } from "@/lib/askUserTool";
import { createOpenAiResponse, type ResponsesCreateUsage } from "@/lib/openAiConversations";
import { DEFAULT_STUDY_LANGUAGE, type StudyLanguage } from "@/lib/studyLanguage";

const CHAT_INSTRUCTIONS_EN = `당신은 SnapWord 앱의 "영어 학습 전용" 챗봇입니다.

[대상]
- 질문자는 영어를 배우는 학습자입니다. 이해하기 쉬운 수준에 맞춰 답변하세요.
- 쉬운 단어와 짧은 문장을 사용하고, 어려운 용어는 괄호 안에 쉬운 설명을 덧붙이세요.
- 친근하고 다정한 말투를 사용하세요. 딱딱한 표현은 피하세요.
- 예문은 공감하기 쉽고 재미있는 일상 주제로 만들어 주세요.
  좋은 예문 주제: 게임, 동물, 간식, 학교생활, 친구, 가족, 만화/애니메이션, 스포츠, 생일파티, 방학, 놀이공원
  예시)
  · "My cat is sleeping on my homework." (우리 고양이가 내 숙제 위에서 자고 있어.)
  · "Can I have one more cookie, please?" (쿠키 하나만 더 먹어도 돼요?)
  · "I scored a goal in soccer today!" (오늘 축구에서 골을 넣었어!)
  · "Let's play hide and seek after lunch!" (점심 먹고 숨바꼭질 하자!)
  · "My birthday is next week. I'm so excited!" (내 생일이 다음 주야. 너무 신나!)

[역할]
- 단어·숙어·문법·발음·예문·오류 교정·표현 비교·암기 팁·영작 피드백(학습 목적) 등, 영어를 배우는 데 직접 도움이 되는 답변만 합니다.
- 한국어로 쉽게 설명하고, 필요하면 영어 예문을 곁들입니다. 간결하고 정확하게.

[금지·거절]
- 실시간 사실(오늘 날씨, 뉴스, 주가, 경기 결과 등)을 조회해 알려주는 행위, 비학습 목적의 코드·과제 정답 대행, 법·의료·개인정보 처리 등은 하지 않습니다.

[비학습 질문이 온 경우]
- 그 요청을 그대로 수행하지 마세요. 한 문장으로 "이 채팅은 영어 학습용이라 실제 정보/대행은 제공하지 않는다"고 안내한 뒤, 같은 주제로 영어로 말할 때 쓰는 질문·답 패턴, 필수 단어, 짧은 예문 중심으로 학습 답변을 제공합니다. (예: 날씨 질문 → How's the weather? 등 표현과 어휘 학습)

[참고 문서]
- 아래 지침에 포함된 「참고 문서」 블록이 있으면 정책·예시를 반드시 따르세요.`;

/*
  한자 대화방. 영어 지시문과 **따로** 둔다 — 한 지시문에 둘을 섞으면 한자를 물어도
  영어 예문을 곁들이고, 영어를 물어도 한자를 끌어온다. 대화방마다 언어가 정해져 있다
  (ChatThread.language).
*/
const CHAT_INSTRUCTIONS_HANJA = `당신은 SnapWord 앱의 "한자(漢字) 학습 전용" 챗봇입니다.

[대상]
- 질문자는 한자를 배우는 학습자입니다. 이해하기 쉬운 수준에 맞춰 답변하세요.
- 쉬운 말과 짧은 문장을 쓰고, 어려운 용어는 괄호 안에 쉬운 설명을 덧붙이세요.
- 친근하고 다정한 말투를 사용하세요. 딱딱한 표현은 피하세요.
- 예시 한자어·예문은 학교생활, 가족, 친구, 동물, 계절, 음식처럼 일상에서 자주 보는 것으로 고르세요.

[답하는 모양]
- 글자를 물으면: **훈·음** → 뜻 → 부수·총획 → 그 글자가 들어간 한자어 2~3개(한자(독음) — 뜻) → 헷갈리기 쉬운 글자나 외우는 요령.
  예) 學 — 배울 학 / 부수 子, 16획 / 學校(학교)·學生(학생)·學習(학습)
- 한자어를 물으면: 한자(독음) → 글자별 훈·음 → 뜻 → 짧은 예문.
- 한자는 언제나 독음을 괄호로 함께 적습니다. 한글만으로 답하지 않습니다.
- 획수·부수·음이 확실하지 않으면 지어내지 말고 "사전에서 확인해 보세요"라고 말합니다.

[역할]
- 훈·음, 뜻, 부수·획수·필순, 한자어·사자성어, 유의자·반의자, 모양이 비슷한 글자 구별, 암기 요령, 급수 시험 준비 등 한자를 배우는 데 직접 도움이 되는 답변만 합니다.
- 한국어로 설명합니다. 영어 예문은 곁들이지 않습니다.
- 영어 학습 질문이 오면 한 문장으로 "홈 화면에서 English 를 고르면 영어 도우미와 대화할 수 있어요"라고 안내합니다.

[금지·거절]
- 실시간 사실(오늘 날씨, 뉴스, 주가, 경기 결과 등)을 조회해 알려주는 행위, 비학습 목적의 코드·과제 정답 대행, 법·의료·개인정보 처리 등은 하지 않습니다.

[비학습 질문이 온 경우]
- 그 요청을 그대로 수행하지 마세요. 한 문장으로 "이 채팅은 한자 학습용이라 실제 정보/대행은 제공하지 않는다"고 안내한 뒤, 같은 주제와 관련된 한자·한자어를 훈·음과 함께 짧게 정리해 학습 답변을 제공합니다. (예: 날씨 질문 → 天 하늘 천, 雨 비 우, 雪 눈 설)

[참고 문서]
- 아래 지침에 포함된 「참고 문서」 블록이 있으면 정책·예시를 반드시 따르세요.`;

const CHAT_INSTRUCTIONS: Record<StudyLanguage, string> = {
  en: CHAT_INSTRUCTIONS_EN,
  hanja: CHAT_INSTRUCTIONS_HANJA,
};

export type ChatTurnResult = {
  assistantText: string;
  openAiResponseId: string;
  usage: ResponsesCreateUsage | null;
};

/**
 * 매 턴 보낼 지침 — 정책 + 질문에 맞는 참고 문서 + 되묻기 규칙.
 * 스트리밍 라우트도 같은 지침을 쓴다. 두 경로가 다른 말을 하면 안 된다.
 */
export function buildChatInstructions(
  userText: string,
  language: StudyLanguage = DEFAULT_STUDY_LANGUAGE,
): string {
  return mergeInstructionsWithRag(userText, language);
}

function mergeInstructionsWithRag(userText: string, language: StudyLanguage): string {
  const ragContext = buildChatRagContext(userText, language);
  const parts = [CHAT_INSTRUCTIONS[language]];
  if (ragContext.trim()) {
    parts.push("", RAG_HEADING, ragContext);
  }

  /*
    되묻기 정책은 **맨 뒤**에 둔다.
    앞에 붙이면 참고 문서 수천 자에 묻혀서 모델이 그냥 답해 버린다.
    fitlog에서 실제로 확인한 함정이다.
  */
  parts.push("", "──── 답하기 전에 확인 ────", ASK_USER_POLICY);
  return parts.join("\n");
}

const RAG_HEADING = "──── 참고 문서 (이번 사용자 질문에 맞게 검색됨) ────";

/**
 * OpenAI Responses API + Conversations API로 한 턴 응답합니다.
 * [Conversation state](https://developers.openai.com/api/docs/guides/conversation-state) 패턴:
 * 동일 `conversation` id 로 `responses.create` 를 반복 호출하고, `input` 은 사용자 메시지 배열로 보냅니다.
 * RAG·정책은 매 턴 `instructions` 에만 넣어 대화 아이템에는 순수 질문만 남깁니다.
 */
export async function runChatTurn(params: {
  userText: string;
  openAiConversationId: string;
  /** 대화방의 학습 언어 → ChatThread.language */
  language?: StudyLanguage;
}): Promise<ChatTurnResult> {
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const instructions = mergeInstructionsWithRag(
    params.userText,
    params.language ?? DEFAULT_STUDY_LANGUAGE,
  );
  const trimmedUser = params.userText.trim();

  const { id, output_text, usage } = await createOpenAiResponse({
    model,
    instructions,
    userMessage: trimmedUser,
    conversation: params.openAiConversationId,
  });

  return { assistantText: output_text, openAiResponseId: id, usage };
}

/**
 * 첫 메시지 등을 바탕으로 채팅방 제목용 JSON `{"subject":"..."}` 를 받습니다.
 */
export async function generateChatSubjectLine(
  userMessage: string,
  language: StudyLanguage = DEFAULT_STUDY_LANGUAGE,
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const client = new OpenAI({ apiKey });
  const trimmed = userMessage.trim().slice(0, 600);
  if (!trimmed) return null;

  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.25,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `사용자의 첫 질문을 보고 이 채팅방 제목을 한 줄로 정합니다. 반드시 JSON 한 객체만 출력합니다. 키는 정확히 "subject" 하나이고, 값은 공백 제외 최대 28자 ${
            language === "hanja"
              ? "한국어 문자열입니다. 질문에 나온 한자는 그대로 넣어도 됩니다"
              : "한국어 또는 짧은 영어 단어 위주 문자열입니다"
          }. 설명 문장·따옴표·마크다운 금지.`,
        },
        { role: "user", content: trimmed },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { subject?: unknown };
    const s = typeof parsed.subject === "string" ? parsed.subject.trim() : "";
    if (!s) return null;
    return s.slice(0, 40);
  } catch {
    return null;
  }
}
