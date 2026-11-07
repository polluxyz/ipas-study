/** 驗證第 1 版清單的相容讀寫；新題本流程見 booklet-store.test.ts。 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearStudyData, exportAttempts, getAttempts, getDailySet, getReadings, saveAttempt, saveDailySet, setConceptRead, type DailySet } from './attempts';
const set: DailySet = { date: '2026-11-05', subject: 1, questions: [{ id: 'q2', rev: 1 }, { id: 'q1', rev: 2 }] };
beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) });
});
describe('每日快取儲存', () => {
  it('同日不覆寫 ID、rev 與順序，兩科分開，隔日可建立新題組', () => {
    saveDailySet(set);
    expect(saveDailySet({ ...set, questions: [{ id: 'other', rev: 4 }] })).toEqual(set);
    saveDailySet({ ...set, subject: 3 });
    expect(getDailySet(set.date, 1)).toEqual(set); expect(getDailySet(set.date, 3)?.subject).toBe(3);
    expect(getDailySet('2026-11-06', 1)).toBeUndefined();
    saveDailySet({ ...set, date: '2026-11-06' });
    expect(getDailySet('2026-11-06', 1)?.questions).toEqual(set.questions);
  });
  it('快取不進匯出，既有作答格式與鍵不變', () => {
    saveDailySet(set);
    saveAttempt({ qid: 'q1', rev: 2, choice: 'A', correct: false, ts: '2026-11-05T00:00:00Z', mode: 'daily:2026-11-05:S1', ms: 5 });
    const backup = JSON.parse(exportAttempts());
    expect(Object.keys(backup).sort()).toEqual(['attempts', 'readings', 'version']); expect(backup.attempts).toHaveLength(1);
    expect(localStorage.getItem('ipas-attempts-v1')).toContain('daily:2026-11-05:S1');
  });
  it('清除資料同時清除作答、閱讀與快取，不碰其他網站資料', () => {
    saveDailySet(set); setConceptRead('data-leakage', true);
    saveAttempt({ qid: 'q1', rev: 2, choice: 'A', correct: false, ts: '2026-11-05T00:00:00Z', mode: 'question', ms: 5 });
    // 草稿只需存在即可驗證清除，避免空鍵讓斷言無條件通過。
    localStorage.setItem('ipas-daily-draft-v2', '{"version":2}');
    localStorage.setItem('ipas-daily-draft-v1', '{"version":1}');
    localStorage.setItem('unrelated', 'keep');
    const keys = ['ipas-daily-draft-v2', 'ipas-daily-draft-v1', 'ipas-daily-v1', 'ipas-attempts-v1', 'ipas-reading-v1'];
    for (const key of keys) expect(localStorage.getItem(key)).not.toBeNull();
    clearStudyData();
    for (const key of keys) expect(localStorage.getItem(key)).toBeNull();
    expect(getDailySet(set.date, 1)).toBeUndefined(); expect(getAttempts()).toEqual([]); expect(getReadings()).toEqual([]); expect(localStorage.getItem('unrelated')).toBe('keep');
  });
  it('拒絕重複 ID 與無效 rev，快取損壞時不暗中換題', () => {
    expect(() => saveDailySet({ ...set, questions: [{ id: 'q', rev: 0 }] })).toThrow();
    expect(() => saveDailySet({ ...set, questions: [{ id: 'q', rev: 1 }, { id: 'q', rev: 2 }] })).toThrow();
    localStorage.setItem('ipas-daily-v1', '{"version":9,"sets":[]}');
    expect(() => getDailySet(set.date, 1)).toThrow('快取格式');
  });
  it('儲存失敗明確拋錯，不把未固定題組當成成功', () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => { throw new Error('quota'); } });
    expect(() => saveDailySet(set)).toThrow('quota');
  });
});
