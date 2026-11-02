/** 以完整假教材與舊欄位驗證視圖、選項揭示與階段抽題邊界。 */
import { describe, expect, it } from 'vitest';
import { conceptLearning, optionFeedback, orderSelfChecks, stageChecks } from './textbook';
import { concept, stages, explanation } from './fixtures/textbook';
describe('教材視圖', () => {
  it('簡答夾在中間時，概念視圖仍先顯示選擇題並保留題目 ID', () => {
    const view = conceptLearning(concept);
    expect(view.summary).toBe(concept.summary); expect(view.goals).toHaveLength(1);
    expect(concept.self_check!.map((check) => check.type)).toEqual(['choice', 'short', 'choice']);
    expect(view.checks.map((check) => check.type)).toEqual(['choice', 'choice', 'short']);
    expect(view.checks.map((check) => check.id)).toEqual(['c1', 'c3', 'c2']);
  });
  it('排序不改原陣列與題目物件；同類型維持順序，重排結果不變', () => {
    const checks = concept.self_check!;
    const source = Object.freeze([checks[1], checks[0], { ...checks[1], id: 'c4' }, checks[2]]);
    const ordered = orderSelfChecks(source);
    expect(ordered.map((check) => check.id)).toEqual(['c1', 'c3', 'c2', 'c4']);
    expect(source.map((check) => check.id)).toEqual(['c2', 'c1', 'c4', 'c3']);
    expect(ordered[0]).toBe(source[1]); expect(ordered[2]).toBe(source[0]);
    expect(orderSelfChecks(ordered)).toEqual(ordered); expect(orderSelfChecks([])).toEqual([]);
  });
  it('舊教材缺欄位時省略區塊', () => { expect(conceptLearning({ id: 'old', title: '舊內容' })).toEqual({ summary: undefined, goals: [], checks: [] }); });
  it('選完才揭示每個選項的理由，非法選項不揭示', () => { const check = concept.self_check![0]; if (check.type !== 'choice') throw new Error('fixture type'); expect(optionFeedback(check)).toEqual([]); expect(optionFeedback(check, 'Z')).toEqual([]); expect(optionFeedback(check, 'A')).toEqual([{ id: 'A', correct: false, text: check.explain.A }, { id: 'B', correct: true, text: check.explain.B }, { id: 'C', correct: false, text: check.explain.C }]); });
  it('階段只取自己的概念檢核，ID 不碰撞，重複概念不重抽', () => { const result = stageChecks(['fixture-concept', 'fixture-concept', 'missing'], [concept, { ...concept, id: 'other' }]); expect(result).toHaveLength(3); expect(result.map((check) => check.id)).toEqual(['fixture-concept:c1', 'fixture-concept:c3', 'fixture-concept:c2']); expect(stageChecks(['missing'], [concept])).toEqual([]); });
  it('階段跨概念合併後仍先顯示所有選擇題，同類型維持概念與題目順序', () => {
    const result = stageChecks(['other', concept.id], [concept, { ...concept, id: 'other', title: '另一個概念' }]);
    expect(result.map((check) => check.id)).toEqual(['other:c1', 'other:c3', 'fixture-concept:c1', 'fixture-concept:c3', 'other:c2', 'fixture-concept:c2']);
    expect(result[0].conceptId).toBe('other'); expect(result[0].conceptTitle).toBe('另一個概念');
    expect(concept.self_check!.map((check) => check.id)).toEqual(['c1', 'c2', 'c3']);
  });
  it('fixture 提供階段導讀與題目判斷規則', () => { expect(stages[0].intro).toContain('資料各自的角色'); expect(explanation.rule).toContain('未參與'); });
});
