import mongoose from "mongoose";
import { normalizeStudyLanguage, type StudyLanguage } from "@/lib/studyLanguage";
import { Folder } from "@/models/Folder";
import { VocabularyDeck } from "@/models/VocabularyDeck";

/*
  폴더의 학습 언어 → 폴더 목록을 영어·한자로 나눠 보여준다.

  새 폴더는 만들 때 `Folder.language` 가 정해진다. 그 전에 만든 폴더는 값이 없어서
  **안에 든 단어장(하위 폴더까지)으로 짐작한다**:
    - 한자 단어장만 있으면 한자, 영어만 있으면 영어
    - 둘 다 있으면 **두 쪽 모두에 보인다** — 어느 한쪽에서 사라지면 잃어버린 줄 안다
    - 비어 있으면 영어(원래 이 앱은 영어 전용이었다)
  값이 정해진 폴더는 그 값 하나다.
*/

export type FolderLanguages = Map<string, Set<StudyLanguage>>;

export async function folderLanguagesFor(viewerUid: string): Promise<FolderLanguages> {
  const uid = new mongoose.Types.ObjectId(viewerUid);
  const [folders, decks] = await Promise.all([
    Folder.find({ createdBy: uid, deletedAt: null })
      .select({ parentFolderId: 1, language: 1 })
      .lean()
      .exec(),
    VocabularyDeck.find({ createdBy: uid, deletedAt: null })
      .select({ folderId: 1, language: 1 })
      .lean()
      .exec(),
  ]);

  const children = new Map<string, string[]>();
  for (const f of folders) {
    if (!f.parentFolderId) continue;
    const p = String(f.parentFolderId);
    children.set(p, [...(children.get(p) ?? []), String(f._id)]);
  }
  const deckLangs = new Map<string, Set<StudyLanguage>>();
  for (const d of decks) {
    const k = String(d.folderId);
    const set = deckLangs.get(k) ?? new Set<StudyLanguage>();
    set.add(normalizeStudyLanguage(d.language));
    deckLangs.set(k, set);
  }
  const explicit = new Map<string, StudyLanguage>();
  for (const f of folders) {
    if (f.language) explicit.set(String(f._id), normalizeStudyLanguage(f.language));
  }

  const out: FolderLanguages = new Map();
  /** 하위 트리에 든 언어. 값이 정해진 폴더는 그 값만 낸다 */
  const visit = (id: string, seen: Set<string>): Set<StudyLanguage> => {
    const done = out.get(id);
    if (done) return done;
    const fixed = explicit.get(id);
    if (fixed) {
      const s = new Set<StudyLanguage>([fixed]);
      out.set(id, s);
      return s;
    }
    if (seen.has(id)) return new Set(); // 순환 방어 — 정상 데이터에는 없다
    seen.add(id);
    const acc = new Set<StudyLanguage>(deckLangs.get(id) ?? []);
    for (const c of children.get(id) ?? []) {
      for (const l of visit(c, seen)) acc.add(l);
    }
    if (acc.size === 0) acc.add("en");
    out.set(id, acc);
    return acc;
  };
  for (const f of folders) visit(String(f._id), new Set());
  return out;
}

/** 이 언어 목록에 보일 폴더인가. 모르는 폴더는 영어로 본다 */
export function folderShowsIn(
  langs: FolderLanguages,
  folderId: string,
  language: StudyLanguage,
): boolean {
  return langs.get(folderId)?.has(language) ?? language === "en";
}
