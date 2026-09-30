import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { DEFAULT_STUDY_LANGUAGE, normalizeStudyLanguage, type StudyLanguage } from "@/lib/studyLanguage";
import { VocabularyDeck } from "@/models/VocabularyDeck";

/**
 * 단어장의 학습 언어. 추출 프롬프트를 고를 때 쓴다.
 * 화면이 보낸 언어 값을 믿지 않고 **내 단어장**에서 읽는다.
 * id 가 없거나 남의 단어장이면 영어다.
 */
export async function deckLanguageFor(
  viewerUid: string,
  vocabId: unknown,
): Promise<StudyLanguage> {
  if (typeof vocabId !== "string" || !mongoose.isValidObjectId(vocabId)) {
    return DEFAULT_STUDY_LANGUAGE;
  }
  await connectDB();
  const deck = await VocabularyDeck.findOne({ _id: vocabId, createdBy: viewerUid })
    .select({ language: 1 })
    .lean()
    .exec();
  return normalizeStudyLanguage(deck?.language);
}
