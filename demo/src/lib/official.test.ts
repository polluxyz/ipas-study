/** 用獨立題庫驗證完整分組、數值排序與同模式最新作答計分。 */
import { describe, expect, it } from 'vitest';
import { compareOfficialQuestions, officialMode, officialProgress, officialSets, type OfficialQuestion } from './official';
import type { Attempt } from './attempts';
const question = (id: string, overrides: Partial<OfficialQuestion> = {}) => ({ id, source: 'exam', session: '115-1', subject: 3, ...overrides });
const attempt = (id: string, overrides: Partial<Attempt> = {}): Attempt => ({ id, qid: '115-1-S3-Q2', rev: 1, choice: 'A', correct: true, ts: '2026-11-05T00:00:00Z', mode: 'official:115-1:S3', ms: 1000, ...overrides });
describe('官方題完整練習', () => {
  it('產生固定 6 份題組，按來源、場次與科目取得全部題目，包含爭議題', () => {
    const disputed = { ...question('115-1-S3-Q2'), review: { status: 'disputed' } };
    const pool = [disputed, question('114-2-S1-Q1', { session: '114-2', subject: 1 }), question('mock', { source: 'mock' }), question('G1e1-3-84-Q01', { source: 'guide', session: undefined, subject: 1 })];
    const sets = officialSets(pool);
    expect(sets.map((s) => s.id)).toEqual(['114-2-S1', '114-2-S3', '115-1-S1', '115-1-S3', 'guide-S1', 'guide-S3']);
    expect(sets.map((s) => s.questions.length)).toEqual([1, 0, 0, 1, 1, 0]);
    expect(sets[3].questions).toEqual([disputed]); expect(pool[0]).toBe(disputed);
  });
  it('考古題按原題號數值排序，缺 number 時讀 ID 題號', () => {
    const pool = [question('115-1-S3-Q39'), question('115-1-S3-Q10'), question('115-1-S3-Q2')];
    expect([...pool].sort(compareOfficialQuestions).map((q) => q.id)).toEqual(['115-1-S3-Q2', '115-1-S3-Q10', '115-1-S3-Q39']);
    expect([question('a', { number: 10 }), question('b', { number: 2 })].sort(compareOfficialQuestions)[0].id).toBe('b');
  });
  it('指引按章節、頁碼、題號的數值排序', () => {
    const ids = ['G3e1-10-2-Q01', 'G3e1-3-100-Q01', 'G3e1-3-28-Q10', 'G3e1-3-28-Q2', 'G3e1-4-1-Q01'];
    const pool = ids.map((id) => question(id, { source: 'guide', session: undefined }));
    expect(officialSets(pool)[5].questions.map((q) => q.id)).toEqual([ids[3], ids[2], ids[1], ids[4], ids[0]]);
  });
  it('考古題與指引的 mode 字串各自獨立', () => {
    expect(officialMode('115-1', 3)).toBe('official:115-1:S3');
    expect(officialMode('guide', 1)).toBe('official:guide:S1');
  });
  it('只看同 mode 每題最新紀錄，排除外題與其他模式，答對數乘 2', () => {
    const pool = [question('115-1-S3-Q2'), question('115-1-S3-Q10')];
    const records = [attempt('b', { correct: false }), attempt('a'), attempt('c', { ts: '2026-11-05T01:00:00Z' }), attempt('other-mode', { qid: pool[1].id, mode: 'quiz' }), attempt('outside', { qid: 'outside' })];
    const result = officialProgress(pool, records, officialMode('115-1', 3));
    expect(result.done).toBe(1); expect(result.correct).toBe(1); expect(result.score).toBe(2); expect(result.elapsed).toBe(3000);
    expect(result.answered.get(pool[0].id)?.id).toBe('c');
    expect(officialProgress(pool, records.slice(0, 2), officialMode('115-1', 3)).correct).toBe(0);
    expect(officialProgress(pool, [], officialMode('guide', 3))).toMatchObject({ done: 0, correct: 0, score: 0, elapsed: 0, total: 2 });
  });
});
