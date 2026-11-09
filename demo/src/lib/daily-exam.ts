/** 每日題本共用純狀態規則，讓畫面、網址與儲存採用相同判斷。 */
import type { Attempt, Booklet, BookletStore, DailyDraft, DailyDraftQuestion, DailySet } from './attempts';
import { dailyMode, taipeiDate, type DailyExclusions, type DailyQuestion, type DailySubject, type DuplicateGroups } from './daily';

// 題號只讀狀態與答案，讓第 1 版草稿與題本共用相同規則。
type DailyNumberSource = { status: Booklet['status']; questions: readonly Pick<DailyDraftQuestion, 'choice'>[] };

export function dailySource(draft: DailyDraft | undefined, todaySet: DailySet | undefined): 'draft' | 'legacy' | 'new' {
  return draft?.questions.length ? 'draft' : todaySet?.questions.length ? 'legacy' : 'new';
}
export function canOpenToday(draft: DailyDraft, catalog: readonly DailyQuestion[], today: string): boolean {
  return draft.status === 'submitted' ? draft.date !== today : draft.status === 'open' && draft.questions.length > 0 && !draft.questions.some((q) => availableDailyQuestion(q, catalog, draft.subject));
}
export function createDailyDraft(set: DailySet, attempts: readonly Attempt[], scanLegacy: boolean, id: string): DailyDraft {
  const questions = set.questions.map((q) => {
    const previous = scanLegacy ? attempts.filter((a) => a.mode === dailyMode(set.date, set.subject) && a.qid === q.id && a.rev === q.rev)
      .sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts) || b.id.localeCompare(a.id))[0] : undefined;
    return { ...q, choice: previous?.choice ?? null, unsure: false, ms: previous?.ms ?? 0,
      ...(previous ? { legacyAttemptId: previous.id, correct: previous.correct } : {}) };
  });
  return { id, seq: 0, subject: set.subject, date: set.date, status: 'open', position: Math.max(0, questions.findIndex((q) => !q.choice)), questions };
}
export function availableDailyQuestion(q: { id: string; rev: number }, catalog: readonly DailyQuestion[], subject: DailySubject): boolean {
  return catalog.some((item) => item.id === q.id && item.rev === q.rev && item.subject === subject && item.source === 'mock' && item.review.status === 'verified');
}
export function availableDailySet(set: DailySet | undefined, catalog: readonly DailyQuestion[]): DailySet | undefined {
  // 至少有 1 題有效就保留整份快取，略過失效題仍交給草稿還原處理。
  return set?.questions.some((q) => availableDailyQuestion(q, catalog, set.subject)) ? set : undefined;
}
export function reconcileDailyDraft(draft: DailyDraft, catalog: readonly DailyQuestion[]): { draft: DailyDraft; skipped: number } {
  if (draft.status !== 'open') return { draft, skipped: 0 };
  const questions = draft.questions.filter((q) => availableDailyQuestion(q, catalog, draft.subject));
  const previous = draft.questions[draft.position]?.id;
  return { draft: { ...draft, questions, position: Math.max(0, questions.findIndex((q) => q.id === previous)) }, skipped: draft.questions.length - questions.length };
}
export function dailyNumbers(draft: DailyNumberSource): number[] {
  const first = draft.questions.findIndex((q) => !q.choice);
  return draft.questions.flatMap((q, index) => draft.status === 'submitted' || q.choice || index === first ? [index] : []);
}
export function dailyPosition(draft: DailyNumberSource & { position: number }, requested: number): number {
  const numbers = dailyNumbers(draft);
  return numbers.includes(requested) ? requested : numbers.includes(draft.position) ? draft.position : Math.max(0, draft.questions.findIndex((q) => !q.choice));
}
export function dailyNext(draft: DailyNumberSource, position: number): number {
  if (!draft.questions[position]?.choice && draft.status !== 'submitted') return position;
  const next = position + 1;
  return next >= draft.questions.length ? position : dailyNumbers(draft).includes(next) ? next : draft.questions.findIndex((q) => !q.choice);
}
export function dailyCounts(draft: { questions: readonly Pick<DailyDraftQuestion, 'choice' | 'unsure'>[] }): { answered: number; unsure: number; total: number } {
  return { answered: draft.questions.filter((q) => q.choice).length, unsure: draft.questions.filter((q) => q.unsure).length, total: draft.questions.length };
}
export function dailySubjectStatus(draft: DailyDraft | undefined, catalog: readonly DailyQuestion[], subject: DailySubject): string {
  if (!draft) return '尚未開啟';
  if (!draft.questions.length) return '沒有可作答題';
  const { answered, total } = dailyCounts(draft);
  if (draft.status === 'submitted') return `已交卷・已答 ${answered}／${total}`;
  if (!draft.questions.some((q) => availableDailyQuestion(q, catalog, subject))) return '題目已失效・需換題';
  return `作答中・已答 ${answered}／${total}`;
}
export type DailyNumberState = 'unavailable' | 'correct' | 'wrong' | 'unsure' | 'answered' | 'unanswered';
export function dailyNumberState(draft: { status: Booklet['status']; questions: readonly Pick<DailyDraftQuestion, 'choice' | 'unsure' | 'correct'>[] }, position: number, available = true): DailyNumberState {
  const q = draft.questions[position];
  return draft.status === 'submitted' ? !available ? 'unavailable' : q.correct ? 'correct' : 'wrong' : q.unsure ? 'unsure' : q.choice ? 'answered' : 'unanswered';
}
export function prepareDailySubmission(draft: DailyDraft, answers: ReadonlyMap<string, string>, ts: string, randomId: () => string): DailyDraft {
  if (draft.status !== 'open' || !draft.questions.length || draft.questions.some((q) => !q.choice || !answers.has(q.id))) throw new Error('全部有效題目作答後才能交卷。');
  const questions = draft.questions.map((q) => ({ ...q, correct: q.legacyAttemptId ? Boolean(q.correct) : q.choice === answers.get(q.id) }));
  const attempts: Attempt[] = questions.filter((q) => !q.legacyAttemptId).map((q) => ({ id: randomId(), qid: q.id, rev: q.rev, choice: q.choice!, correct: q.correct,
    ts, mode: dailyMode(draft.date, draft.subject), ms: q.ms }));
  return { ...draft, status: 'submitting', questions, submission: { ts, attempts, total: questions.length, correct: questions.filter((q) => q.correct).length } };
}

