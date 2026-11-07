/** 每日抽題的配額、未做判斷、容量補位及快取失效均用獨立題庫驗證。 */
import { describe, expect, it } from 'vitest';
import { apportion, dailyFreeCount, dailyWeights, eligibleDailyQuestions, migrateDailySet, resolveDailySet, selectDailyQuestions, taipeiDate, type DailyExclusions, type DailyQuestion, type DailySubject, type DuplicateGroups } from './daily';
import type { Attempt } from './attempts';
const question = (id: string, overrides: Partial<DailyQuestion> = {}): DailyQuestion => ({ id, rev: 1, subject: 3, source: 'mock', codes: ['A'], type: '情境', review: { status: 'verified' }, ...overrides });
const batch = (count: number, prefix = 'q', overrides: Partial<DailyQuestion> = {}) => Array.from({ length: count }, (_, i) => question(`${prefix}${i}`, overrides));
const attempt = (qid: string, overrides: Partial<Attempt> = {}): Attempt => ({ id: qid, qid, rev: 1, choice: 'A', correct: true, ts: '2026-11-05T00:00:00Z', mode: 'quiz', ms: 1000, ...overrides });
const select = (questions: DailyQuestion[], attempts: Attempt[] = [], subject: 1 | 3 = 3) => selectDailyQuestions(questions, attempts, subject, '2026-11-05', () => .37);
const seededRandom = (seed: number) => {
  let state = seed;
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 2 ** 32; };
};

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

