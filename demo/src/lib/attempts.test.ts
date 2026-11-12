/** 驗證紀錄生命週期、版本辨識與部分無效的備份匯入，避免錯題本遺漏。 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../data/revisions.json', () => ({ default: { '115-1-S3-Q44': 2, '115-1-S3-Q45': 1 } }));
import { saveAttempt, saveAttemptBatch, STORAGE_KEY, getAttempts, getWrongBook, exportAttempts, importAttempts, getReadings, setConceptRead, saveDailySet, getDailySet, type Attempt } from './attempts';
function attempt(overrides: Partial<Omit<Attempt, 'id'>> = {}): Omit<Attempt, 'id'> { return { qid: '115-1-S3-Q44', rev: 2, choice: 'A', correct: false, ts: '2026-10-30T10:00:00Z', mode: 'code:L23303', ms: 1200, ...overrides }; }
beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) });
});
describe('寫入前保護損壞作答紀錄', () => {
  it.each([
    ['saveAttempt', () => saveAttempt(attempt())],
    ['importAttempts', () => importAttempts(JSON.stringify({ version: 1, attempts: [{ ...attempt(), id: 'imported' }],
      readings: [{ conceptId: 'data-leakage', ts: '2026-11-01T10:00:00Z' }] }))],
    ['saveAttemptBatch', () => saveAttemptBatch([{ ...attempt(), id: 'batch' }])],
  ] as const)('%s 遇到損壞項目時丟錯，作答與閱讀原字串不變且不寫入', (_name, save) => {
    const raw = JSON.stringify({ version: 1, attempts: [
      { ...attempt(), id: 'valid' }, { ...attempt(), id: 'damaged', ms: '10' },
    ] }, null, 2);
    const readingRaw = '{ "version": 1, "readings": [{ "conceptId": "data-leakage", "ts": "2026-10-30T10:00:00Z" }] }';
    localStorage.setItem(STORAGE_KEY, raw); localStorage.setItem('ipas-reading-v1', readingRaw);
    const setItem = vi.spyOn(localStorage, 'setItem');
    expect(save).toThrow('作答紀錄有損壞項目，已保留原資料並停止寫入。');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    expect(localStorage.getItem('ipas-reading-v1')).toBe(readingRaw);
    expect(setItem).not.toHaveBeenCalled();
  });
  it('唯讀查詢與匯出仍略過損壞項目，原字串不變', () => {
    const valid = { ...attempt(), id: 'valid' };
    const raw = JSON.stringify({ version: 1, attempts: [valid, { ...valid, id: 'damaged', ms: '10' }] }, null, 2);
    localStorage.setItem(STORAGE_KEY, raw); const setItem = vi.spyOn(localStorage, 'setItem');
    expect(getAttempts()).toEqual([valid]);
    expect(getWrongBook()).toEqual([{ qid: valid.qid, lastAttempt: valid, outdated: false }]);
    expect(JSON.parse(exportAttempts()).attempts).toEqual([valid]);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw); expect(setItem).not.toHaveBeenCalled();
  });
  it('合法紀錄可整批新增，保留既有紀錄且重試不重複', () => {
    const existing = saveAttempt(attempt()); const next = { ...attempt({ correct: true }), id: 'batch' };
    saveAttemptBatch([next]); expect(getAttempts()).toEqual([existing, next]);
    saveAttemptBatch([next]); expect(getAttempts()).toEqual([existing, next]);
  });
});
describe('閱讀紀錄與備份相容性', () => {
  it('標記與取消已讀，同一概念不產生重複紀錄', () => { setConceptRead('data-leakage', true); setConceptRead('data-leakage', true); expect(getReadings()).toHaveLength(1); setConceptRead('data-leakage', false); expect(getReadings()).toEqual([]); });
  it('作答與閱讀一起匯出，清空後能完整還原且再次匯入去重', () => {
    saveAttempt(attempt()); setConceptRead('data-leakage', true); const json = exportAttempts(); const original = JSON.parse(json);
    localStorage.setItem('ipas-attempts-v1', '{"version":1,"attempts":[]}'); localStorage.setItem('ipas-reading-v1', '{"version":1,"readings":[]}');
    expect(importAttempts(json)).toEqual({ added: 2, skipped: 0, invalid: 0 }); expect(JSON.parse(exportAttempts())).toEqual(original);
    expect(importAttempts(json)).toEqual({ added: 0, skipped: 2, invalid: 0 });
  });
  it('舊格式沒有閱讀欄位仍可匯入，現有閱讀紀錄保留', () => { setConceptRead('data-leakage', true); expect(importAttempts(JSON.stringify({ version: 1, attempts: [{ ...attempt(), id: 'old' }] }))).toEqual({ added: 1, skipped: 0, invalid: 0 }); expect(getReadings()).toHaveLength(1); });
  it('逐筆驗證閱讀欄位，無效紀錄不影響其餘紀錄', () => { expect(importAttempts(JSON.stringify({ version: 1, attempts: [], readings: [{ conceptId: 'data-leakage', ts: '2026-10-31T10:00:00Z' }, { conceptId: '', ts: 'wrong' }, null] }))).toEqual({ added: 1, skipped: 0, invalid: 2 }); expect(getReadings()).toHaveLength(1); });
  it('新閱讀時間覆蓋舊時間，較舊或重複閱讀匯入略過', () => {
    const backup = (ts: string) => JSON.stringify({ version: 1, attempts: [], readings: [{ conceptId: 'data-leakage', ts }] });
    expect(importAttempts(backup('2026-10-30T10:00:00Z')).added).toBe(1); expect(importAttempts(backup('2026-10-31T10:00:00Z')).added).toBe(1); expect(importAttempts(backup('2026-10-30T10:00:00Z')).skipped).toBe(1);
    expect(getReadings()[0].ts).toBe('2026-10-31T10:00:00Z');
  });
  it('閱讀欄位非陣列計為無效且不丟棄有效作答', () => { expect(importAttempts(JSON.stringify({ version: 1, attempts: [{ ...attempt(), id: 'valid' }], readings: {} }))).toEqual({ added: 1, skipped: 0, invalid: 1 }); });
  it('閱讀存取失敗明確拋錯，不把錯誤當成已讀', () => { vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => { throw new Error('quota'); } }); expect(() => setConceptRead('data-leakage', true)).toThrow('quota'); });
});
describe('作答紀錄與錯題本', () => {
  it('每日快取預設不覆寫，明確換題才更新同科並保留另一科', () => {
    const set = { date: '2026-11-05', subject: 1 as const, questions: [{ id: 'exam', rev: 1 }] };
    const migrated = { ...set, questions: [{ id: 'mock', rev: 2 }] };
    saveDailySet(set); saveDailySet({ ...set, subject: 3 });
    expect(saveDailySet(migrated)).toEqual(set);
    expect(saveDailySet(migrated, true)).toEqual(migrated);
    expect(getDailySet(set.date, 1)).toEqual(migrated);
    expect(getDailySet(set.date, 3)?.questions).toEqual(set.questions);
    expect(JSON.parse(exportAttempts()).attempts).toEqual([]);
  });
  it.each([
    '{ "version": 99, "attempts": [], "unknown": "保留原資料" }',
    '{ "version": 1, "attempts": {} }',
    '{ "version": 1 }',
  ])('無法辨識格式時如實告知不能匯出，讀取與匯出都保留原位元組：%s', (raw) => {
    localStorage.setItem('ipas-attempts-v1', raw);
    const message = '作答紀錄格式無法辨識，目前無法匯出備份。';
    expect(() => getAttempts()).toThrow(message);
    expect(localStorage.getItem('ipas-attempts-v1')).toBe(raw);
    expect(() => exportAttempts()).toThrow(message);
    expect(localStorage.getItem('ipas-attempts-v1')).toBe(raw);
  });
  it('答錯收錄，最近一次目前版本答對後移出，支援依題號讀取', () => {
    const a = saveAttempt(attempt()); expect(a.id).toBeTruthy(); expect(getWrongBook()).toHaveLength(1);
    saveAttempt(attempt({ correct: true, choice: 'B', ts: '2026-10-30T10:01:00Z' }));
    expect(getWrongBook()).toEqual([]); expect(getAttempts({ qid: a.qid })).toHaveLength(2); expect(getAttempts({ qid: 'missing' })).toEqual([]);
  });
  it('只有舊版本紀錄時標示已更新，不判定對錯', () => {
    saveAttempt(attempt({ rev: 1, correct: true })); expect(getWrongBook()[0].outdated).toBe(true);
  });
  it('較新的舊版紀錄不蓋過目前版本的作答', () => {
    saveAttempt(attempt({ correct: true })); saveAttempt(attempt({ rev: 1, ts: '2026-10-30T10:03:00Z' })); expect(getWrongBook()).toEqual([]);
  });
  it('匯出再匯入可以恢復錯題，重複匯入按 ID 去重', () => {
    saveAttempt(attempt()); const json = exportAttempts(); localStorage.setItem('ipas-attempts-v1', '{"version":1,"attempts":[]}');
    expect(importAttempts(json)).toEqual({ added: 1, skipped: 0, invalid: 0 }); expect(getWrongBook()).toHaveLength(1);
    expect(importAttempts(json)).toEqual({ added: 0, skipped: 1, invalid: 0 });
  });
  it('同一批匯入的重複 ID 與錯誤欄位各自計數，不丟棄有效紀錄', () => {
    const valid = { ...attempt(), id: 'backup-1' };
    expect(importAttempts(JSON.stringify({ version: 1, attempts: [valid, valid, { ...valid, id: 'bad', rev: 0 }, null] }))).toEqual({ added: 1, skipped: 1, invalid: 2 });
    expect(getAttempts()).toHaveLength(1);
  });
  it('未知版本、錯誤 JSON 與非有限數字不會污染現有紀錄', () => {
    expect(importAttempts('{')).toEqual({ added: 0, skipped: 0, invalid: 1 });
    expect(importAttempts(JSON.stringify({ version: 8, attempts: [{}, {}] })).invalid).toBe(2);
    expect(importAttempts(JSON.stringify({ version: 1, attempts: [{ ...attempt(), id: 'bad', ms: -1 }] })).invalid).toBe(1); expect(getAttempts()).toEqual([]);
  });
  it('儲存失敗明確拋錯，避免把未保存紀錄當成成功', () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => { throw new Error('quota'); } });
    expect(() => saveAttempt(attempt())).toThrow('quota');
  });
});
