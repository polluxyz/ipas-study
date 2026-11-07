/** 以小題庫驗證比對邊界，再掃描兩科真實可抽題，防止漏列同題候選。 */
import { readdirSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import {
  findSimilarPairs,
  normalizeStem,
  parseQuestionDuplicates,
  stemBigrams,
  stemSimilarity,
  uncoveredPairs,
  type QuestionDuplicates,
} from './question-duplicates';
import { loadQuestionDuplicates } from './question-duplicates-load';

const empty: QuestionDuplicates = { groups: [], distinct: [] };

describe('同題資料格式', () => {
  it('接受空清單與有效群組，保留人工區分理由', () => {
    expect(parseQuestionDuplicates({ version: 1, ...empty })).toEqual(empty);
    const data = {
      groups: [{ ids: ['甲', '乙', '丙'], note: '同一判斷' }],
      distinct: [{ ids: ['甲', '丁'], reason: '否定詞不同，判斷相反' }],
    };
    expect(parseQuestionDuplicates({ version: 1, ...data })).toEqual(data);
  });

  it.each([
    ['非物件', null],
    ['缺版本', { ...empty }],
    ['未知版本', { version: 2, ...empty }],
    ['字串版本', { version: '1', ...empty }],
    ['缺群組', { version: 1, distinct: [] }],
    ['缺區分清單', { version: 1, groups: [] }],
    ['無效群組', { version: 1, groups: [null], distinct: [] }],
    ['群組不足 2 題', { version: 1, groups: [{ ids: ['甲'], note: '同題' }], distinct: [] }],
    ['群組內 ID 重複', { version: 1, groups: [{ ids: ['甲', '甲'], note: '同題' }], distinct: [] }],
    ['跨組 ID 重複', { version: 1, groups: [{ ids: ['甲', '乙'], note: '同題' }, { ids: ['乙', '丙'], note: '同題' }], distinct: [] }],
    ['空白 ID', { version: 1, groups: [{ ids: ['甲', ' '], note: '同題' }], distinct: [] }],
    ['非字串 ID', { version: 1, groups: [{ ids: ['甲', 1], note: '同題' }], distinct: [] }],
    ['缺群組說明', { version: 1, groups: [{ ids: ['甲', '乙'] }], distinct: [] }],
    ['缺區分理由', { version: 1, groups: [], distinct: [{ ids: ['甲', '乙'] }] }],
    ['空白區分理由', { version: 1, groups: [], distinct: [{ ids: ['甲', '乙'], reason: ' ' }] }],
    ['區分配對不足 2 題', { version: 1, groups: [], distinct: [{ ids: ['甲'], reason: '不同題' }] }],
    ['區分配對超過 2 題', { version: 1, groups: [], distinct: [{ ids: ['甲', '乙', '丙'], reason: '不同題' }] }],
    ['區分配對同一 ID', { version: 1, groups: [], distinct: [{ ids: ['甲', '甲'], reason: '不同題' }] }],
  ])('拒絕%s', (_label, value) => {
    expect(() => parseQuestionDuplicates(value)).toThrow();
  });
});

describe('題幹相似度', () => {
  it('去掉 Unicode 空白、標點與符號，英文轉小寫', () => {
    expect(normalizeStem('ＡB C，。\u00a0\u3000D\t\n+＄😀')).toBe('ａbcd');
    expect(findSimilarPairs([{ id: '甲', stem: 'AB， CD。' }, { id: '乙', stem: 'a b\nc+d' }]))
      .toEqual([{ ids: ['甲', '乙'], score: 1 }]);
  });

  it('以 code point 切字，重複字組只算 1 次', () => {
    expect([...stemBigrams('𠀀甲𠀁')]).toEqual(['𠀀甲', '甲𠀁']);
    expect([...stemBigrams('abababab')]).toEqual(['ab', 'ba']);
    expect(stemSimilarity('abababab', 'abac')).toBe(2 / 3);
    expect(findSimilarPairs([{ id: '甲', stem: 'abababab' }, { id: '乙', stem: 'abac' }])).toEqual([]);
  });

  it('0.75 剛好達標，0.74 不達標，分數不四捨五入', () => {
    // 每字都不同，使 101 字恰有 100 組，能直接驗證百分之一的門檻差異。
    const full = Array.from({ length: 101 }, (_, index) => String.fromCodePoint(0x4e00 + index)).join('');
    expect(stemSimilarity(full, full.slice(0, 76))).toBe(0.75);
    expect(stemSimilarity(full, full.slice(0, 75))).toBe(0.74);
    expect(stemSimilarity('abcdefg', 'abcdef')).toBe(5 / 6);
    expect(findSimilarPairs([{ id: '完整', stem: full }, { id: '達標', stem: full.slice(0, 76) }]))
      .toEqual([{ ids: ['完整', '達標'], score: 0.75 }]);
    expect(findSimilarPairs([{ id: '完整', stem: full }, { id: '未達標', stem: full.slice(0, 75) }])).toEqual([]);
  });

  it('每對只出現 1 次，不與自己配對，也不修改輸入', () => {
    const items = Object.freeze([
      { id: '甲', stem: 'abcd' }, { id: '乙', stem: 'abcd' }, { id: '丙', stem: 'abcd' }, { id: '甲', stem: 'abcd' },
    ]);
    expect(findSimilarPairs(items)).toEqual([
      { ids: ['甲', '乙'], score: 1 }, { ids: ['甲', '丙'], score: 1 }, { ids: ['乙', '丙'], score: 1 },
    ]);
    expect(items).toHaveLength(4);
  });

  it('空題庫、單題與無字組的題幹不產生候選', () => {
    expect(findSimilarPairs([])).toEqual([]);
    expect(findSimilarPairs([{ id: '甲', stem: 'abcd' }])).toEqual([]);
    expect(stemBigrams('甲')).toEqual(new Set());
    expect(stemSimilarity('', '')).toBe(0);
    expect(stemSimilarity('。', '甲')).toBe(0);
  });
});

describe('未覆蓋配對', () => {
  const pairs: { ids: [string, string] }[] = [
    { ids: ['甲', '丙'] }, { ids: ['乙', '甲'] }, { ids: ['丁', '甲'] }, { ids: ['丙', '戊'] }, { ids: ['丁', '戊'] },
  ];
  const data: QuestionDuplicates = {
    groups: [{ ids: ['甲', '乙', '丙'], note: '同題' }, { ids: ['丁', '己'], note: '另一群組' }],
    distinct: [{ ids: ['甲', '丁'], reason: '考點不同' }],
  };

  it('空內容檔會留下全部配對，空候選清單不報錯', () => {
    expect(uncoveredPairs(pairs, empty)).toEqual(pairs);
    expect(uncoveredPairs([], data)).toEqual([]);
  });

  it('同組的任意成員與反向 distinct 配對都算已覆蓋', () => {
    expect(uncoveredPairs(pairs, data)).toEqual([{ ids: ['丙', '戊'] }, { ids: ['丁', '戊'] }]);
    expect(pairs).toHaveLength(5);
  });

  it('跨組配對仍會失敗，移除群組後原配對會重新出現', () => {
    expect(uncoveredPairs([{ ids: ['甲', '己'] }], data)).toEqual([{ ids: ['甲', '己'] }]);
    expect(uncoveredPairs([{ ids: ['乙', '甲'] }], { ...data, groups: [] })).toEqual([{ ids: ['乙', '甲'] }]);
  });
});

type Question = { id: string; stem: string; subject: number };

function readEligibleQuestions(): Question[] {
  const questions: Question[] = [];
  function visit(folder: URL): void {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const path = new URL(encodeURIComponent(entry.name) + (entry.isDirectory() ? '/' : ''), folder);
      if (entry.isDirectory()) {
        visit(path);
      } else if (entry.name.endsWith('.yaml')) {
        const value: unknown = parse(readFileSync(path, 'utf8'));
        if (typeof value !== 'object' || value === null) throw new Error(`題目格式錯誤：${path.href}`);
        const question = value as Record<string, unknown>;
        const review = question.review;
        if (question.source !== 'mock' || typeof review !== 'object' || review === null
          || !('status' in review) || review.status !== 'verified'
          || !Array.isArray(question.codes) || typeof question.codes[0] !== 'string' || !question.codes[0]) continue;
        if (typeof question.id !== 'string' || typeof question.stem !== 'string' || typeof question.subject !== 'number') {
          throw new Error(`可抽題缺少 id、stem 或 subject：${path.href}`);
        }
        questions.push({ id: question.id, stem: question.stem, subject: question.subject });
      }
    }
  }
  visit(new URL('../../../content/questions/', import.meta.url));
  return questions;
}

