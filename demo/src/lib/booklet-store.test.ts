/** 題本儲存的正反例涵蓋跨頁合併、放棄與資料保護，避免刪除尚需保存的作答。 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BOOKLET_KEY, DRAFT_KEY, BookletStoreError, DailyConflictError, assertBookletCurrent,
  bumpDailyDraftSeqs, clearStudyData, commitMigratedBookletStore, discardBooklet, exportAttempts, getAttempts,
  getDailyDrafts, importAttempts, isBooklet, isBookletStore, isDailyDraft, openBooklet,
  readAllDailySets, readBookletStore, retireBooklet, saveAttemptBatch, saveBooklet,
  submitBooklet, type Attempt, type Booklet, type BookletStore, type DailyDraft,
} from './attempts';
import { createBooklet } from './daily-exam';
import { ensureBookletStore } from './booklet-migration';

const TS = '2026-11-07T03:00:00Z';
function make(overrides: Partial<Booklet> = {}): Booklet {
  const id = overrides.id ?? 'one'; const subject = overrides.subject ?? 1;
  return {
    id, seq: 1, subject, number: 1, createdDate: '2026-11-07', attemptMode: `booklet:${id}:S${subject}`,
    origin: 'new', status: 'open', position: 0, assignedQids: ['q0', 'q1'],
    questions: ['q0', 'q1'].map((qid) => ({ id: qid, rev: 1, choice: null, unsure: false, ms: 0 })), ...overrides,
  };
}
function prepare(booklet: Booklet): Booklet {
  const questions = booklet.questions.map((q) => ({ ...q, choice: q.choice ?? 'A' as const, correct: q.correct ?? true }));
  return { ...booklet, status: 'submitting', questions, submission: {
    ts: TS, total: questions.length, correct: questions.filter((q) => q.correct).length,
    attempts: questions.filter((q) => !q.legacyAttemptId).map((q) => ({
      id: `${booklet.id}-${q.id}`, qid: q.id, rev: q.rev, choice: q.choice, correct: q.correct,
      ts: TS, mode: booklet.attemptMode, ms: q.ms,
    })),
  } };
}
function storeOf(...booklets: Booklet[]): BookletStore {
  return { version: 2, migratedAt: null, current: {
    '1': booklets.find((b) => b.subject === 1)?.id ?? null,
    '3': booklets.find((b) => b.subject === 3)?.id ?? null,
  }, booklets };
}
const oldDraft = (subject: 1 | 3 = 1): DailyDraft => ({
  id: `old-${subject}`, seq: 4, subject, date: '2026-11-06', status: 'open', position: 0,
  questions: make().questions,
});
const oldAttempt = (): Attempt => ({ id: 'old', qid: 'other', rev: 1, choice: 'B', correct: false, ts: TS, mode: 'quiz', ms: 200 });
let storage: Map<string, string>;
let setItem: ReturnType<typeof vi.fn<(key: string, value: string) => void>>;
beforeEach(() => {
  storage = new Map();
  setItem = vi.fn((key: string, value: string) => { storage.set(key, value); });
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null, setItem,
    removeItem: (key: string) => { storage.delete(key); },
  });
});
function seed(...booklets: Booklet[]): BookletStore {
  const store = storeOf(...booklets); storage.set(BOOKLET_KEY, JSON.stringify(store)); return store;
}
function unchanged(action: () => unknown, error: new () => Error = DailyConflictError): void {
  const before = storage.get(BOOKLET_KEY);
  expect(action).toThrow(error); expect(storage.get(BOOKLET_KEY)).toBe(before);
}

describe('題本驗證器', () => {
  it.each(['new', 'v1-draft', 'v1-set'] as const)('接受來源 %s，接受新舊兩種作答模式', (origin) => {
    for (const attemptMode of ['booklet:one:S1', 'daily:2026-11-06:S1']) {
      const booklet = make({ origin, attemptMode });
      expect(isBooklet(booklet)).toBe(true); expect(isBooklet(prepare(booklet))).toBe(true);
      expect(isBooklet({ ...prepare(booklet), status: 'submitted' })).toBe(true);
      expect(isBooklet({ ...booklet, status: 'retired' })).toBe(true);
    }
  });
  it.each([0, 1, 50])('接受 %i 個有效題，分配紀錄保留 1–50 題', (count) => {
    const assignedQids = Array.from({ length: Math.max(1, count) }, (_, i) => `q${i}`);
    expect(isBooklet(make({ assignedQids, questions: assignedQids.slice(0, count).map((id) => ({ ...make().questions[0], id })) }))).toBe(true);
  });
  it('接受另一科、合法閏日、已選答案與沿用舊作答', () => {
    expect(isBooklet(make({ subject: 3, createdDate: '2024-02-29' }))).toBe(true);
    const booklet = make(); booklet.questions[0] = { ...booklet.questions[0], choice: 'B', unsure: true, ms: 123, legacyAttemptId: 'old', correct: false };
    expect(isBooklet(booklet)).toBe(true); expect(isBooklet(prepare(booklet))).toBe(true);
  });
  const invalid: [string, Record<string, unknown>][] = [
    ['空 ID', { id: '' }], ['負序號', { seq: -1 }], ['非整數序號', { seq: 0.5 }],
    ['科目字串', { subject: '1' }], ['其他科目', { subject: 2 }],
    ['題號 0', { number: 0 }], ['非整數題號', { number: 1.5 }], ['字串題號', { number: '1' }],
    ['無效日期', { createdDate: '2026-02-29' }], ['日期格式', { createdDate: '2026-1-1' }],
    ['未知來源', { origin: 'other' }], ['未知狀態', { status: 'other' }],
    ['來源非字串', { origin: { toString: () => 'new' } }], ['狀態非字串', { status: { toString: () => 'open' } }],
    ['跨科模式', { attemptMode: 'booklet:one:S3' }], ['他本模式', { attemptMode: 'booklet:other:S1' }],
    ['舊模式跨科', { attemptMode: 'daily:2026-11-07:S3' }], ['舊模式無效日期', { attemptMode: 'daily:2026-02-29:S1' }],
    ['模式多餘字元', { attemptMode: 'booklet:one:S1:extra' }], ['無模式', { attemptMode: null }],
    ['分配重複', { assignedQids: ['q0', 'q0'] }], ['分配空白', { assignedQids: [''] }],
    ['分配非字串', { assignedQids: [1] }], ['分配 0 題', { assignedQids: [] }],
    ['分配 51 題', { assignedQids: Array.from({ length: 51 }, (_, i) => `q${i}`) }],
    ['題目未分配', { assignedQids: ['q0'] }], ['位置負數', { position: -1 }], ['位置超界', { position: 2 }],
    ['位置非整數', { position: 0.5 }], ['非陣列題目', { questions: {} }],
    ['超過 50 題', { questions: Array.from({ length: 51 }, () => make().questions[0]) }],
    ['題目 ID 重複', { questions: [make().questions[0], make().questions[0]] }],
    ['題目版本錯誤', { questions: [{ ...make().questions[0], rev: 0 }] }],
    ['無效選項', { questions: [{ ...make().questions[0], choice: 'E' }] }],
    ['未答卻標不確定', { questions: [{ ...make().questions[0], unsure: true }] }],
    ['負時間', { questions: [{ ...make().questions[0], ms: -1 }] }],
    ['無限時間', { questions: [{ ...make().questions[0], ms: Infinity }] }],
    ['未提交卻有正確性', { questions: [{ ...make().questions[0], correct: null }] }],
    ['舊作答缺正確性', { questions: [{ ...make().questions[0], choice: 'A', legacyAttemptId: 'old' }] }],
    ['開本帶提交', { submission: prepare(make()).submission }],
    ['結束本帶提交', { status: 'retired', submission: prepare(make()).submission }],
    ['結束本帶新評分', { status: 'retired', questions: [{ ...make().questions[0], choice: 'A', correct: true }] }],
  ];
  it.each(invalid)('拒絕%s', (_label, override) => { expect(isBooklet({ ...make(), ...override })).toBe(false); });
  it.each([null, [], 'booklet', 1])('拒絕非題本 %j', (value) => { expect(isBooklet(value)).toBe(false); });
  it.each([
    ['提交缺失', (b: Booklet) => { delete b.submission; }],
    ['提交時間損壞', (b: Booklet) => { b.submission!.ts = 'bad'; }],
    ['提交題數不符', (b: Booklet) => { b.submission!.total = 99; }],
    ['提交分數不符', (b: Booklet) => { b.submission!.correct = 0; }],
    ['提交模式不符', (b: Booklet) => { b.submission!.attempts[0].mode = 'daily:2026-11-07:S1'; }],
    ['提交作答 ID 重複', (b: Booklet) => { b.submission!.attempts[1].id = b.submission!.attempts[0].id; }],
    ['提交答案不符', (b: Booklet) => { b.submission!.attempts[0].choice = 'B'; }],
    ['提交時間不符', (b: Booklet) => { b.submission!.attempts[0].ts = '2026-11-06T03:00:00Z'; }],
    ['提交用時不符', (b: Booklet) => { b.submission!.attempts[0].ms = 1; }],
    ['提交有未答題', (b: Booklet) => { b.questions[0].choice = null; }],
  ] as const)('拒絕%s', (_label, change) => {
    const b = prepare(make()); expect(isBooklet(b)).toBe(true); change(b); expect(isBooklet(b)).toBe(false);
  });
  it('舊草稿仍只接受原日期模式及 3 種狀態', () => {
    expect(isDailyDraft(oldDraft())).toBe(true);
    const prepared = prepare(make());
    expect(isDailyDraft({ ...oldDraft(), ...prepared, date: '2026-11-06' })).toBe(false);
    expect(isDailyDraft({ ...oldDraft(), status: 'retired' })).toBe(false);
  });
});

describe('整包驗證與損壞保護', () => {
  it('接受空儲存、兩科同題號與合法遷移時間', () => {
    expect(isBookletStore(storeOf())).toBe(true);
    expect(isBookletStore({ ...storeOf(make(), make({ id: 'three', subject: 3 })), migratedAt: TS })).toBe(true);
    expect(readBookletStore()).toBeNull();
    const store = seed(make()); expect(readBookletStore()).toEqual(store);
  });
  it.each([
    ['版本', (s: BookletStore) => ({ ...s, version: 1 })],
    ['遷移時間', (s: BookletStore) => ({ ...s, migratedAt: 'bad' })],
    ['ID 重複', (s: BookletStore) => ({ ...s, booklets: [...s.booklets, make({ number: 2 })] })],
    ['同科題號重複', (s: BookletStore) => ({ ...s, booklets: [...s.booklets, make({ id: 'two' })] })],
    ['current 指向他科', (s: BookletStore) => ({ ...s, current: { '1': null, '3': 'one' } })],
    ['current 不存在', (s: BookletStore) => ({ ...s, current: { '1': 'missing', '3': null } })],
    ['current 缺一科', (s: BookletStore) => ({ ...s, current: { '1': 'one' } })],
    ['current 非字串', (s: BookletStore) => ({ ...s, current: { '1': 1, '3': null } })],
    ['current 是陣列', (s: BookletStore) => ({ ...s, current: [null, null, null, null] })],
    ['題本無效', (s: BookletStore) => ({ ...s, booklets: [{}] })],
  ] as const)('拒絕%s', (_label, change) => { expect(isBookletStore(change(storeOf(make())))).toBe(false); });
  it.each(['', '{', 'null', '{"version":99,"booklets":[]}', '{"version":2,"current":{}}'])('損壞字串逐字保留且不抽題：%s', (raw) => {
    storage.set(BOOKLET_KEY, raw); const build = vi.fn(() => make());
    unchanged(() => readBookletStore(), BookletStoreError);
    unchanged(() => openBooklet(1, build), BookletStoreError); expect(build).not.toHaveBeenCalled();
  });
});

describe('保存與開本', () => {
  it('同步讀最新作答，空儲存建立 seq 1 與 current', () => {
    saveAttemptBatch([oldAttempt()]);
    const saved = openBooklet(1, ({ store, attempts }) => {
      expect(store).toEqual(storeOf()); expect(attempts).toEqual([oldAttempt()]);
      return make({ seq: 99 });
    });
    expect(saved?.seq).toBe(1); expect(readBookletStore()).toEqual(storeOf(make()));
  });
  it.each([false, true])('build 回 null 完全不寫入（已存在：%s）', (existing) => {
    if (existing) seed(make({ status: 'retired' }));
    const before = storage.get(BOOKLET_KEY); expect(openBooklet(1, () => null)).toBeNull();
    expect(setItem).not.toHaveBeenCalled(); expect(storage.get(BOOKLET_KEY)).toBe(before);
  });
  it.each(['open', 'submitting'] as const)('同科 %s 時拒絕並且不呼叫 build', (status) => {
    seed(status === 'open' ? make() : prepare(make())); const build = vi.fn(() => make({ id: 'two', number: 2 }));
    unchanged(() => openBooklet(1, build)); expect(build).not.toHaveBeenCalled();
  });
  it.each(['submitted', 'retired'] as const)('同科只有 %s 可開，其他科未交卷不阻擋', (status) => {
    const previous = status === 'submitted' ? { ...prepare(make()), status } : make({ status });
    const other = make({ id: 'three', subject: 3 }); seed(previous, other);
    const saved = openBooklet(1, () => make({ id: 'two', number: 2 }));
    expect(readBookletStore()).toEqual({ ...storeOf(previous, other), current: { '1': 'two', '3': 'three' }, booklets: [previous, other, saved] });
  });
  it('build 不能修改歷史，錯科、重複題號或非 open 都不寫入', () => {
    const previous = make({ status: 'retired' }); seed(previous);
    for (const built of [make({ subject: 3 }), make({ id: 'two' }), prepare(make({ id: 'two', number: 2 }))]) {
      unchanged(() => openBooklet(1, () => built), BookletStoreError);
    }
    openBooklet(1, ({ store }) => { store.booklets[0].questions = []; return make({ id: 'two', number: 2 }); });
    expect(readBookletStore()?.booklets[0]).toEqual(previous);
  });
  it('多分頁依目標題本合併，保留兩科答案、歷史與 current', () => {
    const one = make(); const three = make({ id: 'three', subject: 3 });
    const history = make({ id: 'history', number: 2, status: 'retired' }); seed(one, three, history);
    const savedOne = saveBooklet({ ...one, questions: one.questions.map((q) => ({ ...q, choice: 'B' })) }, one);
    const savedThree = saveBooklet({ ...three, questions: three.questions.map((q) => ({ ...q, choice: 'C' })) }, three);
    expect(readBookletStore()).toEqual({ ...storeOf(one, three, history), booklets: [savedOne, savedThree, history] });
    expect(savedOne.seq).toBe(2); expect(savedThree.seq).toBe(2);
    expect(assertBookletCurrent(savedOne)).toEqual(readBookletStore());
  });
  it.each(['seq', 'id', 'subject', 'current', 'removed'] as const)('衝突 %s 不改任何位元', (kind) => {
    const one = make(); const next = make({ id: 'next', number: 2 }); const store = seed(one, next);
    const expected = { ...one };
    if (kind === 'seq') expected.seq++;
    if (kind === 'id') expected.id = 'missing';
    if (kind === 'subject') expected.subject = 3;
    if (kind === 'current') storage.set(BOOKLET_KEY, JSON.stringify({ ...store, current: { ...store.current, '1': next.id } }));
    if (kind === 'removed') storage.delete(BOOKLET_KEY);
    unchanged(() => assertBookletCurrent(expected)); unchanged(() => saveBooklet(one, expected));
  });
  it.each(['id', 'attemptMode', 'assignedQids', 'number', 'createdDate', 'origin'] as const)('不可修改建立時固定的欄位 %s', (field) => {
    const one = make(); seed(one);
    const changed = { ...one, [field]: field === 'assignedQids' ? ['q0'] : field === 'number' ? 2 : 'changed' };
    unchanged(() => saveBooklet(changed, one));
  });
  it('無效答案及寫入失敗保留原儲存', () => {
    const one = make(); seed(one);
    unchanged(() => saveBooklet({ ...one, position: 99 }, one), BookletStoreError);
    setItem.mockImplementationOnce(() => { throw new Error('quota'); });
    const before = storage.get(BOOKLET_KEY); expect(() => saveBooklet(one, one)).toThrow('quota');
    expect(storage.get(BOOKLET_KEY)).toBe(before);
  });
  it('開本寫入失敗不回傳新題本，保留原題本', () => {
    seed(make({ status: 'retired' })); const before = storage.get(BOOKLET_KEY);
    setItem.mockImplementationOnce(() => { throw new Error('quota'); });
    expect(() => openBooklet(1, () => make({ id: 'next', number: 2 }))).toThrow('quota');
    expect(storage.get(BOOKLET_KEY)).toBe(before);
  });
});

describe('交卷與結束', () => {
  it.each([1, 2, 3])('第 %i 次寫入失敗可用相同 prepared 重試，ID 與作答筆數固定', (step) => {
    const one = make(); const other = make({ id: 'three', subject: 3 });
    const next = make({ id: 'next', number: 2 }); const later = make({ id: 'later', number: 3 });
    const history = make({ id: 'history', number: 4, status: 'retired' });
    seed(one, other, later, history, next); saveAttemptBatch([oldAttempt()]);
    const prepared = prepare(one); const before = storage.get('ipas-attempts-v1'); let writes = 0;
    setItem.mockImplementation((key, raw) => { if (++writes === step) throw new Error('quota'); storage.set(key, raw); });
    const failed = submitBooklet(one, prepared);
    expect(failed.error?.message).toBe('quota'); expect(failed.booklet.status).toBe(step === 1 ? 'open' : 'submitting');
    expect(failed.booklet).toEqual(readBookletStore()?.booklets[0]);
    expect(readBookletStore()?.current['1']).toBe('one');
    if (step < 3) expect(storage.get('ipas-attempts-v1')).toBe(before);
    else expect(getAttempts()).toEqual([oldAttempt(), ...prepared.submission!.attempts]);
    const success = submitBooklet(failed.booklet, prepared);
    expect(success.error).toBeUndefined(); expect(success.booklet.status).toBe('submitted');
    expect(getAttempts()).toEqual([oldAttempt(), ...prepared.submission!.attempts]);
    expect(readBookletStore()).toEqual({ ...storeOf(one, other), current: { '1': 'next', '3': 'three' }, booklets: [success.booklet, other, later, history, next] });
    const raw = storage.get(BOOKLET_KEY); const count = setItem.mock.calls.length;
    expect(submitBooklet(success.booklet, prepared).error).toBeUndefined();
    expect(setItem.mock.calls).toHaveLength(count); expect(storage.get(BOOKLET_KEY)).toBe(raw);
  });
  it('重載 submitting 沿用固定 ID，沒有下一本則 current 是 null', () => {
    const pending = prepare(make()); seed(pending); saveAttemptBatch(pending.submission!.attempts);
    const restored = readBookletStore()!.booklets[0]; const success = submitBooklet(restored, restored);
    expect(success.error).toBeUndefined(); expect(success.booklet.status).toBe('submitted');
    expect(getAttempts()).toEqual(pending.submission!.attempts); expect(readBookletStore()?.current['1']).toBeNull();
  });
  it('遷移題本沿用舊紀錄，只新增未沿用的題', () => {
    const one = make({ attemptMode: 'daily:2026-11-06:S1', origin: 'v1-set' });
    const old = { ...oldAttempt(), qid: 'q0', correct: false };
    one.questions[0] = { ...one.questions[0], choice: old.choice, correct: old.correct, legacyAttemptId: old.id };
    seed(one); saveAttemptBatch([old]); const prepared = prepare(one); const result = submitBooklet(one, prepared);
    expect(result.error).toBeUndefined(); expect(prepared.submission?.attempts).toHaveLength(1);
    expect(getAttempts()).toEqual([old, ...prepared.submission!.attempts]);
    expect(getAttempts()[1].mode).toBe(one.attemptMode); expect(result.booklet.submission?.correct).toBe(1);
  });
  it('空題本與錯誤 prepared 不會新增作答', () => {
    const empty = make({ questions: [] }); seed(empty);
    const before = storage.get(BOOKLET_KEY);
    expect(submitBooklet(empty, prepare(empty)).error).toBeInstanceOf(BookletStoreError);
    expect(submitBooklet(empty, prepare(make({ id: 'other' }))).error).toBeInstanceOf(DailyConflictError);
    expect(getAttempts()).toEqual([]); expect(storage.get(BOOKLET_KEY)).toBe(before);
  });
  it('交卷前衝突不寫作答，舊 submitted 也不覆寫下一本', () => {
    const one = make(); seed(one); const updated = saveBooklet(one, one);
    expect(submitBooklet(one, prepare(one)).error).toBeInstanceOf(DailyConflictError); expect(getAttempts()).toEqual([]);
    const submitted = submitBooklet(updated, prepare(updated)).booklet;
    openBooklet(1, () => make({ id: 'next', number: 2 }));
    expect(submitBooklet(submitted, prepare(updated)).error).toBeUndefined();
    expect(readBookletStore()?.current['1']).toBe('next');
  });
  it('結束 open 保留全部資料與舊作答，current 按題號接續', () => {
    const one = make(); const next = make({ id: 'next', number: 2 }); const later = make({ id: 'later', number: 3 });
    const other = make({ id: 'three', subject: 3 }); seed(one, later, next, other); saveAttemptBatch([oldAttempt()]);
    const before = storage.get('ipas-attempts-v1'); const retired = retireBooklet(one, one);
    expect(retired).toEqual({ ...one, seq: 2, status: 'retired' });
    expect(readBookletStore()).toEqual({ ...storeOf(one, other), current: { '1': next.id, '3': other.id }, booklets: [retired, later, next, other] });
    expect(storage.get('ipas-attempts-v1')).toBe(before);
  });
  it('可結束空題本，沒有下一本則 current 是 null', () => {
    const one = make({ questions: [] }); seed(one);
    expect(retireBooklet(one, one).status).toBe('retired'); expect(readBookletStore()?.current['1']).toBeNull();
    expect(getAttempts()).toEqual([]);
  });
  it.each(['submitting', 'submitted', 'retired'] as const)('拒絕結束 %s，不修改儲存', (status) => {
    const one = status === 'retired' ? make({ status }) : { ...prepare(make()), status };
    seed(one); unchanged(() => retireBooklet(one, one), BookletStoreError);
  });
  it('retire 仍檢查最新狀態、序號與 current', () => {
    const one = make(); seed(one); saveBooklet(prepare(one), one);
    unchanged(() => retireBooklet(one, one));
  });
});

describe('放棄題本的資格與刪除', () => {
  it('0 答案且有用時可刪除，其他題本、遷移時間與作答原字串不變', () => {
    const one = make(); one.questions[0].ms = 1250;
    const other = make({ id: 'three', subject: 3 });
    const history = { ...prepare(make({ id: 'history', number: 2 })), status: 'submitted' as const };
    const retired = make({ id: 'retired', number: 3, status: 'retired' });
    const initial = { ...storeOf(one, other, history, retired), migratedAt: TS };
    storage.set(BOOKLET_KEY, JSON.stringify(initial));
    const attemptRaw = JSON.stringify({ version: 1, attempts: [oldAttempt()] }, null, 2);
    storage.set('ipas-attempts-v1', attemptRaw);
    const getItem = vi.spyOn(localStorage, 'getItem');
    const result = discardBooklet(one);
    expect(result).toEqual({ ...initial, booklets: [other, history, retired], current: { '1': null, '3': 'three' } });
    expect(readBookletStore()).toEqual(result);
    expect(storage.get('ipas-attempts-v1')).toBe(attemptRaw);
    expect(getItem.mock.calls.every(([key]) => key === BOOKLET_KEY)).toBe(true);
    expect(setItem).toHaveBeenCalledExactlyOnceWith(BOOKLET_KEY, JSON.stringify(result));
  });
  it.each(['已選答案', '鎖定作答', 'submitting', 'submitted', 'retired', '0 題', '略過題', '順序不同'] as const)
  ('拒絕%s，store 原字串不變且不寫入', (kind) => {
    let one = make();
    if (kind === '已選答案') one.questions[0].choice = 'B';
    if (kind === '鎖定作答') one.questions[0] = { ...one.questions[0], choice: 'B', legacyAttemptId: 'old', correct: false };
    if (kind === 'submitting' || kind === 'submitted') one = { ...prepare(one), status: kind };
    if (kind === 'retired') one.status = 'retired';
    if (kind === '0 題') one.questions = [];
    if (kind === '略過題') one.questions = one.questions.slice(1);
    if (kind === '順序不同') one.questions.reverse();
    expect(isBooklet(one)).toBe(true);
    const initial = storeOf(one);
    storage.set(BOOKLET_KEY, JSON.stringify(initial, null, 2));
    unchanged(() => discardBooklet(one), BookletStoreError);
    expect(setItem).not.toHaveBeenCalled();
  });
  it.each(['open', 'submitting'] as const)('current 接續 number 最小的 %s，保留其他題本順序與內容', (status) => {
    const one = make({ number: 4 });
    const nextBase = make({ id: 'next', number: 2 });
    const next = status === 'submitting' ? prepare(nextBase) : nextBase;
    const later = make({ id: 'later', number: 3 });
    const history = make({ id: 'history', number: 1, status: 'retired' });
    const initial = seed(one, later, history, next);
    expect(discardBooklet(one)).toEqual({ ...initial, booklets: [later, history, next], current: { '1': 'next', '3': null } });
    expect(setItem).toHaveBeenCalledTimes(1);
  });
  it.each(['v1-draft', 'v1-set'] as const)('可放棄 %s，空 store 阻止舊鍵重新遷移', async (origin) => {
    const one = make({ origin, attemptMode: 'daily:2026-11-06:S1' });
    const initial = { ...storeOf(one), migratedAt: TS };
    storage.set(BOOKLET_KEY, JSON.stringify(initial));
    const draftsRaw = JSON.stringify({ version: 1, drafts: [oldDraft()] });
    const setsRaw = JSON.stringify({ version: 1, sets: [{ date: '2026-11-06', subject: 1, questions: [{ id: 'q0', rev: 1 }] }] });
    storage.set(DRAFT_KEY, draftsRaw); storage.set('ipas-daily-v1', setsRaw);
    const empty = discardBooklet(one);
    expect(empty).toEqual({ version: 2, migratedAt: TS, current: { '1': null, '3': null }, booklets: [] });
    expect(storage.has(BOOKLET_KEY)).toBe(true); expect(isBookletStore(readBookletStore())).toBe(true);
    const raw = storage.get(BOOKLET_KEY);
    const request = vi.fn(() => { throw new Error('既有空 store 不應重新取鎖'); });
    expect(await ensureBookletStore({ catalog: [], groups: [], now: () => new Date(TS), locks: { request } }))
      .toEqual({ status: 'ready', store: empty, migrated: false });
    expect(request).not.toHaveBeenCalled(); expect(setItem).toHaveBeenCalledTimes(1);
    expect(storage.get(BOOKLET_KEY)).toBe(raw);
    expect(storage.get(DRAFT_KEY)).toBe(draftsRaw); expect(storage.get('ipas-daily-v1')).toBe(setsRaw);
  });
  it('放棄寫入失敗時保留題本與作答原字串', () => {
    const one = make(); seed(one);
    storage.set('ipas-attempts-v1', '作答原字串');
    setItem.mockImplementationOnce(() => { throw new Error('quota'); });
    const raw = storage.get(BOOKLET_KEY);
    expect(() => discardBooklet(one)).toThrow('quota');
    expect(storage.get(BOOKLET_KEY)).toBe(raw); expect(storage.get('ipas-attempts-v1')).toBe('作答原字串');
  });
});

describe('放棄題本的衝突與題號', () => {
  it.each(['seq', 'id', 'subject', 'current', 'deleted', 'no-store'] as const)('衝突 %s 丟 DailyConflictError 且完全不寫入', (kind) => {
    const one = make(); const next = make({ id: 'next', number: 2 }); const initial = seed(one, next);
    const expected = { id: one.id, seq: one.seq, subject: one.subject };
    if (kind === 'seq') expected.seq = 0;
    if (kind === 'id') expected.id = 'missing';
    if (kind === 'subject') expected.subject = 3;
    if (kind === 'current') storage.set(BOOKLET_KEY, JSON.stringify({ ...initial, current: { '1': 'next', '3': null } }));
    if (kind === 'deleted') storage.set(BOOKLET_KEY, JSON.stringify(storeOf(next)));
    if (kind === 'no-store') storage.delete(BOOKLET_KEY);
    unchanged(() => discardBooklet(expected)); expect(setItem).not.toHaveBeenCalled();
  });
  it('使用最新題本檢查資格，即使參照相同也不刪除已有答案的資料', () => {
    const one = make(); seed(one);
    const expected = readBookletStore()!.booklets[0];
    const latest = make(); latest.questions[0].choice = 'C';
    storage.set(BOOKLET_KEY, JSON.stringify(storeOf(latest)));
    unchanged(() => discardBooklet(expected), BookletStoreError);
    expect(setItem).not.toHaveBeenCalled();
  });
  it('頁面讀取後另一科保存答案，放棄仍保留另一科最新資料', () => {
    const one = make(); const other = make({ id: 'three', subject: 3 }); seed(one, other);
    const expected = readBookletStore()!.booklets[0];
    const updated = saveBooklet({ ...other, questions: other.questions.map((q) => ({ ...q, choice: 'C', ms: 400 })) }, other);
    expect(updated.seq).toBe(2); setItem.mockClear();
    expect(discardBooklet(expected)).toEqual({ ...storeOf(updated), current: { '1': null, '3': 'three' } });
    expect(readBookletStore()?.booklets).toEqual([updated]); expect(setItem).toHaveBeenCalledTimes(1);
  });
  it('另一頁保存用時後 seq 過期，不能刪除', () => {
    const one = make(); seed(one);
    const updated = saveBooklet({ ...one, questions: one.questions.map((q) => ({ ...q, ms: 10 })) }, one);
    expect(updated.seq).toBe(2); setItem.mockClear();
    unchanged(() => discardBooklet(one)); expect(setItem).not.toHaveBeenCalled();
  });
  it.each([
    { label: '唯一題本', numbers: [1], removed: 1, remaining: [], next: 1 },
    { label: '最後一本', numbers: [1, 2, 3], removed: 3, remaining: [1, 2], next: 3 },
    { label: '中間題本', numbers: [1, 2, 3], removed: 2, remaining: [1, 3], next: 4 },
  ])('放棄$label，保留缺號並以剩下最大題號開本', ({ numbers, removed, remaining, next }) => {
    const booklets = numbers.map((number) => make({ id: `b${number}`, number, status: number === removed ? 'open' : 'retired' }));
    const initial = { ...storeOf(...booklets), current: { '1': `b${removed}`, '3': null } };
    storage.set(BOOKLET_KEY, JSON.stringify(initial));
    const saved = discardBooklet(booklets.find((b) => b.number === removed)!);
    expect(saved.booklets.map((b) => b.number)).toEqual(remaining);
    const created = createBooklet({ store: saved, subject: 1, date: '2026-11-09', id: 'fresh-id', selected: [{ id: 'q0', rev: 1 }] });
    expect(created.number).toBe(next); expect(created.id).toBe('fresh-id');
    expect(saved.booklets.map((b) => b.number)).toEqual(remaining);
  });
});

describe('遷移輔助與清除', () => {
  it('讀取所有日期與兩科清單，不修改舊鍵', () => {
    expect(readAllDailySets()).toEqual([]);
    const sets = [1, 3].map((subject) => ({ subject, date: '2026-01-01', questions: [{ id: 'q0', rev: 1 }] }));
    const raw = JSON.stringify({ version: 1, sets }); storage.set('ipas-daily-v1', raw);
    expect(readAllDailySets()).toEqual(sets); expect(storage.get('ipas-daily-v1')).toBe(raw);
  });
  it.each(['', '{', '{"version":99,"sets":[]}', '{"version":1,"sets":[{}]}'])('損壞舊清單丟錯且不改寫：%s', (raw) => {
    storage.set('ipas-daily-v1', raw); expect(() => readAllDailySets()).toThrow();
    expect(storage.get('ipas-daily-v1')).toBe(raw); expect(setItem).not.toHaveBeenCalled();
  });
  it('兩科草稿一起加 1，內容與順序原樣保留', () => {
    const drafts = [oldDraft(3), oldDraft(1)]; storage.set(DRAFT_KEY, JSON.stringify({ version: 1, drafts }));
    const bumped = bumpDailyDraftSeqs(); expect(bumped).toEqual(drafts.map((draft) => ({ ...draft, seq: 5 })));
    expect(getDailyDrafts()).toEqual(bumped); expect(setItem).toHaveBeenCalledTimes(1);
  });
  it.each([null, '{"version":1,"drafts":[]}'])('沒有草稿時不寫入：%s', (raw) => {
    if (raw !== null) storage.set(DRAFT_KEY, raw);
    expect(bumpDailyDraftSeqs()).toEqual([]); expect(setItem).not.toHaveBeenCalled();
  });
  it.each(['', '{', '{"version":99,"drafts":[]}', '{"version":1,"drafts":[{}]}'])('損壞舊草稿丟錯且不改寫：%s', (raw) => {
    storage.set(DRAFT_KEY, raw); expect(() => bumpDailyDraftSeqs()).toThrow();
    expect(storage.get(DRAFT_KEY)).toBe(raw); expect(setItem).not.toHaveBeenCalled();
  });
  it('草稿加序號讀回不符時丟錯', () => {
    const raw = JSON.stringify({ version: 1, drafts: [oldDraft()] }); storage.set(DRAFT_KEY, raw);
    setItem.mockImplementationOnce(() => {}); expect(() => bumpDailyDraftSeqs()).toThrow(DailyConflictError);
    expect(storage.get(DRAFT_KEY)).toBe(raw);
  });
  it('遷移寫入讀回相符時回 written', () => {
    const store = storeOf(make()); expect(commitMigratedBookletStore(store)).toBe('written');
    expect(readBookletStore()).toEqual(store);
  });
  it('遷移讀回合法但不同時回 adopted，不能再寫', () => {
    const other = storeOf(make({ seq: 2 })); const raw = JSON.stringify(other);
    setItem.mockImplementationOnce((key) => { storage.set(key, raw); });
    expect(commitMigratedBookletStore(storeOf(make()))).toBe('adopted');
    expect(storage.get(BOOKLET_KEY)).toBe(raw); expect(setItem).toHaveBeenCalledTimes(1);
  });
  it.each(['{', '{"version":99}', null])('遷移讀回不合法就移除新鍵並丟錯：%s', (raw) => {
    storage.set(DRAFT_KEY, '舊草稿'); storage.set('ipas-daily-v1', '舊清單');
    setItem.mockImplementationOnce((key) => { if (raw === null) storage.delete(key); else storage.set(key, raw); });
    expect(() => commitMigratedBookletStore(storeOf(make()))).toThrow(BookletStoreError);
    expect(storage.has(BOOKLET_KEY)).toBe(false); expect(storage.get(DRAFT_KEY)).toBe('舊草稿'); expect(storage.get('ipas-daily-v1')).toBe('舊清單');
  });
  it('遷移候選損壞或寫入失敗不移除既有資料', () => {
    const original = seed(make());
    unchanged(() => commitMigratedBookletStore({ ...original, current: { '1': 'missing', '3': null } }), BookletStoreError);
    setItem.mockImplementationOnce(() => { throw new Error('quota'); });
    expect(() => commitMigratedBookletStore(original)).toThrow('quota'); expect(readBookletStore()).toEqual(original);
  });
  it('備份只含作答與已讀，匯入不改題本；清除移除全部 5 個鍵', () => {
    const booklet = make(); seed(booklet); const raw = storage.get(BOOKLET_KEY);
    expect(Object.keys(JSON.parse(exportAttempts()))).toEqual(['version', 'attempts', 'readings']);
    importAttempts(JSON.stringify({ version: 1, attempts: [oldAttempt()], readings: [{ conceptId: 'data-leakage', ts: TS }] }));
    expect(storage.get(BOOKLET_KEY)).toBe(raw);
    storage.set(DRAFT_KEY, JSON.stringify({ version: 1, drafts: [oldDraft()] }));
    storage.set('ipas-daily-v1', JSON.stringify({ version: 1, sets: [] })); storage.set('unrelated', 'keep');
    clearStudyData();
    for (const key of [BOOKLET_KEY, DRAFT_KEY, 'ipas-daily-v1', 'ipas-attempts-v1', 'ipas-reading-v1']) expect(storage.has(key)).toBe(false);
    expect(storage.get('unrelated')).toBe('keep');
  });
});
