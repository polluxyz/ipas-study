/** 作答、閱讀與題本經此介面進出，讓保存與放棄都先保護最新資料。 */
import revisionIndex from '../data/revisions.json';
import { canDiscardBooklet } from './daily-exam';
export type Choice = 'A' | 'B' | 'C' | 'D';
export interface Attempt { id: string; qid: string; rev: number; choice: Choice; correct: boolean; ts: string; mode: string; ms: number; }
export const STORAGE_KEY = 'ipas-attempts-v1';
const READING_KEY = 'ipas-reading-v1';
export interface Reading { conceptId: string; ts: string; }
const revisions: Record<string, number> = revisionIndex;
function isAttempt(value: unknown): value is Attempt {
  if (!value || typeof value !== 'object') return false;
  const a = value as Record<string, unknown>;
  return typeof a.id === 'string' && a.id.length > 0 && typeof a.qid === 'string' && a.qid.length > 0 &&
    Number.isInteger(a.rev) && (a.rev as number) >= 1 && ['A', 'B', 'C', 'D'].includes(String(a.choice)) &&
    typeof a.correct === 'boolean' && typeof a.ts === 'string' && Number.isFinite(Date.parse(a.ts)) &&
    typeof a.mode === 'string' && a.mode.length > 0 && typeof a.ms === 'number' && Number.isFinite(a.ms) && a.ms >= 0;
}
function read(): Attempt[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1 || !('attempts' in data) || !Array.isArray(data.attempts)) throw new Error('作答紀錄格式無法辨識，目前無法匯出備份。');
  return data.attempts.filter(isAttempt);
}
function write(attempts: Attempt[]): void { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, attempts })); }
export function saveAttempt(a: Omit<Attempt, 'id'>): Attempt {
  const attempt = { ...a, id: crypto.randomUUID() };
  if (!isAttempt(attempt)) throw new Error('作答紀錄欄位不完整。');
  write([...read(), attempt]); return attempt;
}
export function getAttempts(filter?: { qid?: string }): Attempt[] { return read().filter((a) => !filter?.qid || a.qid === filter.qid); }
export function getWrongBook(): { qid: string; lastAttempt: Attempt; outdated: boolean }[] {
  const grouped = new Map<string, Attempt[]>();
  for (const a of read()) grouped.set(a.qid, [...(grouped.get(a.qid) ?? []), a]);
  const result: { qid: string; lastAttempt: Attempt; outdated: boolean }[] = [];
  for (const [qid, attempts] of grouped) {
    const current = attempts.filter((a) => a.rev === revisions[qid]);
    const outdated = current.length === 0;
    const latest = (outdated ? attempts : current).sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts) || b.id.localeCompare(a.id))[0];
    if (outdated || !latest.correct) result.push({ qid, lastAttempt: latest, outdated });
  }
  return result.sort((a, b) => Date.parse(b.lastAttempt.ts) - Date.parse(a.lastAttempt.ts));
}
function isReading(value: unknown): value is Reading {
  if (!value || typeof value !== 'object') return false;
  const reading = value as Record<string, unknown>;
  return typeof reading.conceptId === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(reading.conceptId) && typeof reading.ts === 'string' && Number.isFinite(Date.parse(reading.ts));
}
export function getReadings(): Reading[] {
  const raw = localStorage.getItem(READING_KEY);
  if (!raw) return [];
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1 || !('readings' in data) || !Array.isArray(data.readings)) throw new Error('閱讀紀錄格式無法辨識。');
  return data.readings.filter(isReading);
}
function writeReadings(readings: Reading[]): void { localStorage.setItem(READING_KEY, JSON.stringify({ version: 1, readings })); }
export function setConceptRead(conceptId: string, isRead: boolean): void {
  const reading = { conceptId, ts: new Date().toISOString() };
  if (!isReading(reading)) throw new Error('概念 ID 格式不正確。');
  const readings = getReadings().filter((item) => item.conceptId !== conceptId);
  if (isRead) readings.push(reading);
  writeReadings(readings);
}
export function exportAttempts(): string { return JSON.stringify({ version: 1, attempts: read(), readings: getReadings() }, null, 2); }
export function importAttempts(json: string): { added: number; skipped: number; invalid: number } {
  const result = { added: 0, skipped: 0, invalid: 0 };
  let data: unknown;
  try { data = JSON.parse(json); } catch { return { ...result, invalid: 1 }; }
  if (!data || typeof data !== 'object' || !('attempts' in data) || !Array.isArray(data.attempts)) return { ...result, invalid: 1 };
  if (!('version' in data) || data.version !== 1) return { ...result, invalid: Math.max(1, data.attempts.length) };
  const attempts = read(); const ids = new Set(attempts.map((a) => a.id));
  for (const value of data.attempts) {
    if (!isAttempt(value)) { result.invalid++; continue; }
    if (ids.has(value.id)) { result.skipped++; continue; }
    attempts.push(value); ids.add(value.id); result.added++;
  }
  const readings = getReadings();
  if ('readings' in data) {
    if (!Array.isArray(data.readings)) result.invalid++;
    else for (const value of data.readings) {
      if (!isReading(value)) { result.invalid++; continue; }
      const index = readings.findIndex((item) => item.conceptId === value.conceptId);
      if (index >= 0 && Date.parse(readings[index].ts) >= Date.parse(value.ts)) { result.skipped++; continue; }
      if (index >= 0) readings[index] = value; else readings.push(value);
      result.added++;
    }
  }
  write(attempts); writeReadings(readings); return result;
}

