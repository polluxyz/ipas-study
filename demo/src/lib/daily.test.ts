/** 每日抽題的配額、未做判斷、容量補位及快取失效均用獨立題庫驗證。 */
import { describe, expect, it } from 'vitest';
import { apportion, dailyWeights, migrateDailySet, resolveDailySet, selectDailyQuestions, taipeiDate, type DailyQuestion } from './daily';
import type { Attempt } from './attempts';
const question = (id: string, overrides: Partial<DailyQuestion> = {}): DailyQuestion => ({ id, rev: 1, subject: 3, source: 'mock', codes: ['A'], type: '情境', review: { status: 'verified' }, ...overrides });
const batch = (count: number, prefix = 'q', overrides: Partial<DailyQuestion> = {}) => Array.from({ length: count }, (_, i) => question(`${prefix}${i}`, overrides));
const attempt = (qid: string, overrides: Partial<Attempt> = {}): Attempt => ({ id: qid, qid, rev: 1, choice: 'A', correct: true, ts: '2026-11-05T00:00:00Z', mode: 'quiz', ms: 1000, ...overrides });
const select = (questions: DailyQuestion[], attempts: Attempt[] = [], subject: 1 | 3 = 3) => selectDailyQuestions(questions, attempts, subject, '2026-11-05', () => .37);

describe('每日抽題', () => {
  it('80% 考古比例、20% 全部代碼平均，最大餘數配額合計 50', () => {
    const pool = [...batch(3, 'examA', { source: 'exam', codes: ['A', 'B'] }), ...batch(1, 'examB', { source: 'exam', codes: ['B'] }), ...batch(100, 'mockC', { codes: ['C'] })];
    const weights = dailyWeights(pool, 3);
    expect(weights.A).toBeCloseTo(.8 * .75 + .2 / 3);
    expect(weights.B).toBeCloseTo(.8 * .25 + .2 / 3);
    expect(weights.C).toBeCloseTo(.2 / 3);
    expect(apportion(weights, 50)).toEqual({ A: 34, B: 13, C: 3 });
    expect(Object.values(apportion(weights, 50)).reduce((a, b) => a + b, 0)).toBe(50);
  });
  it('只抽 verified、同科、不重複 ID，排除任何模式與 rev 做過的題', () => {
    const pool = [...batch(80), question('q0'), question('draft', { review: { status: 'draft' } }), question('disputed', { review: { status: 'disputed' } }), question('s1', { subject: 1 })];
    const result = select(pool, [attempt('q1', { rev: 9, mode: 'question' }), attempt('q2', { mode: 'daily:old:S3' })]);
    expect(result.selected).toHaveLength(50); expect(new Set(result.selected.map((q) => q.id)).size).toBe(50);
    expect(result.selected.every((q) => q.review.status === 'verified' && q.subject === 3 && !['q1', 'q2'].includes(q.id))).toBe(true);
  });
  it('某代碼不足時，其餘代碼按權重補足，容量充足時配額不變', () => {
    const pool = [...batch(90, 'a', { source: 'exam' }), ...batch(10, 'b', { source: 'exam', codes: ['B'] }), ...batch(100, 'aMock'), ...batch(100, 'bMock', { codes: ['B'] }), ...batch(100, 'c', { codes: ['C'] })];
    const normal = select(pool, [], 3);
    const actual = Object.fromEntries(['A', 'B', 'C'].map((code) => [code, normal.selected.filter((q) => q.codes[0] === code).length]));
    expect(actual).toEqual(normal.quotas);
    const result = select(pool, pool.filter((q) => q.codes[0] === 'A').map((q) => attempt(q.id)));
    expect(result.selected).toHaveLength(50); expect(result.selected.every((q) => q.codes[0] !== 'A')).toBe(true);
    expect(result.selected.filter((q) => q.codes[0] === 'B').length).toBeGreaterThan(result.selected.filter((q) => q.codes[0] === 'C').length);
  });
  it('未做不足回報實際題數與缺額，不補做過的題目', () => {
    const result = select(batch(12), [attempt('q0')]);
    expect(result.selected).toHaveLength(11); expect(result.shortage).toBe(39); expect(result.remaining).toBe(11);
    expect(select([]).shortage).toBe(50);
  });
  it('科 3 程式與圖表合計 12 題，必要時跨代碼補足', () => {
    const pool = [...batch(100, 'exam', { source: 'exam' }), ...batch(100, 'normal'), ...batch(30, 'program', { codes: ['B'], type: '程式' }), ...batch(30, 'chart', { codes: ['C'], type: '圖表' })];
    const result = select(pool);
    expect(result.selected).toHaveLength(50);
    expect(result.selected.filter((q) => ['程式', '圖表'].includes(q.type))).toHaveLength(12);
  });
  it('科 3 題庫不足時使用現有程式題，不犧牲題組大小', () => {
    expect(select([...batch(70), ...batch(7, 'program', { type: '程式' })]).selected.filter((q) => q.type === '程式')).toHaveLength(7);
    expect(select(batch(70, 'program', { type: '程式' })).selected).toHaveLength(50);
  });
  it('混合題庫只抽非官方題，剩餘題數也只算非官方題', () => {
    const result = select([...batch(60, 'exam', { source: 'exam', subject: 1 }), ...batch(60, 'guide', { source: 'guide', subject: 1 }), ...batch(100, 'mock', { subject: 1 })], [], 1);
    expect(['exam', 'guide', 'mock'].map((source) => result.selected.filter((q) => q.source === source).length)).toEqual([0, 0, 50]);
    expect(result.remaining).toBe(100);
    expect(select(batch(70, 'mock', { subject: 1 }), [], 1).selected).toHaveLength(50);
  });
  it('台北 00:00 換日，不受瀏覽器時區影響', () => {
    expect(taipeiDate(new Date('2026-11-05T15:59:59Z'))).toBe('2026-11-05');
    expect(taipeiDate(new Date('2026-11-05T16:00:00Z'))).toBe('2026-11-06');
  });
  it('200 種代碼容量組合均抽足，程式題容量足夠時固定 12 題', () => {
    let state = 71;
    const random = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 2 ** 32; };
    for (let iteration = 0; iteration < 200; iteration++) {
      const pool = Array.from({ length: 8 }, (_, code) => [
        ...batch(Math.floor(random() * 20), `${code}-normal-`, { codes: [String(code)], source: 'mock' }),
        ...batch(Math.floor(random() * 8), `${code}-program-`, { codes: [String(code)], type: '程式' }),
      ]).flat();
      const before = JSON.stringify(pool);
      const result = selectDailyQuestions(pool, [], 3, '2026-11-05', random);
      expect(result.selected).toHaveLength(Math.min(50, pool.length));
      if (pool.filter((q) => q.type === '程式').length >= 12 && pool.filter((q) => q.type !== '程式').length >= 38) expect(result.selected.filter((q) => q.type === '程式')).toHaveLength(12);
      expect(JSON.stringify(pool)).toBe(before);
    }
  });
  it('快取順序固定，移除、失去 verified 或改版只略過，不補題', () => {
    const set = { date: '2026-11-05', subject: 3 as const, questions: ['q3', 'q0', 'q1', 'q2'].map((id) => ({ id, rev: 1 })) };
    const result = resolveDailySet(set, [question('q0'), question('q1', { review: { status: 'disputed' } }), question('q2', { rev: 2 }), question('new'), question('exam', { source: 'exam' })]);
    expect(result.selected.map((q) => q.id)).toEqual(['q0']); expect(result.skipped).toEqual(['q3', 'q1', 'q2']); expect(result.shortage).toBe(49);
  });
});

