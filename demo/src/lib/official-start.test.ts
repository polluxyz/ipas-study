/** 以真實儲存流程與記憶體替身驗證開新作答，保護既有紀錄與跨頁衝突。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DailyConflictError, OFFICIAL_ROUND_KEY, readOfficialRounds, type OfficialRound } from './attempts';
import type { OfficialRoundCatalogQuestion } from './official-round';
import { startOfficialRound } from './official-start';

const TS = '2026-11-13T06:05:09Z';
function question(number: number, overrides: Partial<OfficialRoundCatalogQuestion> = {}): OfficialRoundCatalogQuestion {
  return { id: `115-1-S3-Q${String(number).padStart(2, '0')}`, rev: 1, subject: 3, source: 'exam', session: '115-1',
    number, review: { status: 'verified' }, ...overrides };
}
function set(questions: readonly OfficialRoundCatalogQuestion[] = [question(1), question(2)]) {
  return { id: '115-1-S3', subject: 3 as const, questions };
}
function round(overrides: Partial<OfficialRound> = {}): OfficialRound {
  const id = overrides.id ?? 'existing';
  return { id, seq: 0, setId: '115-1-S3', subject: 3, number: 1, createdAt: TS,
    attemptMode: `official-round:${id}:S3`, status: 'open', position: 0,
    questions: [1, 2].map((number) => ({ id: question(number).id, rev: 1, choice: null, unsure: false, ms: 0 })), ...overrides };
}
function prepared(status: 'submitting' | 'submitted'): OfficialRound {
  const current = round();
  const questions = current.questions.map((q) => ({ ...q, choice: 'A' as const, correct: true }));
  return { ...current, status, questions, submission: { ts: TS, total: 2, correct: 2,
    attempts: questions.map((q) => ({ id: `${current.id}:${q.id}`, qid: q.id, rev: q.rev, choice: q.choice,
      correct: true, ms: 0, ts: TS, mode: current.attemptMode })) } };
}

let storage: Map<string, string>;
let getItem: ReturnType<typeof vi.fn<(key: string) => string | null>>;
let setItem: ReturnType<typeof vi.fn<(key: string, value: string) => void>>;
let randomId: ReturnType<typeof vi.fn<() => string>>;
let now: ReturnType<typeof vi.fn<() => string>>;
beforeEach(() => {
  storage = new Map();
  getItem = vi.fn((key: string) => storage.get(key) ?? null);
  setItem = vi.fn((key: string, value: string) => { storage.set(key, value); });
  randomId = vi.fn(() => 'fresh');
  now = vi.fn(() => TS);
  vi.stubGlobal('localStorage', { getItem, setItem, removeItem: (key: string) => { storage.delete(key); } });
});
afterEach(() => { vi.unstubAllGlobals(); });
function seed(...rounds: OfficialRound[]): void {
  storage.set(OFFICIAL_ROUND_KEY, JSON.stringify({ version: 1, rounds }));
}

describe('共用開新作答', () => {
  it('沒紀錄才產生 ID 和時間，只建立 1 筆有效題的新作答', () => {
    const events: string[] = [];
    randomId.mockImplementation(() => { events.push('id'); return 'fresh'; });
    now.mockImplementation(() => { events.push('time'); return TS; });
    const catalog = [question(2, { review: { status: 'disputed' } }), question(3, { review: { status: 'draft' } }),
      question(4, { source: 'guide' }), question(5, { subject: 1 }), question(1)];
    const before = JSON.stringify(catalog);
    expect(startOfficialRound(set(catalog), randomId, now)).toEqual({ roundId: 'fresh', resumed: false });
    expect(events).toEqual(['id', 'time']);
    expect(randomId).toHaveBeenCalledTimes(1); expect(now).toHaveBeenCalledTimes(1);
    const saved = readOfficialRounds().rounds;
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ id: 'fresh', createdAt: TS, status: 'open', number: 1, subject: 3 });
    expect(saved[0].questions.map((q) => q.id)).toEqual([question(1).id, question(2).id]);
    expect(saved[0].questions.every((q) => q.choice === null && !q.unsure && q.ms === 0)).toBe(true);
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(catalog)).toBe(before);
  });
  it.each(['open', 'submitting'] as const)('已有 %s 時原樣續答，不寫入也不產生 ID 與時間', (status) => {
    const existing = status === 'open' ? round() : prepared(status);
    seed(existing);
    const before = [...storage];
    // 即使新版題庫沒有有效題，也必須先接回既有作答。
    expect(startOfficialRound(set([]), randomId, now)).toEqual({ roundId: existing.id, resumed: true });
    expect([...storage]).toEqual(before); expect(setItem).not.toHaveBeenCalled();
    expect(randomId).not.toHaveBeenCalled(); expect(now).not.toHaveBeenCalled();
  });
  it('同頁連續呼叫 2 次只建立 1 筆', () => {
    expect(startOfficialRound(set(), randomId, now)).toEqual({ roundId: 'fresh', resumed: false });
    expect(startOfficialRound(set(), randomId, now)).toEqual({ roundId: 'fresh', resumed: true });
    expect(readOfficialRounds().rounds).toHaveLength(1); expect(setItem).toHaveBeenCalledTimes(1);
    expect(randomId).toHaveBeenCalledTimes(1); expect(now).toHaveBeenCalledTimes(1);
  });
  it('只有已交卷紀錄時建立新作答，舊紀錄保持不變', () => {
    const existing = prepared('submitted'); seed(existing);
    expect(startOfficialRound(set(), randomId, now)).toEqual({ roundId: 'fresh', resumed: false });
    const saved = readOfficialRounds().rounds;
    expect(saved).toHaveLength(2); expect(saved[0]).toEqual(existing);
    expect(saved[1]).toMatchObject({ number: 2, status: 'open' });
  });
  it('其他題組作答中不妨礙建立，其他儲存鍵不變', () => {
    const other = round({ id: 'other', setId: '114-2-S3', questions: [], attemptMode: 'official-round:other:S3' });
    seed(other); storage.set('ipas-attempts-v1', 'untouched');
    expect(startOfficialRound(set(), randomId, now)).toEqual({ roundId: 'fresh', resumed: false });
    expect(readOfficialRounds().rounds[0]).toEqual(other);
    expect(storage.get('ipas-attempts-v1')).toBe('untouched');
    expect(setItem.mock.calls.map(([key]) => key)).toEqual([OFFICIAL_ROUND_KEY]);
  });
  it.each([{ questions: [] }, { questions: [question(1, { review: { status: 'draft' } })] }])('沒有有效題丟錯且完全不寫入 %j', ({ questions }) => {
    seed(prepared('submitted')); const before = [...storage];
    expect(() => startOfficialRound(set(questions), randomId, now)).toThrow('這份考古題目前沒有可作答的題目。');
    expect([...storage]).toEqual(before); expect(setItem).not.toHaveBeenCalled();
    expect(randomId).not.toHaveBeenCalled(); expect(now).not.toHaveBeenCalled();
  });
  it.each(['', '{', '{"version":99,"rounds":[]}', '{"version":1,"rounds":[{}]}'])('損壞 store 丟錯且不覆寫 %s', (raw) => {
    storage.set(OFFICIAL_ROUND_KEY, raw); const before = [...storage];
    expect(() => startOfficialRound(set(), randomId, now)).toThrow();
    expect([...storage]).toEqual(before); expect(setItem).not.toHaveBeenCalled();
    expect(randomId).not.toHaveBeenCalled(); expect(now).not.toHaveBeenCalled();
  });
  it.each(['open', 'submitting'] as const)('另一頁先建立 %s 時，衝突後重讀並接回既有作答', (status) => {
    const existing = status === 'open' ? round() : prepared(status);
    getItem.mockImplementationOnce(() => null).mockImplementationOnce((key) => {
      seed(existing); return storage.get(key) ?? null;
    });
    expect(startOfficialRound(set(), randomId, now)).toEqual({ roundId: 'existing', resumed: true });
    expect(getItem).toHaveBeenCalledTimes(3); expect(setItem).not.toHaveBeenCalled();
    expect(readOfficialRounds().rounds).toEqual([existing]);
    expect(randomId).toHaveBeenCalledTimes(1); expect(now).toHaveBeenCalledTimes(1);
  });
  it('衝突後重讀沒有作答中時，拋出原本錯誤', () => {
    const conflict = new DailyConflictError();
    setItem.mockImplementationOnce(() => { throw conflict; });
    expect(() => startOfficialRound(set(), randomId, now)).toThrow(conflict);
    expect(getItem).toHaveBeenCalledTimes(3); expect(storage.size).toBe(0);
  });
  it('其他寫入錯誤直接拋出，保留原始資料', () => {
    seed(prepared('submitted')); const before = [...storage]; const error = new Error('quota');
    setItem.mockImplementationOnce(() => { throw error; });
    expect(() => startOfficialRound(set(), randomId, now)).toThrow(error);
    expect([...storage]).toEqual(before); expect(getItem).toHaveBeenCalledTimes(2);
  });
});