/** 每日題組與作答備份分開保存；每科只保留最近一次建立的題組。 */
const DAILY_KEY = 'ipas-daily-v1';
export interface DailySet { date: string; subject: 1 | 3; questions: { id: string; rev: number }[]; }
function isDailySet(value: unknown): value is DailySet {
  if (!value || typeof value !== 'object') return false;
  const set = value as Record<string, unknown>;
  if (typeof set.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(set.date) || ![1, 3].includes(Number(set.subject)) || typeof set.subject !== 'number' || !Array.isArray(set.questions) || set.questions.length > 50) return false;
  const ids = new Set<string>();
  return set.questions.every((item: unknown) => {
    if (!item || typeof item !== 'object') return false;
    const q = item as Record<string, unknown>;
    if (typeof q.id !== 'string' || !q.id || !Number.isInteger(q.rev) || Number(q.rev) < 1 || ids.has(q.id)) return false;
    ids.add(q.id); return true;
  });
}
function readDailySets(): DailySet[] {
  const raw = localStorage.getItem(DAILY_KEY);
  if (!raw) return [];
  return parseDailySets(raw);
}
function parseDailySets(raw: string): DailySet[] {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1 || !('sets' in value) || !Array.isArray(value.sets) || !value.sets.every(isDailySet)) throw new Error('每日題組快取格式無法辨識，請保留現有資料並確認瀏覽器儲存狀態。');
  return value.sets;
}
export function getDailySet(date: string, subject: 1 | 3): DailySet | undefined {
  return readDailySets().find((set) => set.date === date && set.subject === subject);
}
/** 預設保留同日題組；只有舊官方題換題時明確要求替換。 */
export function saveDailySet(set: DailySet, replaceExisting = false): DailySet {
  if (!isDailySet(set)) throw new Error('每日題組欄位不完整。');
  const sets = readDailySets();
  const existing = sets.find((item) => item.date === set.date && item.subject === set.subject);
  if (existing && !replaceExisting) return existing;
  localStorage.setItem(DAILY_KEY, JSON.stringify({ version: 1, sets: [...sets.filter((item) => item.subject !== set.subject), set] }));
  return set;
}
/** 清除本機學習資料時一併移除每日題組，避免保留與作答不一致的快取。 */
export function clearStudyData(): void {
  for (const key of [BOOKLET_KEY, DRAFT_KEY, STORAGE_KEY, READING_KEY, DAILY_KEY]) localStorage.removeItem(key);
}

