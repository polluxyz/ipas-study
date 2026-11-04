/** 未命中BFCache只算未驗證，不能把執行完畢當成完整驗收。 */
import { describe, expect, it } from 'vitest';
import { bfcacheCompletion } from './graph3d-smoke.mjs';
describe('BFCache完成門檻', () => {
  const all = () => Object.fromEntries(['bfcache', 'bfcache-pending', 'bfcache-retryExhausted'].map((name) => [name, { persisted: true }]));
  it('3個實際命中才完成', () => expect(bfcacheCompletion(all())).toEqual({ completed: true, outcome: 'passed', unverified: [] }));
  it.each(['bfcache', 'bfcache-pending', 'bfcache-retryExhausted'])('任1未命中就保留未驗證 %s', (name) => { const cases = all(); cases[name].persisted = false; const result = bfcacheCompletion(cases); expect(result.completed).toBe(false); expect(result.outcome).toBe('partial-unverified'); expect(result.unverified.map((item) => item.name)).toEqual([name]); });
});