describe('舊每日快取換題', () => {
  const setOf = (...ids: string[]) => ({ date: '2026-11-05', subject: 3 as const, questions: ids.map((id) => ({ id, rev: 1 })) });
  it('優先同代碼，其他題目與順序不變，輸入不變', () => {
    const set = setOf('keep', 'exam', 'last');
    const catalog = [question('exam', { source: 'exam' }), question('same'), question('other', { codes: ['B'] }), question('keep'), question('last')];
    const before = JSON.stringify({ set, catalog });
    const result = migrateDailySet(set, catalog, [], () => .9);
    expect(result.set.questions.map((q) => q.id)).toEqual(['keep', 'same', 'last']);
    expect(result.replaced).toBe(1); expect(result.removed).toBe(0);
    expect(JSON.stringify({ set, catalog })).toBe(before);
  });
  it('科目 3 被換掉的程式或圖表題優先保持題型', () => {
    for (const type of ['程式', '圖表']) {
      const result = migrateDailySet(setOf('exam'), [question('exam', { source: 'exam', type }), question('normal'), question('program', { type: '程式' })], [], () => 0);
      expect(result.set.questions[0].id).toBe('program');
    }
  });
  it('同代碼耗盡時選有候選且權重最高的代碼，不重複題目', () => {
    const catalog = [question('exam', { source: 'exam', codes: ['X'] }), ...batch(9, 'weight', { source: 'exam', codes: ['B'] }), question('guide', { source: 'guide' }), question('b', { codes: ['B'] }), question('c', { codes: ['C'] })];
    const result = migrateDailySet(setOf('exam', 'guide'), catalog, [], () => 0);
    expect(result.set.questions.map((q) => q.id)).toEqual(['b', 'c']);
  });
  it('排除已做、題組內與未 verified 的候選，候選不足移除', () => {
    const catalog = [question('exam', { source: 'exam' }), question('guide', { source: 'guide' }), question('done'), question('keep'), question('draft', { review: { status: 'draft' } }), question('disputed', { review: { status: 'disputed' } }), question('new', { rev: 2 })];
    const result = migrateDailySet(setOf('exam', 'keep', 'guide'), catalog, [attempt('done', { rev: 99 })], () => 0);
    expect(result.set.questions).toEqual([{ id: 'new', rev: 2 }, { id: 'keep', rev: 1 }]);
    expect(result.replaced).toBe(2); expect(result.removed).toBe(1);
  });
  it('無官方題時保留原快取，失效題仍交由略過機制處理', () => {
    const set = setOf('keep', 'missing');
    const result = migrateDailySet(set, [question('keep')], [], () => { throw new Error('不應抽題'); });
    expect(result.set).toBe(set); expect(result.replaced).toBe(0);
  });
  it('解析快取時防止官方題進入每日題組', () => {
    expect(resolveDailySet(setOf('exam', 'guide', 'keep'), [question('exam', { source: 'exam' }), question('guide', { source: 'guide' }), question('keep')]).skipped).toEqual(['exam', 'guide']);
  });
});