describe('題本不重複抽題', () => {
  const exclusions = (assignedQids: Iterable<string> = [], groups: DuplicateGroups = []): DailyExclusions => ({ assignedQids, groups });
  const draw = (questions: readonly DailyQuestion[], rules: DailyExclusions, attempts: readonly Attempt[] = [], subject: DailySubject = 3, seed = 71) =>
    selectDailyQuestions(questions, attempts, subject, '2026-11-07', seededRandom(seed), rules);

  it.each(['quiz', 'question', 'daily:2026-11-06:S3', 'booklet:old:S3', 'custom'])('任何模式 %s 的舊版本作答都排除，未做過的題保留', (mode) => {
    const pool = [question('done', { rev: 2 }), question('fresh', { rev: 2 })];
    expect(eligibleDailyQuestions(pool, [attempt('done', { mode, rev: 1 })], 3, exclusions())).toEqual([pool[1]]);
  });

  it.each([
    { status: 'open', subject: 3 },
    { status: 'submitted', subject: 3 },
    { status: 'retired', subject: 3 },
    { status: 'open', subject: 1 },
  ])('排除 $status 科目 $subject 題本的分配題，未分配的題保留', (book) => {
    // 呼叫端傳入全部題本的聯集，抽題器不依題本狀態或科目縮小範圍。
    const books = [{ ...book, assignedQids: ['assigned'] }];
    const assignedQids = new Set(books.flatMap((item) => item.assignedQids));
    const pool = [question('assigned'), question('fresh')];
    expect(eligibleDailyQuestions(pool, [], 3, exclusions(assignedQids))).toEqual([pool[1]]);
  });

  it.each(['attempt', 'assigned'])('同群組他科成員已有 %s 時排除，未佔用群組保留', (occupiedBy) => {
    const pool = [question('blocked'), question('peer', { subject: 1 }), question('free-a'), question('free-b')];
    const groups = [['blocked', 'peer'], ['free-a', 'free-b']];
    const attempts = occupiedBy === 'attempt' ? [attempt('peer', { rev: 99, mode: 'question' })] : [];
    const assignedQids = occupiedBy === 'assigned' ? new Set(['peer']) : [];
    expect(eligibleDailyQuestions(pool, attempts, 3, exclusions(assignedQids, groups)).map((q) => q.id)).toEqual(['free-a', 'free-b']);
  });

  it('已移除的群組成員仍會排除同群組題，外部無關題不影響候選', () => {
    const pool = [question('blocked'), question('fresh')];
    const rules = exclusions((function* () { yield 'removed'; yield 'unrelated'; })(), [['blocked', 'removed']]);
    expect(eligibleDailyQuestions(pool, [], 3, rules)).toEqual([pool[1]]);
  });

  it('仍限制 mock、verified、主代碼、科目與唯一題號，且保留完整物件', () => {
    const fresh = { ...question('fresh'), extra: '原物件' };
    const pool = [fresh, fresh, { ...fresh, id: 'exam', source: 'exam' }, { ...fresh, id: 'guide', source: 'guide' },
      { ...fresh, id: 'draft', review: { status: 'draft' } }, { ...fresh, id: 'disputed', review: { status: 'disputed' } },
      { ...fresh, id: 'no-code', codes: [] }, { ...fresh, id: 'other-subject', subject: 1 }];
    const result = eligibleDailyQuestions(pool, [], 3, exclusions());
    expect(result).toEqual([fresh]);
    expect(result[0]).toBe(fresh);
    expect(result[0].extra).toBe('原物件');
  });

  it('同科與跨代碼群組各算 1 題，未佔用的全部成員仍是候選', () => {
    const pool = [question('same-a'), question('same-b'), question('cross-a'), question('cross-b', { codes: ['B'] }), question('single')];
    const rules = exclusions([], [['same-a', 'same-b'], ['cross-a', 'cross-b']]);
    expect(eligibleDailyQuestions(pool, [], 3, rules)).toEqual(pool);
    expect(dailyFreeCount(pool, [], 3, rules)).toEqual({ free: 3, fullBooks: 0, lastBook: 3 });
    const result = draw(pool, rules);
    expect(result.selected).toHaveLength(3);
    expect(result.remaining).toBe(3);
    for (const group of rules.groups) expect(result.selected.filter((q) => group.includes(q.id))).toHaveLength(1);
  });

  it.each([
    { free: 0, fullBooks: 0, lastBook: 0, selected: 0 },
    { free: 49, fullBooks: 0, lastBook: 49, selected: 49 },
    { free: 50, fullBooks: 1, lastBook: 0, selected: 50 },
    { free: 51, fullBooks: 1, lastBook: 1, selected: 50 },
  ])('F=$free 的完整本數、尾本與抽題數符合規格', ({ free, fullBooks, lastBook, selected }) => {
    // 每個群組刻意放 2 題，避免把候選題數誤認為 F。
    const pool = [...batch(free, 'a'), ...batch(free, 'b', { codes: ['B'] }), question('done'), question('assigned')];
    const groups = Array.from({ length: free }, (_, i) => [`a${i}`, `b${i}`]);
    const rules = exclusions(['assigned'], groups);
    const attempts = [attempt('done')];
    expect(dailyFreeCount(pool, attempts, 3, rules)).toEqual({ free, fullBooks, lastBook });
    const result = draw(pool, rules, attempts);
    expect(result.remaining).toBe(free);
    expect(result.selected).toHaveLength(selected);
    expect(result.shortage).toBe(50 - selected);
  });

  it('跨科群組只算該科候選，另一科分配後重算為 0', () => {
    const pool = [question('s1', { subject: 1 }), question('s3')];
    const groups = [['s1', 's3']];
    expect(dailyFreeCount(pool, [], 1, exclusions([], groups))).toEqual({ free: 1, fullBooks: 0, lastBook: 1 });
    expect(dailyFreeCount(pool, [], 3, exclusions([], groups))).toEqual({ free: 1, fullBooks: 0, lastBook: 1 });
    expect(dailyFreeCount(pool, [], 3, exclusions(['s1'], groups))).toEqual({ free: 0, fullBooks: 0, lastBook: 0 });
  });

  it('只有至少 2 題候選的群組消耗代表題亂數，代表題可選任一成員', () => {
    const pool = [question('a'), question('b'), question('single'), question('draft', { review: { status: 'draft' } })];
    const groups = [['a', 'b'], ['single', 'draft'], ['absent-a', 'absent-b']];
    for (const [randomValue, chosen] of [[0, 'a'], [.99, 'b']] as const) {
      let calls = 0;
      const result = selectDailyQuestions(pool, [], 3, '2026-11-07', () => { calls++; return randomValue; }, exclusions([], groups));
      expect(result.selected.map((q) => q.id).sort()).toEqual([chosen, 'single'].sort());
      expect(calls).toBe(3);
    }
  });

  it('先縮減跨代碼群組的容量，仍抽足 50 題與 12 題程式或圖表', () => {
    const pool = [...batch(90, 'a'), ...batch(90, 'b', { codes: ['B'] }), ...batch(20, 'program', { codes: ['C'], type: '程式' }), ...batch(20, 'chart', { codes: ['D'], type: '圖表' })];
    const rules = exclusions([], Array.from({ length: 90 }, (_, i) => [`a${i}`, `b${i}`]));
    const result = draw(pool, rules);
    expect(result.remaining).toBe(130);
    expect(result.selected).toHaveLength(50);
    expect(result.selected.filter((q) => ['程式', '圖表'].includes(q.type))).toHaveLength(12);
  });

  it.each([1, 3] as const)('科目 %i 的 240 組亂數種子都抽足、不重複且排除已佔用群組', (subject) => {
    for (let seed = 1; seed <= 240; seed++) {
      const random = seededRandom(seed);
      const pool: DailyQuestion[] = [];
      const groups: string[][] = [];
      const attempts: Attempt[] = [];
      const assignedQids: string[] = [];
      const blocked = new Set<string>();
      let expectedFree = 0;
      // 直接累計可用的獨立群組，預期題數不呼叫被測函式。
      const unitCount = 20 + seed % 105;
      for (let unit = 0; unit < unitCount; unit++) {
        const ids: string[] = [];
        const memberCount = 1 + Math.floor(random() * 3);
        for (let member = 0; member < memberCount; member++) {
          const id = `${unit}-${member}`;
          ids.push(id);
          pool.push(question(id, { subject, codes: [String(Math.floor(random() * 8))], type: ['情境', '程式', '圖表'][Math.floor(random() * 3)] }));
        }
        const peer = `foreign-${unit}`;
        ids.push(peer);
        pool.push(question(peer, { subject: subject === 1 ? 3 : 1 }));
        groups.push(ids);
        if (unit % 7 === 0) attempts.push(attempt(unit % 2 ? ids[0] : peer, { rev: 99, mode: 'question' }));
        else if (unit % 5 === 0) assignedQids.push(unit % 2 ? ids[0] : peer);
        else { expectedFree++; continue; }
        for (const id of ids) blocked.add(id);
      }
      pool.push(...batch(30, 'exam', { subject, source: 'exam' }), ...batch(10, 'guide', { subject, source: 'guide' }));
      const rules = exclusions(assignedQids, groups);
      const before = JSON.stringify({ pool, attempts, rules });
      const count = dailyFreeCount(pool, attempts, subject, rules);
      expect(count.free).toBe(expectedFree);
      const result = draw(pool, rules, attempts, subject, seed);
      expect(result.remaining).toBe(expectedFree);
      expect(result.selected).toHaveLength(Math.min(50, expectedFree));
      const selectedIds = new Set(result.selected.map((q) => q.id));
      expect(selectedIds.size).toBe(result.selected.length);
      for (const group of groups) expect(group.filter((id) => selectedIds.has(id)).length).toBeLessThanOrEqual(1);
      expect(result.selected.every((q) => q.subject === subject && q.source === 'mock' && !blocked.has(q.id))).toBe(true);
      expect(JSON.stringify({ pool, attempts, rules })).toBe(before);
    }
  });

  it.each([1, 3] as const)('科目 %i 連開到用完，任 2 本不重疊', (subject) => {
    const pool = [...batch(123, 'a', { subject }), ...batch(123, 'b', { subject, codes: ['B'], type: '程式' }), ...batch(15, 'chart', { subject, type: '圖表' })];
    const assignedQids = new Set<string>();
    const rules = exclusions(assignedQids, Array.from({ length: 123 }, (_, i) => [`a${i}`, `b${i}`]));
    const books: string[][] = [];
    for (const expectedSize of [50, 50, 38]) {
      const result = draw(pool, rules, [], subject, books.length + 1);
      expect(result.selected).toHaveLength(expectedSize);
      const ids = result.selected.map((q) => q.id);
      for (const previous of books) expect(ids.some((id) => previous.includes(id))).toBe(false);
      for (const id of ids) assignedQids.add(id);
      books.push(ids);
    }
    expect(dailyFreeCount(pool, [], subject, rules)).toEqual({ free: 0, fullBooks: 0, lastBook: 0 });
    expect(draw(pool, rules, [], subject).selected).toEqual([]);
    expect(assignedQids.size).toBe(138);
  });

  it('大量排除與群組縮減後，仍用完整題庫的原配額', () => {
    const pool = [...batch(90, 'examA', { source: 'exam' }), ...batch(10, 'examB', { source: 'exam', codes: ['B'] }), ...batch(200, 'a'), ...batch(100, 'b', { codes: ['B'] }), ...batch(100, 'c', { codes: ['C'] })];
    const baseline = select(pool);
    const rules = exclusions(batch(190, 'a').map((q) => q.id), Array.from({ length: 10 }, (_, i) => [`b${i}`, `c${i}`]));
    const result = draw(pool, rules, batch(20, 'b').map((q) => attempt(q.id)));
    expect(result.quotas).toEqual({ A: 40, B: 7, C: 3 });
    expect(result.quotas).toEqual(baseline.quotas);
    expect(result.selected).toHaveLength(50);
  });

  it('群組參數為空時與省略第 6 個參數的結果及亂數呼叫數相同', () => {
    const pool = [...batch(70), ...batch(20, 'program', { codes: ['B'], type: '程式' }), ...batch(20, 'chart', { codes: ['C'], type: '圖表' })];
    const attempts = [attempt('q0')];
    const makeRandom = () => {
      const next = seededRandom(123);
      let calls = 0;
      return { next: () => { calls++; return next(); }, calls: () => calls };
    };
    const oldRandom = makeRandom();
    const newRandom = makeRandom();
    const baseline = selectDailyQuestions(pool, attempts, 3, '2026-11-07', oldRandom.next);
    const result = selectDailyQuestions(pool, attempts, 3, '2026-11-07', newRandom.next, exclusions());
    expect(result).toEqual(baseline);
    expect(newRandom.calls()).toBe(oldRandom.calls());
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