/** 新題本用身份組合作答模式，同日開多本時不會混在一起。 */
export function bookletAttemptMode(id: string, subject: DailySubject): string { return `booklet:${id}:S${subject}`; }

/** 略過題目可能曾作答，必須完整保留原分配順序才能安全解除分配；用時不算作答。 */
export function canDiscardBooklet(booklet: Booklet): boolean {
  return booklet.status === 'open' && booklet.submission === undefined && booklet.questions.length > 0 &&
    booklet.questions.length === booklet.assignedQids.length &&
    booklet.questions.every((q, index) => q.choice === null && q.legacyAttemptId === undefined && q.id === booklet.assignedQids[index]);
}

/** 所有分配過的題都占用名額，略過失效題或結束題本也不釋出。 */
export function bookletExclusions(store: BookletStore, groups: DuplicateGroups): DailyExclusions {
  return { assignedQids: new Set(store.booklets.flatMap((booklet) => booklet.assignedQids)), groups };
}

export function createBooklet(input: { store: BookletStore; subject: DailySubject; date: string; id: string; selected: readonly { id: string; rev: number }[] }): Omit<Booklet, 'seq'> {
  const { store, subject, date, id, selected } = input;
  const number = store.booklets.reduce((max, booklet) => booklet.subject === subject ? Math.max(max, booklet.number) : max, 0) + 1;
  return { id, subject, number, createdDate: date, attemptMode: bookletAttemptMode(id, subject), origin: 'new', status: 'open', position: 0,
    assignedQids: selected.map((q) => q.id), questions: selected.map((q) => ({ id: q.id, rev: q.rev, choice: null, unsure: false, ms: 0 })) };
}

