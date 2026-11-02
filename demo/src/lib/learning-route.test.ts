/** 保護階段契約、真實考題去重與目前版本進度，並檢查抽題不重複且不改原始題庫。 */
import { describe, expect, it } from 'vitest';
import { examFrequency, flattenStages, relatedQuestions, sampleQuestions, stageProgress, validateStages, type RouteQuestion, type Stage } from './learning-route';
import type { Attempt } from './attempts';
const stages: Stage[] = [{ id: 'first', title: '第一階段', concepts: [{ id: 'a', goal: '說得出 A' }, { id: 'b', goal: '判斷得出 B' }] }, { id: 'second', title: '第二階段', concepts: [{ id: 'c', goal: '算得出 C' }] }];
const questions: RouteQuestion[] = [
  { id: 'q1', rev: 1, source: 'exam', session: '114-2', subject: 3, concepts: ['a', 'b'] },
  { id: 'q2', rev: 2, source: 'exam', session: '115-1', subject: 1, concepts: ['b'] },
  { id: 'q3', rev: 1, source: 'exam', session: '115-1', subject: 3, concepts: ['c'] },
  { id: 'mock', rev: 1, source: 'mock', subject: 3, concepts: ['a'] },
];
describe('學習階段', () => {
  it('依階段及概念順序攤平，不依概念頁是否已建立', () => { expect(flattenStages(stages)).toEqual(['a', 'b', 'c']); expect(validateStages(['a', 'b', 'c'], stages)).toEqual([]); });
  it('順序不同、缺少、多出、重複概念都回傳警告', () => { for (const ids of [['b', 'a', 'c'], ['a', 'b'], ['a', 'b', 'c', 'd'], ['a', 'a', 'c']]) expect(validateStages(ids, stages)).toHaveLength(1); });
  it('沒有 stages 時不警告，空階段和空 concepts 可相符', () => { expect(validateStages(['a'])).toEqual([]); expect(validateStages([], [])).toEqual([]); });
  it('重複階段 ID 會回傳警告', () => { expect(validateStages(['a', 'b', 'a', 'b'], [stages[0], stages[0]])).toContain('stages 含重複的階段 ID'); });
});
describe('考試頻率與階段題庫', () => {
  it('同題跨兩概念引用仍只算一次，模擬題不加入考試頻率', () => { expect(examFrequency(questions, ['a', 'b'])).toEqual({ total: 2, groups: [{ session: '114-2', subject: 3, count: 1 }, { session: '115-1', subject: 1, count: 1 }] }); });
  it('區分同場次不同科目並按場次排列', () => { expect(examFrequency(questions, ['a', 'b', 'c']).groups).toHaveLength(3); });
  it('單一概念只算引用自己的考古題；無引用回傳零', () => { expect(examFrequency(questions, ['a']).total).toBe(1); expect(examFrequency(questions, ['missing'])).toEqual({ total: 0, groups: [] }); });
  it('階段小測驗題庫包含模擬題且依題目 ID 去重', () => { expect(relatedQuestions([...questions, questions[0]], ['a', 'b']).map((q) => q.id)).toEqual(['q1', 'q2', 'mock']); });
});
describe('作答進度與抽題', () => {
  const attempt = (overrides: Partial<Attempt> = {}): Attempt => ({ id: 'a1', qid: 'q2', rev: 2, choice: 'A', correct: false, ts: '2026-10-31T10:00:00Z', mode: 'test', ms: 100, ...overrides });
  it('只計目前版本的最新作答，同題做多次不增加已做數', () => { const attempts = [attempt(), attempt({ id: 'a2', correct: true, ts: '2026-10-31T10:01:00Z' }), attempt({ rev: 1, ts: '2026-10-31T10:02:00Z' })]; expect(stageProgress(questions, attempts)).toEqual({ attempted: 1, correct: 1, total: 4 }); });
  it('只做過舊版本不列為已做，空題庫安全回傳零', () => { expect(stageProgress(questions, [attempt({ rev: 1 })]).attempted).toBe(0); expect(stageProgress([], [])).toEqual({ attempted: 0, correct: 0, total: 0 }); });
  it('題數超過五題時只抽五題、不重複，也不修改原順序', () => { const pool = Array.from({ length: 10 }, (_, i) => i); const selected = sampleQuestions(pool, 5, () => .25); expect(selected).toHaveLength(5); expect(new Set(selected).size).toBe(5); expect(pool).toEqual(Array.from({ length: 10 }, (_, i) => i)); });
  it('少於五題時全部納入，沒有題目安全回傳空陣列', () => { expect(sampleQuestions(questions, 5)).toHaveLength(4); expect(sampleQuestions([], 5)).toEqual([]); });
});
