/** 用隔離儲存與合成輪次驗證目錄只讀，並測試按下才建立作答的流程。 */
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OFFICIAL_ROUND_KEY, STORAGE_KEY, type Attempt, type OfficialRound } from './attempts';
import { officialSets } from './official';
import { type OfficialRoundCatalogQuestion } from './official-round';
import { buildOfficialIndexCards, createOfficialStartHandler, initOfficialIndex, readOfficialIndexCards } from './official-index-client';

const ts = '2026-11-12T00:00:00Z';
const questions: OfficialRoundCatalogQuestion[] = Array.from({ length: 50 }, (_, index) => ({
  id: `115-1-S3-Q${String(index + 1).padStart(2, '0')}`, rev: 1, number: index + 1, subject: 3, source: 'exam', session: '115-1', review: { status: 'verified' },
}));
const sets = officialSets([...questions, { id: 'guide-S1-01', rev: 1, number: 1, subject: 1, source: 'guide', review: { status: 'verified' } }]);
const exam = sets[3];
const attempt = (qid = questions[0].id, mode = 'official:115-1:S3'): Attempt => ({
  id: `attempt-${qid}`, qid, rev: 1, choice: 'A', correct: true, ts, mode, ms: 100,
});
function round(status: OfficialRound['status'] = 'open', number = 1): OfficialRound {
  const id = `round-${number}`;
  const attemptMode = `official-round:${id}:S3`;
  const submitted = status === 'submitting' || status === 'submitted';
  const saved = questions.map((q, index) => ({ id: q.id, rev: q.rev, choice: !submitted && index >= 2 ? null : 'A' as const,
    unsure: false, ms: 100, ...(submitted ? { correct: index < 37 } : {}) }));
  return { id, number, seq: 0, setId: exam.id, subject: 3, createdAt: ts, attemptMode, status, position: 0, questions: saved,
    ...(submitted ? { submission: { ts, total: 50, correct: 37,
      attempts: saved.map((q) => ({ ...attempt(q.id, attemptMode), id: `${id}-${q.id}`, correct: q.correct! })) } } : {}) };
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

/** 最小元素替身只提供本頁操作，不需要啟動瀏覽器或加入相依套件。 */
class ElementStub { textContent: string | null = null; hidden = true; }
class AnchorStub extends ElementStub {
  href = '';
  removeAttribute(name: string): void { if (name === 'href') this.href = ''; }
}
class ButtonStub extends ElementStub {
  disabled = false;
  listener: (() => void) | null = null;
  addEventListener(_type: string, listener: () => void): void { this.listener = listener; }
  click(): void { if (!this.disabled) this.listener?.(); }
}
function directory(): Map<string, ElementStub> {
  const elements = new Map<string, ElementStub>();
  elements.set('official-status', new ElementStub());
  const catalog = new ElementStub();
  catalog.textContent = JSON.stringify(sets);
  elements.set('official-catalog', catalog);
  for (const set of sets) {
    for (const field of ['progress', 'history', 'legacy', 'error']) elements.set(`${field}-${set.id}`, new ElementStub());
    for (const field of ['action', 'latest', 'records']) elements.set(`${field}-${set.id}`, new AnchorStub());
    if (set.session !== 'guide') elements.set(`start-${set.id}`, new ButtonStub());
  }
  vi.stubGlobal('document', { getElementById: (id: string) => elements.get(id) ?? null });
  vi.stubGlobal('HTMLAnchorElement', AnchorStub);
  vi.stubGlobal('HTMLButtonElement', ButtonStub);
  return elements;
}
const latest = (number: number) => ({ label: '查看上次作答 →', href: `/official/115-1-S3/?round=round-${number}` });
const records = { label: '全部紀錄 →', href: '/official/115-1-S3/' };

describe('目錄卡片資料', () => {
  it('沒有紀錄顯示開始按鈕與 2 份指引，不建立儲存鍵', () => {
    const cards = readOfficialIndexCards(sets);
    expect(cards).toHaveLength(6);
    for (const card of cards.slice(0, 4)) expect(card).toMatchObject({ action: { kind: 'start', label: '開始作答' },
      progressText: null, historyText: null, latestSubmittedLink: null, allRecordsLink: null, errorText: null });
    expect(cards[4]).toMatchObject({ progressText: '已答 0／1 題・答對 0 題',
      action: { kind: 'link', label: '開啟題組 →', href: '/official/guide-S1/' }, latestSubmittedLink: null, allRecordsLink: null });
    expect([...data]).toEqual([]);
    expect(setItem).not.toHaveBeenCalled();
  });
  it('只有作答中時顯示進度與繼續連結', () => {
    expect(buildOfficialIndexCards(sets, [round()], [])[3]).toMatchObject({ progressText: '作答中・已答 2／50',
      historyText: null, action: { kind: 'link', label: '繼續作答 →', href: '/official/115-1-S3/?round=round-1' },
      latestSubmittedLink: null, allRecordsLink: null });
  });
  it('只有已交卷時顯示重新開始與 2 個紀錄連結', () => {
    expect(buildOfficialIndexCards(sets, [round('submitted', 2)], [])[3]).toMatchObject({ progressText: null,
      historyText: '已交卷 1 次・最近 74 分', action: { kind: 'start', label: '重新開始' },
      latestSubmittedLink: latest(2), allRecordsLink: records });
  });
  it('有交卷也有作答中時顯示繼續連結，保留舊紀錄與輸入資料', () => {
    const rounds = [round('submitted'), round('open', 2)];
    const attempts = [attempt(), attempt('guide-S1-01', 'official:guide:S1')];
    const before = JSON.stringify({ sets, rounds, attempts });
    const cards = buildOfficialIndexCards(sets, rounds, attempts);
    expect(cards[3]).toMatchObject({ progressText: '作答中・已答 2／50', historyText: '已交卷 1 次・最近 74 分',
      legacyText: '舊紀錄（即時解析）：已答 1／50・答對 1',
      action: { kind: 'link', label: '繼續作答 →', href: '/official/115-1-S3/?round=round-2' },
      latestSubmittedLink: latest(1), allRecordsLink: records });
    expect(cards[4].progressText).toBe('已答 1／1 題・答對 1 題');
    expect(JSON.stringify({ sets, rounds, attempts })).toBe(before);
  });
  it('只有未交卷紀錄時顯示重新開始與全部紀錄', () => {
    expect(buildOfficialIndexCards(sets, [round('retired')], [])[3]).toMatchObject({ progressText: null, historyText: null,
      action: { kind: 'start', label: '重新開始' }, latestSubmittedLink: null, allRecordsLink: records });
  });
  it('最新紀錄未交卷時仍回看編號最大的已交卷紀錄', () => {
    const rounds = [round('submitted', 3), round('retired', 5), round('submitted', 1)];
    rounds[2].submission!.correct = 10;
    expect(buildOfficialIndexCards(sets, rounds, [])[3]).toMatchObject({ historyText: '已交卷 2 次・最近 74 分',
      latestSubmittedLink: latest(3), action: { kind: 'start', label: '重新開始' } });
  });
  it('版本變更與未驗證題不計入作答中有效題數', () => {
    const updated = sets.map((set) => ({ ...set, questions: set.questions.map((q, index) => index === 0 ? { ...q, rev: 2 } : index === 1 ? { ...q, review: { status: 'draft' } } : q) }));
    expect(buildOfficialIndexCards(updated, [round()], [])[3].progressText).toBe('作答中・已答 0／48');
  });
  it.each([[], [round()], [round('submitted')], [round('submitted'), round('open', 2)], [round('retired')], null])(
    '所有卡片輸出文字不含禁用字：%j', (rounds) => {
      expect(JSON.stringify(buildOfficialIndexCards(sets, rounds, [attempt()]))).not.toContain('輪');
      expect(JSON.stringify(buildOfficialIndexCards(sets, rounds, null))).not.toContain('輪');
    });
  it('頁面讀取提示、備份說明與無腳本提示使用新文字', () => {
    const page = readFileSync(new URL('../pages/official/index.astro', import.meta.url), 'utf8').split('---')[2];
    expect(page).not.toContain('輪');
    expect(page).toContain('正在讀取作答紀錄與進度…');
    expect(page).toContain('考古題每次作答分開計分，交卷過和中途重新開始的紀錄都會保留。');
    expect(page).toContain('備份包含已保存的作答與已讀紀錄。考古題只備份已交卷的作答，不含紀錄清單與未交卷答案。清除後再匯入，作答與統計會恢復，紀錄清單與回看不會恢復。');
  });
});

describe('目錄只讀儲存', () => {
  it.each(['open', 'submitting', 'submitted', 'retired'] as const)('%s 紀錄開頁前後逐字相同，不寫入或恢復交卷', (status) => {
    data.set(OFFICIAL_ROUND_KEY, JSON.stringify({ version: 1, rounds: [round(status)] }, null, 2));
    data.set(STORAGE_KEY, JSON.stringify({ version: 1, attempts: [attempt()] }, null, 2));
    const before = [...data];
    const card = readOfficialIndexCards(sets)[3];
    expect(card.errorText).toBeNull();
    expect(card.action?.label).toBe(status === 'submitted' || status === 'retired' ? '重新開始' : '繼續作答 →');
    const elements = directory();
    initOfficialIndex();
    expect(elements.get('official-status')?.textContent).toBe('各份題組分開記錄。選一份開始，或繼續作答中的那一次。');
    expect(elements.get(`start-${exam.id}`)?.hidden).toBe(status === 'open' || status === 'submitting');
    expect(elements.get(`latest-${exam.id}`)?.hidden).toBe(status !== 'submitted');
    expect(elements.get(`records-${exam.id}`)?.hidden).toBe(status !== 'submitted' && status !== 'retired');
    if (status === 'submitted') expect((elements.get(`latest-${exam.id}`) as AnchorStub).href).toBe(latest(1).href);
    if (status === 'open' || status === 'submitting') expect((elements.get(`action-${exam.id}`) as AnchorStub).href).toBe('/official/115-1-S3/?round=round-1');
    expect([...data]).toEqual(before);
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
    expect([...elements.values()].map((element) => element.textContent).join('')).not.toContain('輪');
  });
  it.each(['{', '{ "version": 99, "rounds": [] }', '{ "version": 1, "rounds": [{}] }'])('資料損壞不覆寫，指引照常顯示：%s', (raw) => {
    data.set(OFFICIAL_ROUND_KEY, raw);
    data.set(STORAGE_KEY, JSON.stringify({ version: 1, attempts: [attempt('guide-S1-01', 'official:guide:S1')] }));
    const before = [...data];
    const cards = readOfficialIndexCards(sets);
    for (const card of cards.slice(0, 4)) expect(card).toMatchObject({
      errorText: '無法讀取作答紀錄，已保留原資料。請確認瀏覽器儲存狀態後重新載入。',
      action: null, latestSubmittedLink: null, allRecordsLink: null });
    expect(cards[4]).toMatchObject({ progressText: '已答 1／1 題・答對 1 題', errorText: null });
    const elements = directory();
    initOfficialIndex();
    expect(elements.get('official-status')?.textContent).toBe('部分紀錄無法讀取，請查看各題組的提示。');
    expect(elements.get(`error-${exam.id}`)?.textContent).toBe(cards[3].errorText);
    expect(elements.get(`start-${exam.id}`)?.hidden).toBe(true);
    expect(elements.get(`action-${exam.id}`)?.hidden).toBe(true);
    expect([...data]).toEqual(before);
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });
  it('舊作答紀錄損壞仍顯示進度，不把指引進度誤報為 0', () => {
    data.set(OFFICIAL_ROUND_KEY, JSON.stringify({ version: 1, rounds: [round()] }));
    data.set(STORAGE_KEY, '{');
    const before = [...data];
    const cards = readOfficialIndexCards(sets);
    expect(cards[3]).toMatchObject({ progressText: '作答中・已答 2／50', errorText: '無法讀取舊作答紀錄，已保留原資料。', action: { label: '繼續作答 →' } });
    expect(cards[4]).toMatchObject({ progressText: null, errorText: '無法讀取作答進度，已保留原資料。' });
    expect([...data]).toEqual(before);
    expect(setItem).not.toHaveBeenCalled();
  });
  it('空目錄初始化只綁定按鈕，按下才寫入並導向', () => {
    const elements = directory();
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    vi.stubGlobal('crypto', { randomUUID: () => 'new-id' });
    initOfficialIndex();
    expect(setItem).not.toHaveBeenCalled();
    const button = elements.get(`start-${exam.id}`) as ButtonStub;
    expect(button.hidden).toBe(false);
    expect(button.textContent).toBe('開始作答');
    button.click();
    button.click();
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledExactlyOnceWith('/official/115-1-S3/?round=new-id');
    expect(button.disabled).toBe(true);
  });
  it('目錄內容無法解析時顯示錯誤，不寫入', () => {
    const elements = directory();
    elements.get('official-catalog')!.textContent = '{';
    initOfficialIndex();
    expect(elements.get('official-status')?.textContent).toBe('無法讀取題組目錄，請重新載入。');
    expect(setItem).not.toHaveBeenCalled();
  });
  it('容量不足時留在原卡片，保留交卷資料並恢復重新開始按鈕', () => {
    data.set(OFFICIAL_ROUND_KEY, JSON.stringify({ version: 1, rounds: [round('submitted')] }));
    const before = [...data];
    const elements = directory();
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    vi.stubGlobal('crypto', { randomUUID: () => 'new-id' });
    initOfficialIndex();
    setItem.mockImplementation(() => { throw new Error('瀏覽器容量不足。'); });
    const button = elements.get(`start-${exam.id}`) as ButtonStub;
    expect(button.textContent).toBe('重新開始');
    button.click();
    expect(assign).not.toHaveBeenCalled();
    expect(button.disabled).toBe(false);
    expect(elements.get(`error-${exam.id}`)).toMatchObject({ hidden: false, textContent: '尚未開始作答，原資料已保留。瀏覽器容量不足。' });
    expect((elements.get(`latest-${exam.id}`) as AnchorStub).href).toBe(latest(1).href);
    expect([...data]).toEqual(before);
    expect(removeItem).not.toHaveBeenCalled();
  });
});

describe('開始作答的點擊處理', () => {
  it.each([false, true])('成功導向回傳的作答，resumed=%s', (resumed) => {
    const button = { disabled: false };
    const errorElement = { hidden: false, textContent: '之前的錯誤' };
    const start = vi.fn(() => {
      expect(button.disabled).toBe(true);
      return { roundId: resumed ? 'existing/id' : 'new-id', resumed };
    });
    const assign = vi.fn();
    const click = createOfficialStartHandler(exam, button, errorElement, { start, assign });
    click();
    click();
    expect(start).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledExactlyOnceWith(`/official/${exam.id}/?round=${resumed ? 'existing%2Fid' : 'new-id'}`);
    expect(button.disabled).toBe(true);
    expect(errorElement).toEqual({ hidden: true, textContent: '' });
  });
  it.each([new Error('瀏覽器容量不足。'), new Error('輪次資料損壞。'), '儲存空間無法使用。'])('失敗不導向，顯示錯誤並恢復按鈕：%s', (error) => {
    const button = { disabled: false };
    const errorElement = { hidden: true, textContent: '' };
    const start = vi.fn<() => { roundId: string; resumed: boolean }>(() => { throw error; });
    const assign = vi.fn();
    const click = createOfficialStartHandler(exam, button, errorElement, { start, assign });
    click();
    expect(assign).not.toHaveBeenCalled();
    expect(button.disabled).toBe(false);
    expect(errorElement.hidden).toBe(false);
    const message = (error instanceof Error ? error.message : error).replace('輪次', '作答紀錄');
    expect(errorElement.textContent).toBe(`尚未開始作答，原資料已保留。${message}`);
    expect(errorElement.textContent).not.toContain('輪');
    start.mockImplementation(() => ({ roundId: 'retried', resumed: false }));
    click();
    expect(start).toHaveBeenCalledTimes(2);
    expect(assign).toHaveBeenCalledExactlyOnceWith('/official/115-1-S3/?round=retried');
    expect(button.disabled).toBe(true);
    expect(errorElement.hidden).toBe(true);
  });
});
