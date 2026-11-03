/** 保護條件交集、空結果與版本判定，也保留既有代碼與跨碼階段連結。 */
import { describe, expect, it } from 'vitest';
import type { Attempt } from './attempts';
import { selectQuizQuestions, serializeQuizCatalog, type QuizCatalog, type QuizQuestion } from './quiz-filter';

const catalog: QuizCatalog = {
  codes: [
    { code: 'L23303', title: '模型驗證', stages: [{ id: 'validate', title: '驗證', concepts: [{ id: 'cv', goal: '判斷驗證方法' }] }] },
    { code: 'L21101', title: '語言處理', stages: [] },
  ],
  concepts: [{ id: 'cv', title: '交叉驗證' }, { id: 'nlp', title: '語言處理' }, { id: 'unused', title: '未出題概念' }],
  questions: [
    { id: 'exam-s3', rev: 2, subject: 3, source: 'exam', codes: ['L23303'], concepts: ['cv'] },
    { id: 'guide-s3', rev: 1, subject: 3, source: 'guide', codes: ['L23303'], concepts: ['cv'] },
    { id: 'mock-s3', rev: 1, subject: 3, source: 'mock', codes: ['L23303'], concepts: ['nlp'] },
    { id: 'exam-s1', rev: 1, subject: 1, source: 'exam', codes: ['L21101'], concepts: ['cv', 'nlp'] },
  ],
};
function attempt(qid: string, overrides: Partial<Attempt> = {}): Attempt {
  return { id: 'a', qid, rev: 1, choice: 'A', correct: false, ts: '2026-11-04T00:00:00Z', mode: 'test', ms: 10, ...overrides };
}
const select = (query = '', attempts: Attempt[] = [], data = catalog) => selectQuizQuestions(data, new URLSearchParams(query), attempts, () => .3);
const ids = (questions: QuizQuestion[]) => questions.map((question) => question.id).sort();

describe('題庫目錄序列化', () => {
  it.each([
    '</script><img src=x onerror=alert(1)>',
    '</ScRiPt ><img src="x" onerror="alert(1)">',
    '引號 " 與單引號 \'、字面反斜線 \\、字面跳脫 \\u003c',
    '繁體中文與非 ASCII：é、e\u0301、😀\n下一行\r\n\u2028\u2029',
    '</script><img src="x" onerror="alert(1)">\'\\u003c\\繁體中文😀\n下一行',
  ])('概念標題 %j 安全放入 JSON script 並完整還原', (title) => {
    const data: QuizCatalog = { ...catalog, concepts: [{ id: 'edge', title }] };
    const before = JSON.stringify(data);
    const serialized = serializeQuizCatalog(data);
    expect(serialized).not.toContain('<');
    expect(serialized).not.toMatch(/<\/script/i);
    if (title.includes('<')) expect(serialized).toContain('\\u003c');
    expect(JSON.parse(serialized)).toEqual(data);
    expect(JSON.stringify(data)).toBe(before);
  });
});

describe('測驗條件', () => {
  it.each([
    ['subject=1', ['exam-s1']], ['subject=3', ['exam-s3', 'guide-s3', 'mock-s3']],
    ['code=L23303', ['exam-s3', 'guide-s3', 'mock-s3']], ['code=L21101', ['exam-s1']],
    ['concept=nlp', ['exam-s1', 'mock-s3']],
    ['source=exam', ['exam-s1', 'exam-s3']], ['source=guide', ['guide-s3']], ['source=mock', ['mock-s3']],
  ])('單獨條件 %s', (query, expected) => {
    const result = select(query); expect(result.errors).toEqual([]); expect(ids(result.pool)).toEqual(expected); expect(ids(result.selected)).toEqual(expected);
  });
  it('只練錯題為第 5 種獨立條件，排除最新答對、舊版本與未作答', () => {
    const result = select('wrong=1', [attempt('exam-s3'), attempt('guide-s3'), attempt('guide-s3', { id: 'b', correct: true, ts: '2026-11-04T01:00:00Z' }), attempt('mock-s3')]);
    expect(ids(result.pool)).toEqual(['mock-s3']);
  });
  it('5 種條件全部取交集，不會因個別條件有結果就放寬', () => {
    const attempts = catalog.questions.map((question) => attempt(question.id, { rev: question.rev }));
    expect(ids(select('subject=3&code=L23303&concept=cv&source=exam&wrong=1', attempts).pool)).toEqual(['exam-s3']);
    expect(select('subject=1&code=L23303&concept=cv&source=exam&wrong=1', attempts).selected).toEqual([]);
  });
  it('存在但無題目的概念與矛盾條件都保留空結果', () => {
    for (const query of ['concept=unused', 'subject=1&source=guide', 'code=L21101&source=mock', 'wrong=1']) {
      const result = select(query); expect(result.errors).toEqual([]); expect(result.pool).toEqual([]); expect(result.selected).toEqual([]);
    }
  });
  it('沒有條件使用已載入題庫，空值與不相關參數不改變條件', () => {
    expect(ids(select().pool)).toEqual(ids(catalog.questions));
    expect(ids(select('subject=&code=&concept=&source=&wrong=0&stage=&ref=route').pool)).toEqual(ids(catalog.questions));
  });
});