/** 每日草稿獨立於備份；版本或內容不明時拒絕讀寫，避免蓋掉尚未交卷的答案。 */
export const DRAFT_KEY = 'ipas-daily-draft-v1';
export interface DailyDraftQuestion {
  id: string; rev: number; choice: Choice | null; unsure: boolean; ms: number;
  legacyAttemptId?: string; correct?: boolean | null;
}
export interface DailySubmission { ts: string; attempts: Attempt[]; total: number; correct: number; }
export interface DailyDraft {
  id: string; seq: number; subject: 1 | 3; date: string; status: 'open' | 'submitting' | 'submitted';
  position: number; questions: DailyDraftQuestion[]; submission?: DailySubmission;
}
export class DailyConflictError extends Error {
  constructor() { super('另一頁已更新或清除資料。本頁已改為唯讀，請重新載入。'); }
}
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object';
const nonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const choiceValue = (value: unknown): value is Choice => typeof value === 'string' && ['A', 'B', 'C', 'D'].includes(value);
const dateValue = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
export function isDailyDraft(value: unknown): value is DailyDraft {
  if (!record(value) || typeof value.id !== 'string' || !value.id || !Number.isInteger(value.seq) || Number(value.seq) < 0 ||
    ![1, 3].includes(Number(value.subject)) || typeof value.subject !== 'number' || typeof value.date !== 'string' ||
    !dateValue(value.date) || !['open', 'submitting', 'submitted'].includes(String(value.status))) return false;
  return isDraftContent(value, value.status === 'open', `daily:${value.date}:S${value.subject}`);
}
/** 共用題目與提交驗證，讓新題本沿用舊草稿的答案、位置與計分規則。 */
function isDraftContent(value: Record<string, unknown>, unsubmitted: boolean, attemptMode: string): boolean {
  if (!Number.isInteger(value.position) ||
    !Array.isArray(value.questions) || value.questions.length > 50 || Number(value.position) < 0 || Number(value.position) >= Math.max(1, value.questions.length)) return false;
  const ids = new Set<string>();
  for (const q of value.questions) {
    if (!record(q) || typeof q.id !== 'string' || !q.id || ids.has(q.id) || !Number.isInteger(q.rev) || Number(q.rev) < 1 ||
      !(q.choice === null || choiceValue(q.choice)) || typeof q.unsure !== 'boolean' || !nonnegative(q.ms) || (q.unsure && q.choice === null) ||
      (q.correct !== undefined && q.correct !== null && typeof q.correct !== 'boolean') ||
      (q.legacyAttemptId !== undefined && (typeof q.legacyAttemptId !== 'string' || !q.legacyAttemptId || q.choice === null || typeof q.correct !== 'boolean'))) return false;
    if (unsubmitted && !q.legacyAttemptId && q.correct !== undefined) return false;
    ids.add(q.id);
  }
  if (unsubmitted) return value.submission === undefined;
  const submission = value.submission;
  if (!record(submission) || typeof submission.ts !== 'string' || !Number.isFinite(Date.parse(submission.ts)) ||
    submission.total !== value.questions.length || !submission.total || !Number.isInteger(submission.correct) ||
    !Array.isArray(submission.attempts) || !submission.attempts.every(isAttempt)) return false;
  const questions = value.questions as DailyDraftQuestion[];
  if (questions.some((q) => !q.choice || typeof q.correct !== 'boolean') || submission.correct !== questions.filter((q) => q.correct).length) return false;
  const added = questions.filter((q) => !q.legacyAttemptId);
  const attempts: Attempt[] = submission.attempts;
  return attempts.length === added.length && new Set(attempts.map((a) => a.id)).size === added.length &&
    added.every((q) => attempts.filter((a) => a.qid === q.id && a.rev === q.rev && a.choice === q.choice && a.correct === q.correct &&
      a.ms === q.ms && a.ts === submission.ts && a.mode === attemptMode).length === 1);
}
export function getDailyDrafts(): DailyDraft[] {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (raw === null) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (record(data) && data.version === 1 && Array.isArray(data.drafts) && data.drafts.every(isDailyDraft) &&
      new Set(data.drafts.map((draft: DailyDraft) => draft.subject)).size === data.drafts.length) return data.drafts;
  } catch { /* 原始資料保持不動，由頁面明示停止作答。 */ }
  throw new Error('每日草稿損壞或版本未知，已保留原資料並停止覆寫。');
}
export function assertDailyDraftCurrent(expected: Pick<DailyDraft, 'id' | 'seq' | 'subject'> | null, subject: 1 | 3): DailyDraft[] {
  const drafts = getDailyDrafts();
  const current = drafts.find((item) => item.subject === subject);
  if (expected ? !current || current.id !== expected.id || current.seq !== expected.seq : Boolean(current)) throw new DailyConflictError();
  return drafts;
}
export function saveDailyDraft(draft: DailyDraft, expected: Pick<DailyDraft, 'id' | 'seq' | 'subject'> | null): DailyDraft {
  if (!isDailyDraft(draft)) throw new Error('每日草稿欄位不完整。');
  const drafts = assertDailyDraftCurrent(expected, draft.subject);
  const saved = { ...draft, seq: expected ? expected.seq + 1 : 1 };
  if (!isDailyDraft(saved)) throw new Error('每日草稿欄位不完整。');
  localStorage.setItem(DRAFT_KEY, JSON.stringify({ version: 1, drafts: [...drafts.filter((item) => item.subject !== draft.subject), saved] }));
  return saved;
}
/** 整批先驗證再合併，只寫一次；固定 ID 讓交卷重試不增加紀錄。 */
export function saveAttemptBatch(batch: readonly Attempt[]): void {
  if (!batch.every(isAttempt)) throw new Error('整批作答欄位不完整。');
  const attempts = read();
  const byId = new Map(attempts.map((a) => [a.id, a]));
  for (const attempt of batch) {
    const existing = byId.get(attempt.id);
    if (existing && (Object.keys(attempt) as (keyof Attempt)[]).some((key) => existing[key] !== attempt[key])) throw new Error('作答 ID 與既有紀錄衝突。');
    if (!existing) { attempts.push(attempt); byId.set(attempt.id, attempt); }
  }
  write(attempts);
}
/** 回傳最後成功保存的草稿；失敗時呼叫端保留同一份 submission 後重試。 */
export function submitDailyDraft(draft: DailyDraft, prepared: DailyDraft): { draft: DailyDraft; error?: Error } {
  let saved = draft;
  try {
    if (saved.status === 'submitted') { assertDailyDraftCurrent(saved, saved.subject); return { draft: saved }; }
    if (saved.status === 'open') saved = saveDailyDraft(prepared, saved);
    assertDailyDraftCurrent(saved, saved.subject);
    if (saved.status !== 'submitting' || !saved.submission || !isDailyDraft(saved)) throw new Error('交卷資料不完整。');
    saveAttemptBatch(saved.submission.attempts);
    saved = saveDailyDraft({ ...saved, status: 'submitted' }, saved);
    return { draft: saved };
  } catch (cause) { return { draft: saved, error: cause instanceof Error ? cause : new Error('交卷保存失敗。') }; }
}

