/** 未命中BFCache只算未驗證，不能把執行完畢當成完整驗收。 */
import { describe, expect, it } from 'vitest';
import { adjacent, bfcacheCompletion, paintedNodes, selectedNodeIndex } from './graph3d-smoke.mjs';
describe('畫布集合與範圍邊界', () => {
  it('圓形與例外菱形都算概念，箭頭與外圈不算節點', () => {
    expect(paintedNodes([
      { method: 'fill', color: '#367563', path: [['arc', 10, 20, 4]] },
      { method: 'fill', color: '#a36b3b', path: [['moveTo', 30, 35], ['lineTo', 35, 40], ['lineTo', 30, 45], ['lineTo', 25, 40]] },
      { method: 'fill', color: '#849389', path: [['moveTo', 10, 20], ['lineTo', 15, 15], ['lineTo', 15, 25]] },
      { method: 'stroke', color: '#286653', path: [['arc', 10, 20, 7]] },
    ])).toEqual([{ x: 10, y: 20 }, { x: 30, y: 40 }]);
  });
  it('關閉範圍外鄰接時，不能穿過被排除的中間節點', () => {
    const data = { formalEdges: [{ id: 'ab', source: 'a', target: 'b' }, { id: 'bc', source: 'b', target: 'c' }], bodyEdges: [] };
    expect(adjacent(data, 'a', 2).ids).toEqual(['a', 'b', 'c']);
    expect(adjacent(data, 'a', 2, false, new Set(['a', 'c']))).toEqual({ ids: ['a'], edges: [] });
  });
  it('只有1個高亮仍可能換了選取，必須保留相同深度序位', () => {
    const node = (color) => ({ method: 'fill', color });
    expect(selectedNodeIndex([node('#1d5543'), node('#367563')])).toBe(0);
    expect(selectedNodeIndex([node('#367563'), node('#1d5543')])).toBe(1);
    expect(selectedNodeIndex([node('#367563')])).toBe(-1);
  });
});
describe('BFCache完成門檻', () => {
  const all = () => Object.fromEntries(['bfcache', 'bfcache-pending', 'bfcache-retryExhausted'].map((name) => [name, { persisted: true }]));
  it('3個實際命中才完成', () => expect(bfcacheCompletion(all())).toEqual({ completed: true, outcome: 'passed', unverified: [] }));
  it.each(['bfcache', 'bfcache-pending', 'bfcache-retryExhausted'])('任1未命中就保留未驗證 %s', (name) => { const cases = all(); cases[name].persisted = false; const result = bfcacheCompletion(cases); expect(result.completed).toBe(false); expect(result.outcome).toBe('partial-unverified'); expect(result.unverified.map((item) => item.name)).toEqual([name]); });
});