describe('最新作答與資料保護', () => {
  it('較新舊版作答不蓋過目前版本，最新答對不列錯題', () => {
    const attempts = [attempt('exam-s3', { rev: 2 }), attempt('exam-s3', { id: 'b', rev: 2, correct: true, ts: '2026-11-04T01:00:00Z' }), attempt('exam-s3', { ts: '2026-11-04T02:00:00Z' })];
    expect(select('wrong=1', attempts).pool).toEqual([]);
  });
  it('最新答錯納入，即使匯入順序不同；同時作答用 ID 排序', () => {
    const attempts = [attempt('exam-s3', { rev: 2, id: 'b' }), attempt('exam-s3', { rev: 2, correct: true, id: 'a' })];
    expect(ids(select('wrong=1', attempts).pool)).toEqual(['exam-s3']);
    expect(ids(select('wrong=1', [...attempts].reverse()).pool)).toEqual(['exam-s3']);
  });
  it('時區表示相同的時間也以 ID 排序，與原作答 API 一致', () => {
    expect(select('wrong=1', [attempt('guide-s3', { id: 'b', correct: true }), attempt('guide-s3', { ts: '2026-11-04T08:00:00+08:00' })]).pool).toEqual([]);
  });
  it('只有舊版與未收錄題目不會納入，題庫與紀錄保持原樣', () => {
    const attempts = [attempt('exam-s3'), attempt('missing')]; const before = JSON.stringify({ catalog, attempts });
    expect(select('wrong=1', attempts).pool).toEqual([]); expect(JSON.stringify({ catalog, attempts })).toBe(before);
  });
});

describe('參數與既有連結', () => {
  it.each(['subject=2', 'code=missing', 'concept=missing', 'source=external', 'source=toString', 'wrong=true', 'stage=validate', 'code=L23303&stage=missing', 'code=L21101&stage=validate', 'subject=1&subject=3', 'code=L23303&code=L21101', 'source=exam&source=guide', 'wrong=1&wrong=0', 'concept=cv&concept=nlp', 'stage=&stage=validate'])('無效參數 %s 明確回報且不出題', (query) => {
    const result = select(query); expect(result.errors.length).toBeGreaterThan(0); expect(result.selected).toEqual([]); expect(result.pool).toEqual([]);
  });
  it('code 連結限該代碼，stage 連結沿用階段概念含跨碼題', () => {
    expect(ids(select('code=L23303').pool)).toEqual(['exam-s3', 'guide-s3', 'mock-s3']);
    expect(ids(select('code=L23303&stage=validate').pool)).toEqual(['exam-s1', 'exam-s3', 'guide-s3']);
    expect(ids(select('code=L23303&stage=validate&subject=3&source=guide').pool)).toEqual(['guide-s3']);
  });
  it('一般抽最多 10 題，階段抽最多 5 題，不重複、不改題庫順序', () => {
    const data = { ...catalog, questions: Array.from({ length: 18 }, (_, index) => ({ ...catalog.questions[0], id: `q-${index}` })) };
    const before = ids(data.questions);
    for (const [query, size] of [['', 10], ['code=L23303', 10], ['code=L23303&stage=validate', 5]] as const) {
      const result = select(query, [], data); expect(result.pool).toHaveLength(18); expect(result.selected).toHaveLength(size); expect(new Set(ids(result.selected)).size).toBe(size);
    }
    expect(ids(data.questions)).toEqual(before);
  });
  it('小題庫抽全部，空題庫不回退', () => {
    expect(select('code=L23303&stage=validate').selected).toHaveLength(3);
    expect(select('', [], { ...catalog, questions: [] }).selected).toEqual([]);
  });
});
