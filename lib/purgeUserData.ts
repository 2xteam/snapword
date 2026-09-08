import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { ChatThread } from "@/models/ChatThread";
import { getEventModel } from "@/models/Event";
import { Folder } from "@/models/Folder";
import { getInquiryModel } from "@/models/Inquiry";
import { StudyRecord } from "@/models/StudyRecord";
import { TestResult } from "@/models/TestResult";
import { TestSession } from "@/models/TestSession";
import { VocabularyDeck } from "@/models/VocabularyDeck";
import { Word } from "@/models/Word";

/**
 * 이 앱(SnapWord)이 가진 한 사람의 데이터를 지운다.
 *
 * **회원 문서는 건드리지 않는다.** 회원은 여섯 앱이 공유하고 포털이 원본을 갖는다.
 * 부르는 곳은 포털의 정리 작업 하나다 — 탈퇴한 지 6개월이 지났을 때다.
 * → myjane/app/api/cron/purge · my-obsidian-vault / 50-Plans/C 법적 페이지.md
 *
 * ⚠️ 이 앱은 사용자를 **Mongo `_id`(ObjectId)** 로 참조한다. 2hbk 의 도메인
 * 식별자(`user_xxx`)가 아니다. 포털이 둘 다 보내니 여기서는 `id` 만 쓴다.
 *
 * 단어(`Word`)와 시험 결과(`TestResult`)는 사용자를 직접 가리키지 않는다.
 * 부모(단어장·시험 세션)를 타고 지운다 — 부모만 지우면 **고아가 남는다.**
 */
export type PurgeResult = Record<string, number>;

export async function purgeUserData(id: string): Promise<PurgeResult> {
  if (!mongoose.isValidObjectId(id)) {
    throw new Error(`ObjectId 가 아닙니다: ${id}`);
  }
  const oid = new mongoose.Types.ObjectId(id);
  await connectDB();

  /* 먼저 부모의 _id 를 모아 둔다 — 부모를 지운 뒤에는 찾을 수 없다 */
  const deckIds = (
    await VocabularyDeck.find({ createdBy: oid }, { _id: 1 }).lean().exec()
  ).map((d) => d._id);
  const sessionIds = (
    await TestSession.find({ userId: oid }, { _id: 1 }).lean().exec()
  ).map((d) => d._id);

  const words = deckIds.length
    ? await Word.deleteMany({ vocabId: { $in: deckIds } }).exec()
    : { deletedCount: 0 };
  const testResults = sessionIds.length
    ? await TestResult.deleteMany({ sessionId: { $in: sessionIds } }).exec()
    : { deletedCount: 0 };

  const decks = await VocabularyDeck.deleteMany({ createdBy: oid }).exec();
  const sessions = await TestSession.deleteMany({ userId: oid }).exec();
  const folders = await Folder.deleteMany({ createdBy: oid }).exec();
  const records = await StudyRecord.deleteMany({ userId: oid }).exec();
  const threads = await ChatThread.deleteMany({ userId: oid }).exec();
  const events = await getEventModel().deleteMany({ userId: oid }).exec();
  const inquiries = await getInquiryModel().deleteMany({ userId: oid }).exec();

  return {
    words: words.deletedCount ?? 0,
    decks: decks.deletedCount ?? 0,
    testResults: testResults.deletedCount ?? 0,
    testSessions: sessions.deletedCount ?? 0,
    folders: folders.deletedCount ?? 0,
    studyRecords: records.deletedCount ?? 0,
    chatThreads: threads.deletedCount ?? 0,
    events: events.deletedCount ?? 0,
    inquiries: inquiries.deletedCount ?? 0,
  };
}
