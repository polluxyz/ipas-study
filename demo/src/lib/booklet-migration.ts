/** 舊草稿先以序號停用，再同步搬成題本；遷移只保存題本，不抽題或改寫舊作答。 */
import {
  bumpDailyDraftSeqs, commitMigratedBookletStore, getAttempts, getDailyDrafts,
  readAllDailySets, readBookletStore,
  type Attempt, type Booklet, type BookletStore, type DailyDraft, type DailySet,
} from './attempts';
import { dailyMode, type DailyQuestion, type DuplicateGroups } from './daily';
import { availableDailyQuestion } from './daily-exam';

export const MIGRATION_LOCK = 'ipas-daily-migration';
export const MIGRATION_LOCK_TIMEOUT_MS = 10_000;
export type MigrationErrorReason = 'corrupt-v2' | 'corrupt-v1' | 'no-locks' | 'lock-timeout' | 'write-failed';
export type MigrationOutcome =
  | { status: 'ready'; store: BookletStore; migrated: boolean }
  | { status: 'error'; reason: MigrationErrorReason; message: string };
export interface MigrationDeps {
  catalog: readonly DailyQuestion[];
  groups: DuplicateGroups;
  now: () => Date;
  locks?: Pick<LockManager, 'request'>;
  lockTimeoutMs?: number;
}
export interface MigrationSource {
  drafts: DailyDraft[]; sets: DailySet[]; attempts: Attempt[];
  catalog: readonly DailyQuestion[]; groups: DuplicateGroups; now: Date;
}

/** 純函式只搬資料；先看全部草稿的答案，避免較早的未答題擋掉較晚的已答題。 */
export function buildMigratedStore(source: MigrationSource): BookletStore {
  const { drafts, sets, attempts, catalog, groups } = source;
  const membership = new Map(groups.flatMap((group) => group.map((id) => [id, group] as const)));
  const identity = (id: string): string | readonly string[] => membership.get(id) ?? id;
  const answered = new Set(attempts.map((a) => identity(a.qid)));
  const selected = new Set(drafts.flatMap((draft) => draft.questions
    .filter((q) => availableDailyQuestion(q, catalog, draft.subject) && (draft.status !== 'open' || q.choice !== null))
    .map((q) => identity(q.id))));
  const seen = new Set<string | readonly string[]>();
  // 清單的排除要包含草稿原本的全部題號，略過的未答題也不再分配。
  const assigned = new Set(drafts.flatMap((draft) => draft.questions.map((q) => identity(q.id))));
  const store: BookletStore = {
    version: 2, migratedAt: source.now.toISOString(), current: { '1': null, '3': null }, booklets: [],
  };
  for (const draft of [...drafts].sort((a, b) => a.subject - b.subject)) {
    const retained = draft.questions.flatMap((q, index) => {
      if (availableDailyQuestion(q, catalog, draft.subject)) {
        const key = identity(q.id);
        if (draft.status === 'open' && q.choice === null && (answered.has(key) || selected.has(key) || seen.has(key))) return [];
        seen.add(key);
      }
      return [{ q: { ...q }, index }];
    });
    if (retained.length === 0) continue;
    const nextPosition = retained.findIndex(({ index }) => index >= draft.position);
    const booklet: Booklet = {
      id: `v1-S${draft.subject}-${draft.date}-draft`, seq: 1, subject: draft.subject, number: 1,
      createdDate: draft.date, attemptMode: dailyMode(draft.date, draft.subject), origin: 'v1-draft', status: draft.status,
      position: nextPosition < 0 ? retained.length - 1 : nextPosition,
      assignedQids: draft.questions.map((q) => q.id), questions: retained.map(({ q }) => q),
      ...(draft.submission ? { submission: structuredClone(draft.submission) } : {}),
    };
    store.booklets.push(booklet);
    if (draft.status !== 'submitted') store.current[draft.subject] = booklet.id;
  }
  for (const set of [...sets].sort((a, b) => a.subject - b.subject)) {
    const draft = drafts.find((d) => d.subject === set.subject && d.date === set.date &&
      d.questions.length === set.questions.length && d.questions.every((q) => set.questions.some((item) => item.id === q.id)));
    if (draft) continue;
    const mode = dailyMode(set.date, set.subject);
    const questions = set.questions.flatMap((q) => {
      const previous = attempts.filter((a) => a.mode === mode && a.qid === q.id && a.rev === q.rev)
        .sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts) || b.id.localeCompare(a.id))[0];
      const key = identity(q.id);
      if (!previous && (!availableDailyQuestion(q, catalog, set.subject) || assigned.has(key) || answered.has(key))) return [];
      // 只有留下的題才阻擋本清單後面的題；同模式作答則不受已分配的限制。
      assigned.add(key);
      return [{ ...q, choice: previous?.choice ?? null, unsure: false, ms: previous?.ms ?? 0,
        ...(previous ? { correct: previous.correct, legacyAttemptId: previous.id } : {}) }];
    });
    if (questions.length === 0) continue;
    const booklet: Booklet = {
      id: `v1-S${set.subject}-${set.date}-set`, seq: 1, subject: set.subject, number: 1,
      createdDate: set.date, attemptMode: mode, origin: 'v1-set', status: 'open',
      assignedQids: set.questions.map((q) => q.id), questions,
      position: Math.max(0, questions.findIndex((q) => q.choice === null)),
    };
    store.booklets.push(booklet);
    for (const q of set.questions) assigned.add(identity(q.id));
    if (store.current[set.subject] === null) store.current[set.subject] = booklet.id;
  }
  // 目前題本依來源狀態決定，顯示題號才按建立日期排序。
  const rank = (booklet: Booklet): number => booklet.status === 'submitted' ? 0 : booklet.origin === 'v1-draft' ? 1 : 2;
  store.booklets.sort((a, b) => a.subject - b.subject || a.createdDate.localeCompare(b.createdDate) || rank(a) - rank(b));
  for (const subject of [1, 3] as const) {
    store.booklets.filter((booklet) => booklet.subject === subject).forEach((booklet, index) => { booklet.number = index + 1; });
  }
  return store;
}

