/** 用隔離儲存與合成輪次驗證目錄只讀，包含交卷中斷與損壞資料。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OFFICIAL_ROUND_KEY, STORAGE_KEY, type Attempt, type OfficialRound } from './attempts';
import { officialSets } from './official';
import { type OfficialRoundCatalogQuestion } from './official-round';
import { buildOfficialIndexCards, readOfficialIndexCards } from './official-index-client';

const ts = '2026-11-12T00:00:00Z';
const questions: OfficialRoundCatalogQuestion[] = Array.from({ length: 50 }, (_, index) => ({
  id: `115-1-S3-Q${index + 1}`, rev: 1, number: index + 1, subject: 3, source: 'exam', session: '115-1', review: { status: 'verified' },
}));
const sets = officialSets([...questions, { id: 'guide-S1-01', rev: 1, number: 1, subject: 1, source: 'guide', review: { status: 'verified' } }]);
const attempt = (qid = questions[0].id, mode = 'official:115-1:S3'): Attempt => ({
  id: `attempt-${qid}`, qid, rev: 1, choice: 'A', correct: true, ts, mode, ms: 100,
});
function round(status: OfficialRound['status'] = 'open', number = 1): OfficialRound {
  const id = `round-${number}`;
  const attemptMode = `official-round:${id}:S3`;
  const saved = questions.map((q, index) => ({ id: q.id, rev: q.rev, choice: status === 'open' && index >= 2 ? null : 'A' as const,
    unsure: false, ms: 100, ...(status === 'open' ? {} : { correct: index < 37 }) }));
  return { id, number, seq: 0, setId: '115-1-S3', subject: 3, createdAt: ts, attemptMode, status, position: 0, questions: saved,
    ...(status === 'open' ? {} : { submission: { ts, total: 50, correct: 37,
      attempts: saved.map((q) => ({ ...attempt(q.id, attemptMode), id: `${id}-${q.id}`, correct: q.correct! })) } }) };
}
let data: Map<string, string>;
const setItem = vi.fn();
const removeItem = vi.fn();
beforeEach(() => {
  data = new Map();
  setItem.mockReset().mockImplementation((key: string, value: string) => data.set(key, value));
  removeItem.mockReset().mockImplementation((key: string) => data.delete(key));
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem, removeItem });
});
afterEach(() => vi.unstubAllGlobals());

describe('目錄卡片資料', () => {
  it('空目錄顯示 4 份第 1 輪與 2 份指引，不建立儲存鍵', () => {
    const cards = readOfficialIndexCards(sets);
    expect(cards).toHaveLength(6);
    expect(cards.slice(0, 4).every((card) => card.action?.label === '開始第 1 輪')).toBe(true);
    expect(cards[3].action?.href).toBe('/official/115-1-S3/');
    expect(cards[4]).toMatchObject({ progressText: '已答 0／1 題・答對 0 題', action: { label: '開啟題組 →', href: '/official/guide-S1/' } });
    expect([...data]).toEqual([]);
    expect(setItem).not.toHaveBeenCalled();
  });
  it('組裝作答中、已交卷與舊紀錄，不改傳入資料', () => {
    const rounds = [round('submitted'), round('open', 2)];
    const attempts = [attempt(), attempt('guide-S1-01', 'official:guide:S1')];
    const before = JSON.stringify({ sets, rounds, attempts });
    const cards = buildOfficialIndexCards(sets, rounds, attempts);
    expect(cards[3]).toMatchObject({ progressText: '第 2 輪・已答 2／50', historyText: '已交卷 1 輪・最近 74 分',
      legacyText: '舊紀錄（即時解析）：已答 1／50・答對 1', action: { label: '繼續作答 →', href: '/official/115-1-S3/?round=round-2' } });
    expect(cards[4].progressText).toBe('已答 1／1 題・答對 1 題');
    expect(JSON.stringify({ sets, rounds, attempts })).toBe(before);
  });
  it('只有已交卷時，前往題組頁開始下一輪', () => {
    const card = buildOfficialIndexCards(sets, [round('submitted', 2)], [attempt()])[3];
    expect(card).toMatchObject({ progressText: null, historyText: '已交卷 1 輪・最近 74 分', action: { label: '開始第 3 輪', href: '/official/115-1-S3/' } });
  });
  it('版本變更與未驗證題不計入作答中有效題數', () => {
    const updated = sets.map((set) => ({ ...set, questions: set.questions.map((q, index) => index === 0 ? { ...q, rev: 2 } : index === 1 ? { ...q, review: { status: 'draft' } } : q) }));
    expect(buildOfficialIndexCards(updated, [round()], [])[3].progressText).toBe('第 1 輪・已答 0／48');
  });
});

describe('目錄只讀儲存', () => {
  it.each(['open', 'submitting', 'submitted'] as const)('%s 輪次與作答紀錄前後逐字相同，不呼叫寫入或刪除', (status) => {
    const raw = JSON.stringify({ version: 1, rounds: [round(status)] }, null, 2);
    data.set(OFFICIAL_ROUND_KEY, raw);
    data.set(STORAGE_KEY, JSON.stringify({ version: 1, attempts: [attempt()] }, null, 2));
    const before = [...data];
    const card = readOfficialIndexCards(sets)[3];
    expect(card.errorText).toBeNull();
    expect(card.action?.label).toBe(status === 'submitted' ? '開始第 2 輪' : '繼續作答 →');
    expect([...data]).toEqual(before);
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });
  it.each(['{', '{ "version": 99, "rounds": [] }', '{ "version": 1, "rounds": [{}] }'])('輪次損壞不覆寫，指引照常顯示：%s', (raw) => {
    data.set(OFFICIAL_ROUND_KEY, raw);
    data.set(STORAGE_KEY, JSON.stringify({ version: 1, attempts: [attempt('guide-S1-01', 'official:guide:S1')] }));
    const before = [...data];
    const cards = readOfficialIndexCards(sets);
    expect(cards.slice(0, 4).every((card) => card.errorText?.startsWith('無法讀取輪次') && card.action === null)).toBe(true);
    expect(cards[4]).toMatchObject({ progressText: '已答 1／1 題・答對 1 題', errorText: null });
    expect([...data]).toEqual(before);
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });
  it('作答紀錄損壞仍顯示輪次，不把指引進度誤報為 0', () => {
    data.set(OFFICIAL_ROUND_KEY, JSON.stringify({ version: 1, rounds: [round()] }));
    data.set(STORAGE_KEY, '{');
    const before = [...data];
    const cards = readOfficialIndexCards(sets);
    expect(cards[3]).toMatchObject({ progressText: '第 1 輪・已答 2／50', errorText: '無法讀取舊作答紀錄，已保留原資料。', action: { label: '繼續作答 →' } });
    expect(cards[4]).toMatchObject({ progressText: null, errorText: '無法讀取作答進度，已保留原資料。' });
    expect([...data]).toEqual(before);
    expect(setItem).not.toHaveBeenCalled();
  });
});
