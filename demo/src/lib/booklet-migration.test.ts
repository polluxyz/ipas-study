/** 遷移案例保留舊鍵的原始字串，並以實際舊版提交模擬關頁與跨分頁競爭。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as persistence from './attempts';
import {
  BOOKLET_KEY, DRAFT_KEY, DailyConflictError, getAttempts, getDailyDrafts, isBookletStore,
  saveDailyDraft, submitBooklet, submitDailyDraft,
  type Attempt, type Booklet, type BookletStore, type DailyDraft, type DailyDraftQuestion, type DailySet,
} from './attempts';
import { dailyMode, type DailyQuestion } from './daily';
import { prepareDailySubmission } from './daily-exam';
import {
  MIGRATION_LOCK, MIGRATION_LOCK_TIMEOUT_MS, buildMigratedStore, ensureBookletStore, migrateInsideLock,
  type MigrationDeps, type MigrationOutcome, type MigrationSource,
} from './booklet-migration';

vi.mock('../data/revisions.json', () => ({ default: {} }));

const TS = '2026-11-07T03:00:00.000Z';
const DATE = '2026-11-06';
const SET_KEY = 'ipas-daily-v1';
const ATTEMPT_KEY = 'ipas-attempts-v1';
const catalog: DailyQuestion[] = [
  ...['q1', 'q2', 'q3', 'q4', 'q5'].map((id) => ({ id, rev: 1, subject: 1, source: 'mock', codes: ['L21101'], type: '觀念', review: { status: 'verified' } })),
  ...['t1', 't2', 't3'].map((id) => ({ id, rev: 1, subject: 3, source: 'mock', codes: ['L23101'], type: '觀念', review: { status: 'verified' } })),
  { id: 'official', rev: 1, subject: 1, source: 'exam', codes: ['L21101'], type: '觀念', review: { status: 'verified' } },
  { id: 'stale', rev: 2, subject: 1, source: 'mock', codes: ['L21101'], type: '觀念', review: { status: 'verified' } },
];
const q = (id: string, choice: DailyDraftQuestion['choice'] = null, overrides: Partial<DailyDraftQuestion> = {}): DailyDraftQuestion =>
  ({ id, rev: 1, choice, unsure: false, ms: 0, ...overrides });
function draft(overrides: Partial<DailyDraft> = {}): DailyDraft {
  return { id: 'old-one', seq: 4, subject: 1, date: DATE, status: 'open', position: 0, questions: [q('q1'), q('q2')], ...overrides };
}
function set(overrides: Partial<DailySet> = {}): DailySet {
  return { date: DATE, subject: 1, questions: [{ id: 'q1', rev: 1 }, { id: 'q2', rev: 1 }], ...overrides };
}
function attempt(overrides: Partial<Attempt> = {}): Attempt {
  return { id: 'old-attempt', qid: 'unrelated', rev: 1, choice: 'B', correct: false, ts: TS, mode: 'quiz', ms: 123, ...overrides };
}
function prepare(d: DailyDraft): DailyDraft {
  return prepareDailySubmission({ ...d, questions: d.questions.map((item) => ({ ...item, choice: item.choice ?? 'A' })) },
    new Map(d.questions.map((item) => [item.id, 'A'])), TS, (() => { let n = 0; return () => `${d.id}-answer-${++n}`; })());
}
function source(overrides: Partial<MigrationSource> = {}): MigrationSource {
  return { drafts: [], sets: [], attempts: [], catalog, groups: [], now: new Date(TS), ...overrides };
}
const deps = (overrides: Partial<MigrationDeps> = {}): MigrationDeps => ({ catalog, groups: [], now: () => new Date(TS), ...overrides });
function unavailableLocks(cause: Error = new Error('不應取得鎖')) {
  const request = vi.fn();
  const invoke: LockManager['request'] = async () => { request(); throw cause; };
  return { locks: { request: invoke }, request };
}
let storage: Map<string, string>;
let setItem: ReturnType<typeof vi.fn<(key: string, value: string) => void>>;
let getItem: ReturnType<typeof vi.fn<(key: string) => string | null>>;
let removeItem: ReturnType<typeof vi.fn<(key: string) => void>>;
let expectedAttempts: string | undefined;
beforeEach(() => {
  vi.restoreAllMocks();
  storage = new Map();
  setItem = vi.fn((key, value) => { storage.set(key, value); });
  getItem = vi.fn((key) => storage.get(key) ?? null);
  removeItem = vi.fn((key) => { storage.delete(key); });
  vi.stubGlobal('localStorage', { getItem, setItem, removeItem });
  seedAttempts([attempt()]);
});
afterEach(() => {
  expect(storage.get(ATTEMPT_KEY)).toBe(expectedAttempts);
  vi.unstubAllGlobals();
});
function seedAttempts(attempts: Attempt[], raw = JSON.stringify({ version: 1, attempts }, null, 2)): void {
  storage.set(ATTEMPT_KEY, raw); expectedAttempts = raw;
}
function seed(drafts: DailyDraft[] = [], sets: DailySet[] = []): void {
  storage.set(DRAFT_KEY, JSON.stringify({ version: 1, drafts }, null, 2));
  storage.set(SET_KEY, JSON.stringify({ version: 1, sets }, null, 2));
}
function ready(outcome: MigrationOutcome): BookletStore {
  expect(outcome.status).toBe('ready');
  if (outcome.status !== 'ready') throw new Error(outcome.message);
  expect(isBookletStore(outcome.store)).toBe(true);
  return outcome.store;
}
function unchangedOld(before: Map<string, string>): void {
  expect(storage.get(SET_KEY)).toBe(before.get(SET_KEY));
  expect(storage.get(ATTEMPT_KEY)).toBe(before.get(ATTEMPT_KEY));
  const raw = before.get(DRAFT_KEY);
  if (raw && raw.startsWith('{')) {
    const withoutSeq = (value: string | undefined): unknown => {
      const data: { version: number; drafts?: DailyDraft[] } = JSON.parse(value!);
      return { ...data, drafts: data.drafts?.map(({ seq: _seq, ...rest }) => rest) };
    };
    expect(withoutSeq(storage.get(DRAFT_KEY))).toEqual(withoutSeq(raw));
  } else expect(storage.get(DRAFT_KEY)).toBe(raw);
}
function migrated(options: Partial<MigrationDeps> = {}): BookletStore {
  const before = new Map(storage);
  const result = ready(migrateInsideLock(deps(options)));
  unchangedOld(before);
  return result;
}

describe('第 6.3 節的 8 列', () => {
  it.each([
    ['open', false, 1, 'draft'], ['open', true, 2, 'draft'],
    ['submitting', false, 1, 'draft'], ['submitting', true, 2, 'draft'],
    ['submitted', false, 1, null], ['submitted', true, 2, 'set'],
  ] as const)('%s 草稿，清單不同：%s', (status, different, count, currentOrigin) => {
    const original = draft({ questions: [q('q1', 'B', { unsure: true, ms: 52 }), q('q2', 'A', { ms: 34 })], position: 1 });
    const d = status === 'open' ? original : { ...prepare(original), status };
    const s = different ? set({ questions: [{ id: 'q3', rev: 1 }] }) : set();
    seed([d], [s]);
    const store = migrated();
    expect(store.booklets).toHaveLength(count);
    expect(store.current).toEqual({ '1': currentOrigin ? `v1-S1-${DATE}-${currentOrigin}` : null, '3': null });
    expect(store.booklets.map((b) => b.number)).toEqual(different ? [1, 2] : [1]);
    expect(store.booklets[0]).toMatchObject({ id: `v1-S1-${DATE}-draft`, seq: 1, status, questions: d.questions,
      assignedQids: ['q1', 'q2'], position: 1, createdDate: DATE, attemptMode: `daily:${DATE}:S1`, origin: 'v1-draft' });
    expect(store.booklets[0].submission).toEqual(d.submission);
    if (different) expect(store.booklets[1]).toMatchObject({ number: 2, questions: [q('q3')], assignedQids: ['q3'], status: 'open' });
  });
  it('沒有草稿，有清單', () => {
    seed([], [set()]); const store = migrated();
    expect(store.booklets).toHaveLength(1); expect(store.current).toEqual({ '1': `v1-S1-${DATE}-set`, '3': null });
    expect(store.booklets[0]).toMatchObject({ number: 1, questions: [q('q1'), q('q2')], assignedQids: ['q1', 'q2'] });
  });
  it('沒有草稿與清單，舊作答仍在', () => {
    const store = migrated();
    expect(store).toEqual({ version: 2, migratedAt: TS, current: { '1': null, '3': null }, booklets: [] });
    expect(storage.get(BOOKLET_KEY)).toBe(JSON.stringify(store));
  });
});

describe('來源與題號', () => {
  it('兩科不同狀態一次搬入，重開逐字不變', async () => {
    const one = draft(); const three = prepare(draft({ subject: 3, id: 'old-three', questions: [q('t1'), q('t2')] }));
    seed([three, one]); const first = migrated(); const raw = storage.get(BOOKLET_KEY); const old = storage.get(DRAFT_KEY);
    expect(first.current).toEqual({ '1': `v1-S1-${DATE}-draft`, '3': `v1-S3-${DATE}-draft` });
    expect(first.booklets.map((b) => [b.subject, b.number, b.status])).toEqual([[1, 1, 'open'], [3, 1, 'submitting']]);
    expect(first.booklets[1].submission).toEqual(three.submission);
    const { locks, request } = unavailableLocks();
    expect(await ensureBookletStore(deps({ locks }))).toEqual({ status: 'ready', store: first, migrated: false });
    expect(request).not.toHaveBeenCalled(); expect(storage.get(BOOKLET_KEY)).toBe(raw); expect(storage.get(DRAFT_KEY)).toBe(old);
  });
  it('清單日期較早，題號較小，但目前題本仍是較新的草稿', () => {
    seed([draft({ date: '2026-11-07' })], [set({ date: '2026-11-05', questions: [{ id: 'q3', rev: 1 }] })]);
    const store = migrated();
    expect(store.booklets.map((b) => [b.origin, b.number])).toEqual([['v1-set', 1], ['v1-draft', 2]]);
    expect(store.current['1']).toBe('v1-S1-2026-11-07-draft');
  });
  it('日期不同但題號相同，不算相同來源', () => {
    seed([draft({ questions: [q('q1', 'B')] })], [set({ date: '2026-11-05', questions: [{ id: 'q1', rev: 1 }, { id: 'q2', rev: 1 }] })]);
    const store = migrated();
    expect(store.booklets).toHaveLength(2); expect(store.booklets[0].questions).toEqual([q('q2')]);
    expect(store.booklets[0].assignedQids).toEqual(['q1', 'q2']);
  });
  it('相同來源忽略順序與版本，全部以草稿為準', () => {
    const d = draft({ questions: [q('q2', 'C', { rev: 3 }), q('q1', 'B', { ms: 50, unsure: true })], position: 1 });
    seed([d], [set()]); const store = migrated();
    expect(store.booklets).toHaveLength(1); expect(store.booklets[0].questions).toEqual(d.questions);
    expect(store.booklets[0].assignedQids).toEqual(['q2', 'q1']); expect(store.booklets[0].position).toBe(1);
  });
  it('清單和草稿部分重疊，清單只留新題，分配紀錄保留全部題', () => {
    seed([draft()], [set({ questions: [{ id: 'q2', rev: 1 }, { id: 'q3', rev: 1 }] })]);
    const store = migrated(); expect(store.booklets).toHaveLength(2);
    expect(store.booklets[1].questions).toEqual([q('q3')]); expect(store.booklets[1].assignedQids).toEqual(['q2', 'q3']);
  });
  it('清單重疊草稿，但同模式同版本已答仍留下並鎖定', () => {
    const a = attempt({ qid: 'q2', mode: dailyMode(DATE, 1) }); seedAttempts([a]);
    seed([draft({ questions: [q('q1', 'A'), q('q2', 'C')] })], [set({ questions: [{ id: 'q2', rev: 1 }, { id: 'q3', rev: 1 }] })]);
    const store = migrated(); expect(store.booklets).toHaveLength(2);
    expect(store.booklets[1].questions).toEqual([q('q2', 'B', { ms: 123, correct: false, legacyAttemptId: a.id }), q('q3')]);
    expect(store.booklets[1].position).toBe(1); expect(getAttempts()).toHaveLength(1);
  });
  it('跨科清單與草稿同題群組不重複', () => {
    seed([draft({ questions: [q('q1')] })], [set({ subject: 3, questions: [{ id: 't1', rev: 1 }, { id: 't2', rev: 1 }] })]);
    const store = migrated({ groups: [['q1', 't1']] });
    expect(store.booklets.map((b) => b.questions.map((item) => item.id))).toEqual([['q1'], ['t2']]);
    expect(store.booklets[1].assignedQids).toEqual(['t1', 't2']); expect(store.booklets[1].number).toBe(1);
  });
  it('草稿失效題與官方題原樣搬入，不參與群組比較', () => {
    const questions = [q('official', 'C'), q('missing'), q('stale'), q('q1')];
    seed([draft({ questions })], [set({ subject: 3, questions: [{ id: 't1', rev: 1 }] })]);
    const store = migrated({ groups: [['official', 'q1']] });
    expect(store.booklets[0].questions).toEqual(questions); expect(store.booklets[0].assignedQids).toEqual(['official', 'missing', 'stale', 'q1']);
  });
  it.each(['official', 'missing', 'stale'])('清單的 %s 題只有同模式同版本作答才留下', (id) => {
    seed([], [set({ questions: [{ id, rev: 1 }, { id: 'q2', rev: 1 }] })]);
    let store = migrated(); expect(store.booklets[0].questions).toEqual([q('q2')]);
    expect(store.booklets[0].assignedQids).toEqual([id, 'q2']);
    storage.delete(BOOKLET_KEY); const a = attempt({ qid: id, mode: dailyMode(DATE, 1) }); seedAttempts([a]);
    store = migrated(); expect(store.booklets[0].questions).toEqual([q(id, 'B', { ms: 123, correct: false, legacyAttemptId: a.id }), q('q2')]);
  });
  it.each(['draft', 'set', 'both'] as const)('0 題來源 %s 不建立題本', (kind) => {
    seed(kind === 'set' ? [] : [draft({ questions: [] })], kind === 'draft' ? [] : [set({ questions: [] })]);
    const store = migrated(); expect(store.booklets).toEqual([]); expect(store.current).toEqual({ '1': null, '3': null });
  });
  it('純函式不修改來源，搬入的題目與提交也不共用可變物件', () => {
    const original = source({ drafts: [prepare(draft())] }); const before = structuredClone(original);
    const store = buildMigratedStore(original); expect(original).toEqual(before);
    store.booklets[0].questions[0].ms = 999; store.booklets[0].submission!.attempts[0].ms = 999;
    expect(original).toEqual(before); expect(setItem).not.toHaveBeenCalled();
  });
});

describe('草稿去重與位置', () => {
  it.each(['same', 'cross'] as const)('群組兩題皆未答：%s', (scope) => {
    const drafts = scope === 'same' ? [draft({ questions: [q('q1'), q('q2'), q('q3')] })]
      : [draft({ subject: 3, id: 'three', questions: [q('t1'), q('t2')] }), draft({ questions: [q('q1'), q('q3')] })];
    seed(drafts); const store = migrated({ groups: [scope === 'same' ? ['q1', 'q2'] : ['q1', 't1']] });
    expect(store.booklets.map((b) => b.questions.map((item) => item.id))).toEqual(scope === 'same' ? [['q1', 'q3']] : [['q1', 'q3'], ['t2']]);
    expect(store.booklets[0].assignedQids).toEqual(scope === 'same' ? ['q1', 'q2', 'q3'] : ['q1', 'q3']);
    if (scope === 'cross') expect(store.booklets[1].assignedQids).toEqual(['t1', 't2']);
  });
  it.each(['same', 'cross'] as const)('群組只有後一題已答，保留答案並略過前一題：%s', (scope) => {
    seed(scope === 'same' ? [draft({ questions: [q('q1'), q('q2', 'B', { unsure: true, ms: 78 }), q('q3')] })]
      : [draft({ questions: [q('q1'), q('q3')] }), draft({ subject: 3, id: 'three', questions: [q('t1', 'B'), q('t2')] })]);
    const store = migrated({ groups: [scope === 'same' ? ['q1', 'q2'] : ['q1', 't1']] });
    expect(store.booklets.map((b) => b.questions.map((item) => item.id))).toEqual(scope === 'same' ? [['q2', 'q3']] : [['q3'], ['t1', 't2']]);
    if (scope === 'same') expect(store.booklets[0].questions[0]).toEqual(q('q2', 'B', { unsure: true, ms: 78 }));
  });
  it.each(['same', 'cross'] as const)('群組兩題皆已答，答案都保留：%s', (scope) => {
    seed(scope === 'same' ? [draft({ questions: [q('q1', 'A'), q('q2', 'B')] })]
      : [draft({ questions: [q('q1', 'A')] }), draft({ subject: 3, id: 'three', questions: [q('t1', 'B')] })]);
    const store = migrated({ groups: [scope === 'same' ? ['q1', 'q2'] : ['q1', 't1']] });
    expect(store.booklets.map((b) => b.questions.map((item) => [item.id, item.choice]))).toEqual(scope === 'same' ? [[['q1', 'A'], ['q2', 'B']]] : [[['q1', 'A']], [['t1', 'B']]]);
  });
  it.each(['submitting', 'submitted'] as const)('%s 的同群組題阻擋另一科未答題', (status) => {
    const submitted = { ...prepare(draft({ subject: 3, id: 'three', questions: [q('t1')] })), status };
    seed([draft({ questions: [q('q1'), q('q2')] }), submitted]);
    const store = migrated({ groups: [['q1', 't1']] });
    expect(store.booklets[0].questions).toEqual([q('q2')]); expect(store.booklets[1].questions).toEqual(submitted.questions);
    expect(store.booklets[1].submission).toEqual(submitted.submission);
  });
  it('未答題本身已有其他模式、其他版本作答時略過', () => {
    seedAttempts([attempt({ qid: 'q1', rev: 9, mode: 'official' })]); seed([draft()]);
    const store = migrated(); expect(store.booklets[0].questions).toEqual([q('q2')]); expect(store.booklets[0].assignedQids).toEqual(['q1', 'q2']);
  });
  it('草稿未答題的跨科群組已有作答時略過', () => {
    seedAttempts([attempt({ qid: 't1', rev: 9 })]); seed([draft()]);
    const store = migrated({ groups: [['q1', 't1']] }); expect(store.booklets[0].questions).toEqual([q('q2')]);
  });
  it.each([true, false])('位置指向被略過題，後面有題：%s', (hasNext) => {
    seedAttempts([attempt({ qid: 'q2' })]);
    seed([draft({ position: 1, questions: hasNext ? [q('q1'), q('q2'), q('q3'), q('q4')] : [q('q1'), q('q2')] })]);
    const store = migrated(); expect(store.booklets[0].position).toBe(hasNext ? 1 : 0);
    expect(store.booklets[0].questions[store.booklets[0].position].id).toBe(hasNext ? 'q3' : 'q1');
  });
  it('位置指向保留題，前面刪題後仍指同一題', () => {
    seedAttempts([attempt({ qid: 'q1' })]); seed([draft({ questions: [q('q1'), q('q2'), q('q3')], position: 2 })]);
    const store = migrated(); expect(store.booklets[0].position).toBe(1); expect(store.booklets[0].questions[1].id).toBe('q3');
  });
  it('草稿去重後 0 題不建立題本', () => {
    seedAttempts([attempt({ qid: 'q1' }), attempt({ id: 'second', qid: 'q2' })]); seed([draft()]);
    const store = migrated(); expect(store.booklets).toEqual([]); expect(store.current['1']).toBeNull();
  });
  it('失效題的已選答案不排除有效的同群組未答題', () => {
    seed([draft({ questions: [q('stale', 'B'), q('q1')] })]);
    const store = migrated({ groups: [['stale', 'q1']] }); expect(store.booklets[0].questions).toEqual([q('stale', 'B'), q('q1')]);
  });
});

describe('清單去重與舊作答', () => {
  it('一般測驗已答群組成員，清單未答題不留下', () => {
    seedAttempts([attempt({ qid: 't1' })]); seed([], [set()]);
    const store = migrated({ groups: [['q1', 't1']] }); expect(store.booklets[0].questions).toEqual([q('q2')]);
  });
  it('同一清單同群組兩題未答，只留下第一題', () => {
    seed([], [set()]); const store = migrated({ groups: [['q1', 'q2']] });
    expect(store.booklets[0].questions).toEqual([q('q1')]); expect(store.booklets[0].assignedQids).toEqual(['q1', 'q2']);
  });
  it('先處理清單的全部分配題，包含略過題，會排除後一科清單', () => {
    seed([], [set({ subject: 3, questions: [{ id: 't1', rev: 1 }, { id: 't2', rev: 1 }] }),
      set({ questions: [{ id: 'missing', rev: 1 }, { id: 'q2', rev: 1 }] })]);
    const store = migrated({ groups: [['missing', 't1']] });
    expect(store.booklets.map((b) => b.questions.map((item) => item.id))).toEqual([['q2'], ['t2']]);
    expect(store.booklets[0].assignedQids).toEqual(['missing', 'q2']);
  });
  it('本清單沒留下的失效題，不排除後面的有效同群組題', () => {
    seed([], [set({ questions: [{ id: 'stale', rev: 1 }, { id: 'q1', rev: 1 }] })]);
    const store = migrated({ groups: [['stale', 'q1']] }); expect(store.booklets[0].questions).toEqual([q('q1')]);
  });
  it('被略過的草稿題仍排除清單的同群組題', () => {
    seed([draft({ questions: [q('q1'), q('q2', 'B')] })], [set({ subject: 3, questions: [{ id: 't1', rev: 1 }, { id: 't2', rev: 1 }] })]);
    const store = migrated({ groups: [['q1', 'q2', 't1']] });
    expect(store.booklets[0].questions).toEqual([q('q2', 'B')]); expect(store.booklets[0].assignedQids).toEqual(['q1', 'q2']);
    expect(store.booklets[1].questions).toEqual([q('t2')]);
  });
  it('同模式作答按時間與 ID 取最新，選項、用時、正確性原樣搬入', () => {
    const mode = dailyMode(DATE, 1);
    const latest = attempt({ id: 'z', qid: 'q1', mode, choice: 'D', correct: true, ms: 777 });
    seedAttempts([latest, attempt({ id: 'a', qid: 'q1', mode }), attempt({ id: 'zz', qid: 'q1', mode, ts: '2026-11-06T01:00:00Z' })]);
    seed([], [set()]); const store = migrated();
    expect(store.booklets[0].questions).toEqual([q('q1', 'D', { ms: 777, correct: true, legacyAttemptId: 'z' }), q('q2')]);
    expect(store.booklets[0].position).toBe(1); expect(store.booklets[0].status).toBe('open');
  });
  it('全部已答清單仍 open，位置 0，沒有新增作答', () => {
    seedAttempts([attempt({ qid: 'q1', mode: dailyMode(DATE, 1) }), attempt({ id: 'second', qid: 'q2', mode: dailyMode(DATE, 1), correct: true })]);
    seed([], [set()]); const store = migrated();
    expect(store.booklets[0].status).toBe('open'); expect(store.booklets[0].position).toBe(0);
    expect(store.booklets[0].questions.map((item) => item.legacyAttemptId)).toEqual(['old-attempt', 'second']);
    expect(store.current['1']).toBe(`v1-S1-${DATE}-set`); expect(getAttempts()).toHaveLength(2);
  });
  it('規格指定：q1 第 2 版不套第 1 版作答，只留 q2', () => {
    seedAttempts([attempt({ qid: 'q1', rev: 1, mode: dailyMode(DATE, 1), correct: true })]);
    seed([], [set({ questions: [{ id: 'q1', rev: 2 }, { id: 'q2', rev: 1 }] })]);
    const store = migrated({ catalog: catalog.map((item) => item.id === 'q1' ? { ...item, rev: 2 } : item) });
    expect(store.booklets[0].questions).toEqual([q('q2')]); expect(store.booklets[0].assignedQids).toEqual(['q1', 'q2']);
  });
  it('同科已交卷草稿加上沒有保留題的清單，current 是 null', () => {
    seed([ { ...prepare(draft()), status: 'submitted' } ], [set({ questions: [{ id: 'official', rev: 1 }] })]);
    const store = migrated(); expect(store.booklets).toHaveLength(1); expect(store.current['1']).toBeNull();
  });
  it('舊紀錄沒有清單，不會由作答重建題本', () => {
    seedAttempts([attempt({ qid: 'q1', mode: dailyMode(DATE, 1) }), attempt({ id: 'new-mode', qid: 'q2', mode: 'booklet:deleted:S1' })]);
    const store = migrated(); expect(store.booklets).toEqual([]); expect(getAttempts()).toHaveLength(2);
  });
});

describe('鎖與開頁', () => {
  function queuedLocks() {
    const queue: (() => void)[] = [];
    const request = vi.fn<(name: string, options: LockOptions, callback: LockGrantedCallback<unknown>) => void>();
    const implementation: LockManager['request'] = <T>(name: string, optionsOrCallback: LockOptions | LockGrantedCallback<T>, callback?: LockGrantedCallback<T>): Promise<Awaited<T>> => {
      const handler = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback!;
      request(name, typeof optionsOrCallback === 'function' ? {} : optionsOrCallback, handler);
      return new Promise<Awaited<T>>((resolve, reject) => { queue.push(() => {
        try { Promise.resolve(handler({ name: MIGRATION_LOCK, mode: 'exclusive' })).then(resolve, reject); } catch (cause) { reject(cause); }
      }); });
    };
    return { locks: { request: implementation }, run: () => { const next = queue.shift(); if (!next) throw new Error('沒有待執行鎖'); next(); }, request };
  }
  it('預設鎖名稱、獨占模式、逾時 10 秒，callback 同步回傳', async () => {
    seed([draft()]); const timeout = vi.spyOn(AbortSignal, 'timeout'); const fake = queuedLocks();
    const pending = ensureBookletStore(deps({ locks: fake.locks }));
    expect(fake.request).toHaveBeenCalledWith('ipas-daily-migration', expect.objectContaining({ mode: 'exclusive', signal: expect.any(AbortSignal) }), expect.any(Function));
    expect(timeout).toHaveBeenCalledWith(10_000); expect(MIGRATION_LOCK_TIMEOUT_MS).toBe(10_000);
    fake.run(); const outcome = await pending; ready(outcome); expect(outcome).toMatchObject({ migrated: true });
    const callback = fake.request.mock.calls[0][2]; expect(callback).toBeDefined();
    const before = setItem.mock.calls.length; const returned = callback!({ name: MIGRATION_LOCK, mode: 'exclusive' });
    expect(returned).not.toBeInstanceOf(Promise); expect(returned).toMatchObject({ migrated: false }); expect(setItem).toHaveBeenCalledTimes(before);
  });
  it('A 持鎖時 B 不寫任何鍵，放鎖後才遷移', async () => {
    seed([draft()]); const fake = queuedLocks(); const before = new Map(storage);
    const pending = ensureBookletStore(deps({ locks: fake.locks }));
    expect(setItem).not.toHaveBeenCalled(); expect(storage).toEqual(before);
    fake.run(); expect(await pending).toMatchObject({ status: 'ready', migrated: true });
  });
  it('B 遷移並交卷後，較晚取鎖的 A 不覆寫，也不重複作答', async () => {
    seed([draft({ questions: [q('q1', 'A')] })]); const fake = queuedLocks();
    const waitingA = ensureBookletStore(deps({ locks: fake.locks }));
    const b = migrated().booklets[0]; const preparedDraft = prepare(draft({ questions: b.questions }));
    const preparedBooklet: Booklet = { ...b, status: 'submitting', questions: preparedDraft.questions, submission: preparedDraft.submission };
    const submitted = submitBooklet(b, preparedBooklet); expect(submitted.error).toBeUndefined();
    expectedAttempts = storage.get(ATTEMPT_KEY);
    const raw = storage.get(BOOKLET_KEY); const before = setItem.mock.calls.length;
    fake.run(); const resultA = await waitingA; const store = ready(resultA);
    expect(resultA).toMatchObject({ migrated: false }); expect(store.booklets[0].status).toBe('submitted');
    expect(setItem).toHaveBeenCalledTimes(before); expect(storage.get(BOOKLET_KEY)).toBe(raw);
    expect(getAttempts().filter((a) => a.qid === 'q1')).toHaveLength(1);
  });
  it('沒有 locks 時不遷移，舊鍵逐字不變，提示本機網址', async () => {
    seed([draft()], [set()]); const before = new Map(storage);
    const outcome = await ensureBookletStore(deps());
    expect(outcome).toMatchObject({ status: 'error', reason: 'no-locks', message: expect.stringContaining('http://127.0.0.1:4321/') });
    expect(storage).toEqual(before); expect(setItem).not.toHaveBeenCalled();
  });
  it('等鎖逾時不遷移，舊鍵逐字不變，提示重新載入', async () => {
    seed([draft()], [set()]); const before = new Map(storage);
    const { locks } = unavailableLocks(new DOMException('timeout', 'TimeoutError'));
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    expect(await ensureBookletStore(deps({ locks, lockTimeoutMs: 1 }))).toMatchObject({ status: 'error', reason: 'lock-timeout', message: expect.stringContaining('重新載入') });
    expect(timeout).toHaveBeenCalledWith(1); expect(storage).toEqual(before); expect(setItem).not.toHaveBeenCalled();
  });
  it('AbortError 也回報等鎖逾時', async () => {
    const { locks } = unavailableLocks(new DOMException('abort', 'AbortError'));
    expect(await ensureBookletStore(deps({ locks }))).toMatchObject({ status: 'error', reason: 'lock-timeout' });
    expect(setItem).not.toHaveBeenCalled();
  });
  it('新鍵已存在，即使沒有 locks 也直接使用', async () => {
    const store = migrated(); const before = new Map(storage); const writes = setItem.mock.calls.length;
    expect(await ensureBookletStore(deps())).toEqual({ status: 'ready', store, migrated: false });
    expect(storage).toEqual(before); expect(setItem).toHaveBeenCalledTimes(writes);
  });
  it('第 1 步重新讀到另一頁的新鍵，不讀舊資料，不寫任何鍵', () => {
    const store = migrated(); storage.set(DRAFT_KEY, '{'); const writes = setItem.mock.calls.length;
    expect(migrateInsideLock(deps())).toEqual({ status: 'ready', store, migrated: false });
    expect(storage.get(DRAFT_KEY)).toBe('{'); expect(setItem).toHaveBeenCalledTimes(writes);
  });
});

describe('遷移交錯與中斷', () => {
  it('第 2 步讀完後舊頁改答，第 4 步搬入最後保存內容', () => {
    const old = draft(); seed([old]); const original = persistence.bumpDailyDraftSeqs;
    vi.spyOn(persistence, 'bumpDailyDraftSeqs').mockImplementationOnce(() => {
      saveDailyDraft({ ...old, position: 1, questions: [q('q1', 'C', { unsure: true, ms: 88 }), q('q2')] }, old);
      return original();
    });
    const before = storage.get(ATTEMPT_KEY); const store = ready(migrateInsideLock(deps()));
    expect(store.booklets[0].questions).toEqual([q('q1', 'C', { unsure: true, ms: 88 }), q('q2')]);
    expect(store.booklets[0].position).toBe(1); expect(getDailyDrafts()[0].seq).toBe(6); expect(storage.get(ATTEMPT_KEY)).toBe(before);
    expect(() => saveDailyDraft(old, old)).toThrow(DailyConflictError);
  });
  it.each([1, 2, 3])('舊頁交卷第 %i 次寫入中斷，遷移後沿用固定 ID', (step) => {
    const old = draft({ questions: [q('q1', 'A'), q('q2', 'B')] }); const prepared = prepare(old); seed([old]);
    let writes = 0;
    setItem.mockImplementation((key, raw) => { if (++writes === step) throw new Error('關頁'); storage.set(key, raw); });
    const failed = submitDailyDraft(old, prepared); expect(failed.error).toBeDefined();
    expectedAttempts = storage.get(ATTEMPT_KEY); setItem.mockImplementation((key, raw) => { storage.set(key, raw); });
    const before = storage.get(ATTEMPT_KEY); const store = migrated(); expect(storage.get(ATTEMPT_KEY)).toBe(before);
    let booklet = store.booklets[0];
    expect(booklet.status).toBe(step === 1 ? 'open' : 'submitting');
    expect(submitDailyDraft(failed.draft, prepared).error).toBeInstanceOf(DailyConflictError);
    const preparedBooklet = { ...booklet, status: 'submitting' as const, questions: prepared.questions, submission: prepared.submission };
    const result = submitBooklet(booklet, preparedBooklet); expect(result.error).toBeUndefined(); booklet = result.booklet;
    expectedAttempts = storage.get(ATTEMPT_KEY);
    expect(booklet.status).toBe('submitted'); expect(booklet.submission?.attempts.map((a) => a.id)).toEqual(['old-one-answer-1', 'old-one-answer-2']);
    expect(getAttempts().filter((a) => a.qid === 'q1')).toHaveLength(1); expect(getAttempts().filter((a) => a.qid === 'q2')).toHaveLength(1);
    const raw = storage.get(BOOKLET_KEY); expect(migrateInsideLock(deps())).toMatchObject({ migrated: false }); expect(storage.get(BOOKLET_KEY)).toBe(raw);
  });
  it.each(['before-3', 'after-3', 'before-5', 'after-5'] as const)('第 3、5 步前後關頁：%s', (point) => {
    const old = draft({ questions: [q('q1', 'B', { unsure: true, ms: 34 })] }); seed([old]);
    if (point === 'before-3' || point === 'after-3') {
      const original = persistence.bumpDailyDraftSeqs;
      vi.spyOn(persistence, 'bumpDailyDraftSeqs').mockImplementationOnce(() => { if (point === 'after-3') original(); throw new Error('關頁'); });
    } else if (point === 'before-5') {
      vi.spyOn(persistence, 'commitMigratedBookletStore').mockImplementationOnce(() => { throw new Error('關頁'); });
    }
    if (point !== 'after-5') expect(migrateInsideLock(deps())).toMatchObject({ status: 'error', reason: 'write-failed' });
    else migrated();
    const raw = storage.get(BOOKLET_KEY); const store = migrated();
    expect(store.booklets).toHaveLength(1); expect(store.booklets[0].questions).toEqual(old.questions);
    expect(store.booklets[0].assignedQids).toEqual(['q1']);
    expect(getDailyDrafts()[0].seq).toBe(point === 'before-3' || point === 'after-5' ? 5 : 6);
    if (point === 'after-5') expect(storage.get(BOOKLET_KEY)).toBe(raw);
    expect(() => saveDailyDraft(old, old)).toThrow(DailyConflictError);
  });
  it('新鍵寫入後別頁已交卷，讀回採用別頁的合法結果', () => {
    seed([draft({ questions: [q('q1', 'A')] })]);
    const other = buildMigratedStore(source({ drafts: [{ ...prepare(draft({ questions: [q('q1', 'A')] })), status: 'submitted' }] }));
    const raw = JSON.stringify(other); let intercepted = false;
    setItem.mockImplementation((key, value) => {
      if (key === BOOKLET_KEY && !intercepted) { intercepted = true; storage.set(key, raw); }
      else storage.set(key, value);
    });
    const result = migrateInsideLock(deps()); expect(result).toEqual({ status: 'ready', store: other, migrated: true });
    expect(storage.get(BOOKLET_KEY)).toBe(raw); expect(setItem.mock.calls.filter(([key]) => key === BOOKLET_KEY)).toHaveLength(1);
  });
});

describe('損壞與寫入失敗', () => {
  it.each([
    [DRAFT_KEY, '{'], [DRAFT_KEY, ''], [DRAFT_KEY, '{"version":99,"drafts":[]}'],
    [SET_KEY, '{'], [SET_KEY, ''], [SET_KEY, '{"version":99,"sets":[]}'],
    [ATTEMPT_KEY, '{'], [ATTEMPT_KEY, '{"version":99,"attempts":[]}'], [ATTEMPT_KEY, '{"version":1,"attempts":{}}'],
  ])('舊資料損壞不寫入：%s %s', (key, raw) => {
    seed([draft()], [set()]); storage.set(key, raw); if (key === ATTEMPT_KEY) expectedAttempts = raw;
    const before = new Map(storage); expect(migrateInsideLock(deps())).toMatchObject({ status: 'error', reason: 'corrupt-v1' });
    expect(storage).toEqual(before); expect(setItem).not.toHaveBeenCalled();
  });
  it('單筆無效作答沿用既有過濾行為，不阻擋且原字串不變', () => {
    const raw = '{ "version": 1, "attempts": [{"invalid":true}] }'; seedAttempts([], raw); seed([draft()]);
    const store = migrated(); expect(store.booklets[0].questions).toEqual([q('q1'), q('q2')]); expect(storage.get(ATTEMPT_KEY)).toBe(raw);
  });
  it('空作答字串沿用既有空資料行為，不阻擋且原字串不變', () => {
    seedAttempts([], ''); seed([draft()]); const store = migrated();
    expect(store.booklets).toHaveLength(1); expect(storage.get(ATTEMPT_KEY)).toBe('');
  });
  it.each(['seq-write', 'seq-readback', 'new-write', 'new-readback'] as const)('遷移失敗只容許草稿 seq 改變：%s', (failure) => {
    seed([draft()], [set()]); const before = new Map(storage);
    setItem.mockImplementation((key, value) => {
      if ((failure === 'seq-write' && key === DRAFT_KEY) || (failure === 'new-write' && key === BOOKLET_KEY)) throw new Error('quota');
      if (failure === 'seq-readback' && key === DRAFT_KEY) return;
      storage.set(key, failure === 'new-readback' && key === BOOKLET_KEY ? '{' : value);
    });
    expect(migrateInsideLock(deps())).toMatchObject({ status: 'error', reason: 'write-failed' });
    expect(storage.has(BOOKLET_KEY)).toBe(false); unchangedOld(before);
    expect(getDailyDrafts()[0].seq).toBe(failure === 'seq-write' || failure === 'seq-readback' ? 4 : 5);
    if (failure === 'new-readback') expect(removeItem).toHaveBeenCalledWith(BOOKLET_KEY);
  });
  it.each(['', '{', 'null', '{"version":99,"booklets":[]}'])('新鍵損壞或未知版本原字串保留：%s', async (raw) => {
    seed([draft()], [set()]); storage.set(BOOKLET_KEY, raw); const before = new Map(storage);
    const { locks, request } = unavailableLocks();
    expect(await ensureBookletStore(deps({ locks }))).toMatchObject({ status: 'error', reason: 'corrupt-v2' });
    expect(migrateInsideLock(deps())).toMatchObject({ status: 'error', reason: 'corrupt-v2' });
    expect(storage).toEqual(before); expect(request).not.toHaveBeenCalled(); expect(setItem).not.toHaveBeenCalled();
  });
  it('完全沒有舊鍵也寫空 store，記錄遷移當下時間', () => {
    storage.clear(); expectedAttempts = undefined; const store = migrated();
    expect(store).toEqual({ version: 2, migratedAt: TS, current: { '1': null, '3': null }, booklets: [] });
    expect(setItem.mock.calls.map(([key]) => key)).toEqual([BOOKLET_KEY]);
  });
});