const error = (reason: MigrationErrorReason, message: string): MigrationOutcome => ({ status: 'error', reason, message });
const writeFailed = (): MigrationOutcome => error('write-failed', '題本遷移保存失敗，已保留舊資料，請重新載入。');

/** 呼叫端持鎖後同步完成全部步驟，先停用舊草稿，最後只寫一次新題本。 */
export function migrateInsideLock(deps: Pick<MigrationDeps, 'catalog' | 'groups' | 'now'>): MigrationOutcome {
  try {
    const existing = readBookletStore();
    if (existing) return { status: 'ready', store: existing, migrated: false };
  } catch { return error('corrupt-v2', '題本損壞或版本未知，已保留原資料並停止遷移。'); }
  const readSource = (): MigrationSource => ({
    drafts: getDailyDrafts(), sets: readAllDailySets(), attempts: getAttempts(),
    catalog: deps.catalog, groups: deps.groups, now: deps.now(),
  });
  try { readSource(); }
  catch { return error('corrupt-v1', '舊資料損壞或版本未知，已保留原資料並停止遷移。'); }
  try { bumpDailyDraftSeqs(); }
  catch { return writeFailed(); }
  let source: MigrationSource;
  try { source = readSource(); }
  catch { return error('corrupt-v1', '舊資料損壞或版本未知，已保留原資料並停止遷移。'); }
  try {
    const store = buildMigratedStore(source);
    const result = commitMigratedBookletStore(store);
    if (result === 'written') return { status: 'ready', store, migrated: true };
    const adopted = readBookletStore();
    // 本頁已寫入新鍵；另一頁更新後改採其內容，不代表本頁沒有遷移。
    return adopted ? { status: 'ready', store: adopted, migrated: true } : writeFailed();
  } catch { return writeFailed(); }
}

/** 開頁只在新鍵不存在時取鎖；較晚取得鎖的頁面會再次讀取既有結果。 */
export async function ensureBookletStore(deps: MigrationDeps): Promise<MigrationOutcome> {
  try {
    const store = readBookletStore();
    if (store) return { status: 'ready', store, migrated: false };
  } catch { return error('corrupt-v2', '題本損壞或版本未知，已保留原資料並停止遷移。'); }
  if (!deps.locks) return error('no-locks', '瀏覽器無法鎖定遷移，請改用 http://127.0.0.1:4321/。');
  try {
    return await deps.locks.request(MIGRATION_LOCK,
      { mode: 'exclusive', signal: AbortSignal.timeout(deps.lockTimeoutMs ?? MIGRATION_LOCK_TIMEOUT_MS) },
      () => migrateInsideLock(deps));
  } catch (cause) {
    if (cause instanceof Error && (cause.name === 'AbortError' || cause.name === 'TimeoutError')) {
      return error('lock-timeout', '等待題本遷移超過時間，請重新載入。');
    }
    return writeFailed();
  }
}