/** 位置跟著原題向後找，避免略過題目後跳回已看過的題。 */
export function reconcileBooklet(booklet: Booklet, catalog: readonly DailyQuestion[]): { booklet: Booklet; skipped: number } {
  if (booklet.status !== 'open') return { booklet, skipped: 0 };
  const kept = booklet.questions.map((q, index) => ({ q, index })).filter(({ q }) => availableDailyQuestion(q, catalog, booklet.subject));
  const next = kept.findIndex(({ index }) => index >= booklet.position);
  const position = next < 0 ? Math.max(0, kept.length - 1) : next;
  return { booklet: { ...booklet, questions: kept.map(({ q }) => q), position }, skipped: booklet.questions.length - kept.length };
}

export function bookletNeedsRetire(booklet: Booklet, catalog: readonly DailyQuestion[]): boolean {
  return booklet.status === 'open' && !booklet.questions.some((q) => availableDailyQuestion(q, catalog, booklet.subject));
}

/** 交卷固定作答 ID 與題本模式；鎖定的舊作答只計分，不重寫。 */
export function prepareBookletSubmission(booklet: Booklet, answers: ReadonlyMap<string, string>, ts: string, randomId: () => string): Booklet {
  if (booklet.status !== 'open' || !booklet.questions.length || booklet.questions.some((q) => !q.choice || !answers.has(q.id))) throw new Error('全部有效題目作答後才能交卷。');
  const questions = booklet.questions.map((q) => ({ ...q, correct: q.legacyAttemptId ? Boolean(q.correct) : q.choice === answers.get(q.id) }));
  const attempts: Attempt[] = questions.filter((q) => !q.legacyAttemptId).map((q) => ({ id: randomId(), qid: q.id, rev: q.rev, choice: q.choice!, correct: q.correct,
    ts, mode: booklet.attemptMode, ms: q.ms }));
  return { ...booklet, status: 'submitting', questions, submission: { ts, attempts, total: questions.length, correct: questions.filter((q) => q.correct).length } };
}

export type BookletPageState =
  | { kind: 'resume'; booklet: Booklet }
  | { kind: 'retire'; booklet: Booklet }
  | { kind: 'review'; booklet: Booklet; next: number | null }
  | { kind: 'first'; next: number }
  | { kind: 'blocked' }
  | { kind: 'exhausted' };

/** 舊資料可能有多本未交卷；優先採用 current，失效時依編號接續。 */
function currentUnfinishedBooklet(store: BookletStore, subject: DailySubject): Booklet | undefined {
  const unfinished = store.booklets.filter((booklet) => booklet.subject === subject &&
    (booklet.status === 'open' || booklet.status === 'submitting')).sort((a, b) => a.number - b.number);
  return unfinished.find((booklet) => booklet.id === store.current[subject]) ?? unfinished[0];
}

export function bookletPageState(store: BookletStore, subject: DailySubject, free: number | null, catalog: readonly DailyQuestion[]): BookletPageState {
  const booklets = store.booklets.filter((booklet) => booklet.subject === subject).sort((a, b) => a.number - b.number);
  const current = currentUnfinishedBooklet(store, subject);
  if (current) return { kind: bookletNeedsRetire(current, catalog) ? 'retire' : 'resume', booklet: current };
  // 無法讀取作答時，未知題量不能當作 0，也不能據此開本。
  const next = free === null ? null : Math.min(50, free);
  if (booklets.length) return { kind: 'review', booklet: booklets[booklets.length - 1], next };
  if (next === null) return { kind: 'blocked' };
  return next > 0 ? { kind: 'first', next } : { kind: 'exhausted' };
}