/** 題本保留完整歷史；每次變更都讀最新內容，只更新通過序號比對的那一本。 */
export const BOOKLET_KEY = 'ipas-daily-draft-v2';
export type BookletStatus = 'open' | 'submitting' | 'submitted' | 'retired';
export interface Booklet {
  id: string; seq: number; subject: 1 | 3; number: number; createdDate: string;
  attemptMode: string; origin: 'new' | 'v1-draft' | 'v1-set'; status: BookletStatus;
  position: number; assignedQids: string[]; questions: DailyDraftQuestion[]; submission?: DailySubmission;
}
export interface BookletStore {
  version: 2; migratedAt: string | null;
  current: { '1': string | null; '3': string | null }; booklets: Booklet[];
}
export type BookletRef = Pick<Booklet, 'id' | 'seq' | 'subject'>;
export class BookletStoreError extends Error {
  constructor() { super('題本損壞或版本未知，已保留原資料並停止覆寫。'); }
}
export function isBooklet(value: unknown): value is Booklet {
  if (!record(value) || typeof value.id !== 'string' || !value.id || !Number.isInteger(value.seq) || Number(value.seq) < 0 ||
    (value.subject !== 1 && value.subject !== 3) || !Number.isInteger(value.number) || Number(value.number) < 1 ||
    !dateValue(value.createdDate) || typeof value.origin !== 'string' || !['new', 'v1-draft', 'v1-set'].includes(value.origin) ||
    typeof value.status !== 'string' || !['open', 'submitting', 'submitted', 'retired'].includes(value.status) || typeof value.attemptMode !== 'string' ||
    !Array.isArray(value.assignedQids) || value.assignedQids.length < 1 || value.assignedQids.length > 50 ||
    !value.assignedQids.every((id: unknown) => typeof id === 'string' && id.length > 0) ||
    new Set(value.assignedQids).size !== value.assignedQids.length) return false;
  const dailyMode = /^daily:(\d{4}-\d{2}-\d{2}):S([13])$/.exec(value.attemptMode);
  if (value.attemptMode !== `booklet:${value.id}:S${value.subject}` &&
    !(dailyMode && dateValue(dailyMode[1]) && Number(dailyMode[2]) === value.subject)) return false;
  const assignedQids = value.assignedQids;
  return isDraftContent(value, value.status === 'open' || value.status === 'retired', value.attemptMode) &&
    (value.questions as DailyDraftQuestion[]).every((q) => assignedQids.includes(q.id));
}
export function isBookletStore(value: unknown): value is BookletStore {
  if (!record(value) || value.version !== 2 ||
    !(value.migratedAt === null || (typeof value.migratedAt === 'string' && Number.isFinite(Date.parse(value.migratedAt)))) ||
    !record(value.current) || Array.isArray(value.current) || !Array.isArray(value.booklets) || !value.booklets.every(isBooklet)) return false;
  const booklets: Booklet[] = value.booklets;
  if (new Set(booklets.map((b) => b.id)).size !== booklets.length ||
    new Set(booklets.map((b) => `${b.subject}:${b.number}`)).size !== booklets.length) return false;
  const current = value.current;
  return ([1, 3] as const).every((subject) => current[subject] === null ||
    (typeof current[subject] === 'string' && booklets.some((b) => b.id === current[subject] && b.subject === subject)));
}
export function readBookletStore(): BookletStore | null {
  const raw = localStorage.getItem(BOOKLET_KEY);
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (isBookletStore(value)) return value;
  } catch { /* 解析失敗仍保留原字串，禁止以空題本覆蓋。 */ }
  throw new BookletStoreError();
}
function writeBookletStore(store: BookletStore): void {
  if (!isBookletStore(store)) throw new BookletStoreError();
  localStorage.setItem(BOOKLET_KEY, JSON.stringify(store));
}
const unfinished = (booklet: Booklet): boolean => booklet.status === 'open' || booklet.status === 'submitting';
export function openBooklet(subject: 1 | 3, build: (ctx: { store: BookletStore; attempts: Attempt[] }) => Omit<Booklet, 'seq'> | null): Booklet | null {
  const store = readBookletStore() ?? { version: 2, migratedAt: null, current: { '1': null, '3': null }, booklets: [] };
  if (store.booklets.some((b) => b.subject === subject && unfinished(b))) throw new DailyConflictError();
  // 抽題器只取得副本，避免意外改動歷史題本後被一起寫入。
  const built = build({ store: structuredClone(store), attempts: read() });
  if (built === null) return null;
  const booklet = { ...built, seq: 1 };
  if (booklet.subject !== subject || booklet.status !== 'open' || !isBooklet(booklet)) throw new BookletStoreError();
  writeBookletStore({ ...store, booklets: [...store.booklets, booklet], current: { ...store.current, [subject]: booklet.id } });
  return booklet;
}
export function assertBookletCurrent(expected: BookletRef): BookletStore {
  const store = readBookletStore();
  const booklet = store?.booklets.find((b) => b.id === expected.id && b.subject === expected.subject);
  if (!store || !booklet || booklet.seq !== expected.seq || store.current[expected.subject] !== expected.id) throw new DailyConflictError();
  return store;
}
function sameBookletIdentity(booklet: Booklet, original: Booklet): boolean {
  return booklet.id === original.id && booklet.subject === original.subject && booklet.number === original.number &&
    booklet.createdDate === original.createdDate && booklet.attemptMode === original.attemptMode && booklet.origin === original.origin &&
    JSON.stringify(booklet.assignedQids) === JSON.stringify(original.assignedQids);
}
export function saveBooklet(booklet: Booklet, expected: BookletRef): Booklet {
  const store = assertBookletCurrent(expected);
  const original = store.booklets.find((b) => b.id === expected.id)!;
  if (!sameBookletIdentity(booklet, original)) throw new DailyConflictError();
  const saved = { ...booklet, seq: expected.seq + 1 };
  if (!isBooklet(saved)) throw new BookletStoreError();
  const booklets = store.booklets.map((b) => b.id === saved.id ? saved : b);
  const currentId = unfinished(saved) ? saved.id :
    (booklets.filter((b) => b.subject === saved.subject && unfinished(b)).sort((a, b) => a.number - b.number)[0]?.id ?? null);
  writeBookletStore({ ...store, booklets, current: { ...store.current, [saved.subject]: currentId } });
  return saved;
}
/** 提交內容先落盤再寫作答；中斷時回傳已保存的階段，供同一批 ID 重試。 */
export function submitBooklet(booklet: Booklet, prepared: Booklet): { booklet: Booklet; error?: Error } {
  let saved = booklet;
  try {
    if (saved.status === 'submitted') {
      // 已交卷時 current 已移到下一本；重試只核對原題本，不再寫作答。
      const current = readBookletStore()?.booklets.find((b) => b.id === saved.id && b.subject === saved.subject);
      if (!current || current.seq !== saved.seq || current.status !== 'submitted') throw new DailyConflictError();
      return { booklet: current };
    }
    if (saved.status === 'open') {
      if (prepared.status !== 'submitting' || !isBooklet(prepared)) throw new BookletStoreError();
      saved = saveBooklet(prepared, saved);
    }
    assertBookletCurrent(saved);
    if (saved.status !== 'submitting' || !saved.submission || !isBooklet(saved)) throw new BookletStoreError();
    saveAttemptBatch(saved.submission.attempts);
    saved = saveBooklet({ ...saved, status: 'submitted' }, saved);
    return { booklet: saved };
  } catch (cause) { return { booklet: saved, error: cause instanceof Error ? cause : new Error('交卷保存失敗。') }; }
}
/** 題目是否全部失效由畫面判斷；此處只結束未交卷題本，保留答案與分配紀錄。 */
export function retireBooklet(booklet: Booklet, expected: BookletRef): Booklet {
  const store = assertBookletCurrent(expected);
  if (booklet.status !== 'open' || store.booklets.find((b) => b.id === expected.id)?.status !== 'open') throw new BookletStoreError();
  return saveBooklet({ ...booklet, status: 'retired' }, expected);
}
/** 只刪除最新且未答的題本；保留空 store，避免舊鍵重新遷移讓題本復活。 */
export function discardBooklet(expected: BookletRef): BookletStore {
  const store = assertBookletCurrent(expected);
  const booklet = store.booklets.find((b) => b.id === expected.id)!;
  if (!canDiscardBooklet(booklet)) throw new BookletStoreError();
  const booklets = store.booklets.filter((b) => b.id !== expected.id);
  const currentId = booklets.filter((b) => b.subject === expected.subject && unfinished(b))
    .sort((a, b) => a.number - b.number)[0]?.id ?? null;
  const saved: BookletStore = { ...store, booklets, current: { ...store.current, [expected.subject]: currentId } };
  writeBookletStore(saved);
  return saved;
}
/** 遷移必須讀全部日期；與舊讀取介面分開，空字串也視為資料損壞。 */
export function readAllDailySets(): DailySet[] {
  const raw = localStorage.getItem(DAILY_KEY);
  return raw === null ? [] : parseDailySets(raw);
}
export function bumpDailyDraftSeqs(): DailyDraft[] {
  const drafts = getDailyDrafts();
  if (drafts.length === 0) return drafts;
  const bumped = drafts.map((draft) => ({ ...draft, seq: draft.seq + 1 }));
  const raw = JSON.stringify({ version: 1, drafts: bumped });
  localStorage.setItem(DRAFT_KEY, raw);
  if (localStorage.getItem(DRAFT_KEY) !== raw) throw new DailyConflictError();
  return bumped;
}
/** 遷移寫入後若已有合法新內容就採用，避免覆蓋另一頁剛開始的作答。 */
export function commitMigratedBookletStore(store: BookletStore): 'written' | 'adopted' {
  writeBookletStore(store);
  const raw = localStorage.getItem(BOOKLET_KEY);
  if (raw === JSON.stringify(store)) return 'written';
  try {
    if (raw !== null && isBookletStore(JSON.parse(raw))) return 'adopted';
  } catch { /* 讀回不合法才撤回新鍵，舊鍵仍可供下次遷移。 */ }
  localStorage.removeItem(BOOKLET_KEY);
  throw new BookletStoreError();
}