describe('真實同題內容與兩科題庫', () => {
  let questions: Question[];
  let data: QuestionDuplicates;
  let pairs: ReturnType<typeof findSimilarPairs>;
  beforeAll(() => {
    questions = readEligibleQuestions();
    data = loadQuestionDuplicates();
    pairs = findSimilarPairs(questions);
  });

  it('全部可抽題的候選配對都有人工判定', () => {
    expect(questions.some((question) => question.subject === 1)).toBe(true);
    expect(questions.some((question) => question.subject === 3)).toBe(true);
    const missing = uncoveredPairs(pairs, data);
    const diagnostics = missing.map(({ ids }) => {
      const score = pairs.find((pair) => pair.ids[0] === ids[0] && pair.ids[1] === ids[1])?.score;
      return `${ids.join(' / ')}：${score}`;
    });
    console.info(`同題掃描：${questions.length} 題；${pairs.length} 對達 0.75\n${pairs.map((pair) => `${pair.ids.join(' / ')}：${pair.score}`).join('\n')}`);
    expect(missing, `未覆蓋候選配對（ID / ID：分數）\n${diagnostics.join('\n')}`).toEqual([]);
  });

  it('內容檔恰有規格的 4 組，每個 ID 都存在且可抽', () => {
    const eligibleIds = new Set(questions.map((question) => question.id));
    const expected = [
      ['Z-L21203-006', 'Z-L23402-001'], ['Z-L21301-002', 'Z-L23301-003'],
      ['Z-L21302-005', 'Z-L23401-003'], ['Z-L21301-004', 'Z-L23302-001'],
    ].map((ids) => [...ids].sort());
    expect(data.groups).toHaveLength(4);
    expect(data.groups.map((group) => [...group.ids].sort())).toEqual(expect.arrayContaining(expected));
    for (const item of [...data.groups, ...data.distinct]) {
      for (const id of item.ids) expect(eligibleIds.has(id), `${id} 不存在或不可抽`).toBe(true);
    }
  });

  it('人工區分清單的每對分數仍達 0.75，沒有過期條目', () => {
    const byId = new Map(questions.map((question) => [question.id, question]));
    for (const { ids } of data.distinct) {
      const a = byId.get(ids[0]);
      const b = byId.get(ids[1]);
      if (!a || !b) throw new Error(`distinct ID 不存在或不可抽：${ids.join(' / ')}`);
      expect(stemSimilarity(a.stem, b.stem), `distinct 過期：${ids.join(' / ')}`).toBeGreaterThanOrEqual(0.75);
    }
  });
});