export type DailyRoute =
  | { kind: 'catalog' }
  | { kind: 'missing'; reason: 'not-found' | 'subject-mismatch' | 'not-current' }
  | { kind: 'review'; booklet: Booklet }
  | { kind: 'retired'; booklet: Booklet }
  | { kind: 'retire'; booklet: Booklet }
  | { kind: 'resume'; booklet: Booklet };

/** 接續與回看只依題本判斷，作答紀錄損壞也不能阻擋既有題本。 */
export function dailyRoute(store: BookletStore, subject: DailySubject, bookId: string | null, catalog: readonly DailyQuestion[]): DailyRoute {
  if (bookId === null) return { kind: 'catalog' };
  const booklet = store.booklets.find((booklet) => booklet.id === bookId);
  if (!booklet) return { kind: 'missing', reason: 'not-found' };
  if (booklet.subject !== subject) return { kind: 'missing', reason: 'subject-mismatch' };
  if (booklet.status === 'submitted') return { kind: 'review', booklet };
  if (booklet.status === 'retired') return { kind: 'retired', booklet };
  if (currentUnfinishedBooklet(store, subject)?.id !== booklet.id) return { kind: 'missing', reason: 'not-current' };
  return { kind: bookletNeedsRetire(booklet, catalog) ? 'retire' : 'resume', booklet };
}

export function bookletOpenLabel(hasBooklets: boolean, next: number | null): string | null {
  if (next === null || next === 0) return null;
  return `${hasBooklets ? '開下一本' : '開第 1 本'}${next < 50 ? `（${next} 題）` : ''}`;
}

/** 分配題數保留原始清單，可區分題庫不足與題目被略過。 */
export function bookletPartialNote(booklet: Booklet): string | null {
  const total = booklet.questions.length;
  if (total === 0 || total >= 50) return null;
  const reason = booklet.assignedQids.length > total ? '部分題目已略過，不補題' : '未做題不足 50 題';
  return `本題本共 ${total} 題。${reason}，不換算正式模擬卷分數。`;
}

export interface BookletRow {
  id: string; number: number; createdDate: string; statusLabel: string; total: number; answered?: number; correct?: number; canReview: boolean;
}
export function bookletRows(store: BookletStore, subject: DailySubject): BookletRow[] {
  return store.booklets.filter((booklet) => booklet.subject === subject).sort((a, b) => a.number - b.number).map((booklet) => {
    const row = { id: booklet.id, number: booklet.number, createdDate: booklet.createdDate, total: booklet.questions.length, canReview: false };
    if (booklet.status === 'submitted') return { ...row, statusLabel: '已交卷', total: booklet.submission!.total, correct: booklet.submission!.correct, canReview: true };
    if (booklet.status === 'retired') return { ...row, statusLabel: '已結束' };
    if (booklet.status === 'open' && row.total === 0) return { ...row, statusLabel: '需結束', answered: 0 };
    return { ...row, statusLabel: '作答中', answered: dailyCounts(booklet).answered };
  });
}

export function bookletProgress(store: BookletStore, subject: DailySubject, today: string, free: { fullBooks: number; lastBook: number } | null): { answered: number; total: number; todaySubmitted: number; fullBooks: number | null; lastBook: number | null } {
  const current = store.booklets.find((booklet) => booklet.subject === subject && booklet.id === store.current[subject] && booklet.status !== 'retired');
  const { answered, total } = current ? dailyCounts(current) : { answered: 0, total: 0 };
  const todaySubmitted = store.booklets.reduce((sum, booklet) => sum + (booklet.subject === subject && booklet.status === 'submitted' &&
    booklet.submission && taipeiDate(new Date(booklet.submission.ts)) === today ? booklet.submission.total : 0), 0);
  return { answered, total, todaySubmitted, fullBooks: free?.fullBooks ?? null, lastBook: free?.lastBook ?? null };
}

