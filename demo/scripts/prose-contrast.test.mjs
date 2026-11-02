/** 以透明祖先、半透明前景及舊版低對比案例驗證量測門檻。 */
import { describe, expect, it } from 'vitest';
import { assertProseContrast, contrastOf } from './prose-contrast.mjs';
const good = (kind) => ({ kind, text: '可讀', foreground: 'rgb(37, 61, 55)', layers: ['rgba(0, 0, 0, 0)', 'rgb(255, 254, 250)'], opacity: 1 });
const kinds = ['prose', 'tables', 'figureHeaders', 'code'];
describe('概念頁文字對比', () => {
  it('透明祖先與 alpha 前景須在實際背景上合成', () => {
    expect(contrastOf({ ...good('prose'), foreground: 'rgba(0, 0, 0, 0.5)', layers: ['rgba(255, 0, 0, 0.5)', 'rgba(0, 0, 0, 0)', 'rgb(255, 255, 255)'] })).toBeCloseTo(3.18, 2);
    expect(contrastOf({ ...good('prose'), foreground: 'rgb(0, 0, 0)', layers: ['rgba(0, 0, 0, 0)', 'rgb(255, 255, 255)'] })).toBeCloseTo(21, 5);
  });
  it('四類都有文字且配對色可讀時通過，缺類不得通過', () => {
    expect(() => assertProseContrast(kinds.map(good))).not.toThrow();
    expect(() => assertProseContrast(kinds.slice(0, 3).map(good))).toThrow('code 沒有可見文字');
  });
  it('拒絕淺色背景上淡字及深色圖卡上的深色表頭', () => {
    const cases = [
      // 基準 f060808 的 1440 dark 實際文字與計算樣式。
      { kind: 'prose', text: 'L23303-M4-E-same-confusion-ranking.json', foreground: 'rgb(227, 233, 223)', layers: ['rgb(237, 241, 231)', 'rgb(250, 251, 247)'] },
      { kind: 'tables', text: '盜刷（正類）', foreground: 'rgb(227, 233, 223)', layers: ['rgba(0, 0, 0, 0)', 'rgb(250, 251, 247)'] },
      { kind: 'figureHeaders', foreground: 'rgb(37, 61, 55)', layers: ['rgb(21, 37, 43)'] },
      { kind: 'code', text: '[', foreground: 'rgb(217, 245, 221)', layers: ['rgba(0, 0, 0, 0)', 'rgb(237, 241, 231)'] },
    ];
    for (const bad of cases) expect(() => assertProseContrast(kinds.map((kind) => kind === bad.kind ? { ...good(kind), ...bad } : good(kind)))).toThrow(/對比/);
  });
});