export type CatalogRow = BookletRow & { action: 'resume' | 'retire' | 'review' | null };
export interface CatalogSection {
  rows: CatalogRow[];
  todaySubmitted: number;
  fullBooks: number | null;
  lastBook: number | null;
  open: { kind: 'none'; reason: 'unfinished' | 'blocked' | 'exhausted' } | { kind: 'button'; label: string; next: number };
}

/** 非有效題本不給接續動作，避免異常資料繞過同科只作答一本的規則。 */
export function catalogSection(store: BookletStore, subject: DailySubject, today: string, free: { free: number; fullBooks: number; lastBook: number } | null): CatalogSection {
  const current = currentUnfinishedBooklet(store, subject);
  const rows = bookletRows(store, subject).reverse().map((row): CatalogRow => ({
    ...row,
    action: row.statusLabel === '已交卷' ? 'review' : row.id !== current?.id ? null :
      row.statusLabel === '需結束' ? 'retire' : row.statusLabel === '作答中' ? 'resume' : null,
  }));
  const { todaySubmitted, fullBooks, lastBook } = bookletProgress(store, subject, today, free);
  let open: CatalogSection['open'];
  if (current) open = { kind: 'none', reason: 'unfinished' };
  else if (free === null) open = { kind: 'none', reason: 'blocked' };
  else {
    const next = Math.min(50, free.free);
    open = next === 0 ? { kind: 'none', reason: 'exhausted' } :
      { kind: 'button', label: bookletOpenLabel(rows.length > 0, next)!, next };
  }
  return { rows, todaySubmitted, fullBooks, lastBook, open };
}

export interface LegacyRecord { mode: string; date: string; subject: DailySubject; answered: number; correct: number; }

/** 先選每題的最新作答再排除引用，避免把已被取代的舊版作答重新列出。 */
export function legacyRecords(store: BookletStore | null, attempts: readonly Attempt[]): LegacyRecord[] {
  const referenced = new Set<string>();
  for (const booklet of store?.booklets ?? []) {
    if (booklet.status === 'retired') continue;
    for (const q of booklet.questions) if (q.legacyAttemptId) referenced.add(q.legacyAttemptId);
    for (const attempt of booklet.submission?.attempts ?? []) referenced.add(attempt.id);
  }
  const modes = new Map<string, Map<string, Attempt>>();
  for (const attempt of attempts) {
    if (!(attempt.mode.startsWith('daily:') || attempt.mode.startsWith('booklet:')) || !/:S[13]$/.test(attempt.mode)) continue;
    const questions = modes.get(attempt.mode) ?? new Map<string, Attempt>();
    const previous = questions.get(attempt.qid);
    if (!previous || Date.parse(attempt.ts) > Date.parse(previous.ts) ||
      (Date.parse(attempt.ts) === Date.parse(previous.ts) && attempt.id.localeCompare(previous.id) > 0)) questions.set(attempt.qid, attempt);
    modes.set(attempt.mode, questions);
  }
  const records: LegacyRecord[] = [];
  for (const [mode, questions] of modes) {
    const remaining = [...questions.values()].filter((attempt) => !referenced.has(attempt.id));
    if (!remaining.length) continue;
    const latest = remaining.reduce((a, b) => Date.parse(a.ts) >= Date.parse(b.ts) ? a : b);
    records.push({ mode, date: mode.startsWith('daily:') ? mode.slice(6, -3) : taipeiDate(new Date(latest.ts)),
      subject: mode.endsWith(':S1') ? 1 : 3, answered: remaining.length, correct: remaining.filter((attempt) => attempt.correct).length });
  }
  return records.sort((a, b) => b.date.localeCompare(a.date) || a.subject - b.subject);
}

export function bookletProgramNotice(booklet: Booklet, catalog: readonly DailyQuestion[]): { count: number; message: string } | null {
  const types = new Map(catalog.map((q) => [q.id, q.type]));
  const count = booklet.questions.filter((q) => types.get(q.id) === '程式').length;
  return count > 13 ? { count, message: `這本有 ${count} 題程式題，因為未做的非程式題變少。` } : null;
}
