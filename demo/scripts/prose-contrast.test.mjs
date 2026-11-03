/** 以透明祖先、半透明前景及舊版低對比案例驗證量測門檻。 */
import { describe, expect, it, vi } from 'vitest';
import { assertInlineCodeContrast, assertProseContrast, collectInlineCodeSamples, collectProseSamples, contrastOf } from './prose-contrast.mjs';
const good = (kind) => ({ kind, text: '可讀', foreground: 'rgb(37, 61, 55)', layers: ['rgba(0, 0, 0, 0)', 'rgb(255, 254, 250)'], opacity: 1 });
const kinds = ['prose', 'tables', 'figureHeaders', 'code', 'output', 'formula', 'filterLabel', 'filterDescription', 'filterStatus'];
describe('概念頁文字對比', () => {
  it('行內程式在實際淡底配淡字時拒絕，配深字及無此類文字時照實回報', () => {
    const bad = { text: 'fit', foreground: 'rgb(228, 237, 241)', layers: ['rgb(237, 241, 231)', 'rgb(26, 45, 49)'], opacity: 1 };
    expect(() => assertInlineCodeContrast([bad])).toThrow('行內程式對比');
    const result = assertInlineCodeContrast([{ ...bad, foreground: 'rgb(37, 61, 55)' }]);
    expect(result.count).toBe(1);
    expect(result.minimum).toBeGreaterThanOrEqual(4.5);
    expect(assertInlineCodeContrast([])).toEqual({ count: 0, minimum: null, samples: [] });
    expect(() => assertInlineCodeContrast([{ ...bad, foreground: 'rgba(37, 61, 55, 0)' }])).toThrow('行內程式對比');
  });
  it('逐一採集行內程式子節點的實際配色，排除程式區並拒絕隱藏或無幾何文字', () => {
    let visible = true, width = 20;
    const code = { closest: () => null, parentElement: null };
    const element = { parentElement: code, checkVisibility: () => visible };
    const preCode = { closest: () => ({}) };
    const node = { textContent: 'fit', parentElement: element };
    const walkerRoots = [];
    vi.stubGlobal('document', {
      querySelector: (selector) => selector === '.cheatsheet-body' ? { querySelectorAll: () => [code, preCode] } : null,
      createTreeWalker: (root) => { walkerRoots.push(root); let visited = false; return { currentNode: node, nextNode: () => visited ? false : (visited = true) }; },
      createRange: () => ({ selectNodeContents: () => {}, getClientRects: () => [{ width, height: 16 }] }),
    });
    vi.stubGlobal('NodeFilter', { SHOW_TEXT: 4 });
    vi.stubGlobal('getComputedStyle', (current) => ({ backgroundImage: 'none', opacity: '1', backgroundColor: current === code ? 'rgb(237, 241, 231)' : 'rgba(0, 0, 0, 0)', color: 'rgb(228, 237, 241)' }));
    try {
      const samples = collectInlineCodeSamples('.cheatsheet-body');
      expect(samples).toHaveLength(1); expect(walkerRoots).toEqual([code]);
      expect(samples[0]).toMatchObject({ text: 'fit', foreground: 'rgb(228, 237, 241)', layers: ['rgba(0, 0, 0, 0)', 'rgb(237, 241, 231)'] });
      expect(() => assertInlineCodeContrast(samples)).toThrow('行內程式對比');
      visible = false; expect(() => collectInlineCodeSamples('.cheatsheet-body')).toThrow('行內程式文字不可見');
      visible = true; width = 0; expect(() => collectInlineCodeSamples('.cheatsheet-body')).toThrow('行內程式文字沒有可見範圍');
      expect(() => collectInlineCodeSamples('.missing')).toThrow('缺少行內程式檢查區域');
    } finally { vi.unstubAllGlobals(); }
  });
  it('預設採集概念正文，也可指定既有示範正文；表頭不可漏採', () => {
    const el = { checkVisibility: () => true, closest: (selector) => selector === 'table', parentElement: null };
    const node = { textContent: '設定', parentElement: el };
    const select = vi.fn(() => ({}));
    vi.stubGlobal('document', {
      querySelector: select,
      createTreeWalker: () => { let visited = false; return { currentNode: node, nextNode: () => visited ? false : (visited = true) }; },
      createRange: () => ({ selectNodeContents: () => {}, getClientRects: () => [{ width: 20, height: 20 }] }),
    });
    vi.stubGlobal('NodeFilter', { SHOW_TEXT: 4 });
    vi.stubGlobal('getComputedStyle', () => ({ backgroundImage: 'none', opacity: '1', backgroundColor: 'rgb(36, 46, 40)', color: 'rgb(37, 61, 55)' }));
    try {
      for (const selector of [undefined, '#supplement-render-body']) {
        select.mockImplementation((query) => query === '[data-supplement-filter]' ? null : ({}));
        const samples = collectProseSamples(selector);
        expect(select).toHaveBeenCalledWith(selector ?? '#concept-body');
        expect(samples).toHaveLength(1);
        expect(samples[0]).toMatchObject({ kind: 'tables', text: '設定' });
        expect(contrastOf(samples[0])).toBeCloseTo(1.203732, 6);
      }
      select.mockReturnValue(null);
      expect(() => collectProseSamples('#supplement-render-body')).toThrow('缺少概念正文');
    } finally { vi.unstubAllGlobals(); }
  });
  it('補充表頭使用區塊配色時通過，Starlight 深字配深底時拒絕', () => {
    const header = { kind: 'tables', text: '設定', foreground: 'rgb(227, 233, 223)', layers: ['rgba(0, 0, 0, 0)', 'rgb(36, 46, 40)', 'rgb(250, 251, 247)'], opacity: 1 };
    expect(contrastOf(header)).toBeGreaterThanOrEqual(4.5);
    expect(() => assertProseContrast(kinds.map((kind) => kind === 'tables' ? header : good(kind)))).not.toThrow();
    expect(() => assertProseContrast(kinds.map((kind) => kind === 'tables' ? { ...header, foreground: 'rgb(37, 61, 55)' } : good(kind)))).toThrow('tables 對比 1.204 < 4.5');
  });
  it('透明祖先與 alpha 前景須在實際背景上合成', () => {
    expect(contrastOf({ ...good('prose'), foreground: 'rgba(0, 0, 0, 0.5)', layers: ['rgba(255, 0, 0, 0.5)', 'rgba(0, 0, 0, 0)', 'rgb(255, 255, 255)'] })).toBeCloseTo(3.18, 2);
    expect(contrastOf({ ...good('prose'), foreground: 'rgb(0, 0, 0)', layers: ['rgba(0, 0, 0, 0)', 'rgb(255, 255, 255)'] })).toBeCloseTo(21, 5);
  });
  it('九類都有文字且配對色可讀時通過，缺類不得通過', () => {
    expect(() => assertProseContrast(kinds.map(good))).not.toThrow();
    expect(() => assertProseContrast(kinds.slice(0, 4).map(good))).toThrow('output 沒有可見文字');
    expect(() => assertProseContrast(kinds.slice(0, 5).map(good))).toThrow('formula 沒有可見文字');
    for (const missing of kinds.slice(6)) {
      expect(() => assertProseContrast(kinds.filter((kind) => kind !== missing).map(good))).toThrow(`${missing} 沒有可見文字`);
    }
  });
  it('拒絕淺色背景上淡字及深色圖卡上的深色表頭', () => {
    const cases = [
      // 基準 f060808 的 1440 dark 實際文字與計算樣式。
      { kind: 'prose', text: 'L23303-M4-E-same-confusion-ranking.json', foreground: 'rgb(227, 233, 223)', layers: ['rgb(237, 241, 231)', 'rgb(250, 251, 247)'] },
      { kind: 'tables', text: '盜刷（正類）', foreground: 'rgb(227, 233, 223)', layers: ['rgba(0, 0, 0, 0)', 'rgb(250, 251, 247)'] },
      { kind: 'figureHeaders', foreground: 'rgb(37, 61, 55)', layers: ['rgb(21, 37, 43)'] },
      { kind: 'code', text: '[', foreground: 'rgb(217, 245, 221)', layers: ['rgba(0, 0, 0, 0)', 'rgb(237, 241, 231)'] },
      { kind: 'output', text: 'AUC', foreground: 'rgb(227, 233, 223)', layers: ['rgba(0, 0, 0, 0)', 'rgb(237, 241, 231)'] },
      // c04d58e 的 ROC 顯示公式，實測可見 KaTeX 分子。
      { kind: 'formula', text: '10.3125', foreground: 'rgb(227, 233, 223)', layers: ['rgba(0, 0, 0, 0)', 'rgb(250, 251, 247)'] },
      // 舊版深色模式的篩選列實際配色。
      { kind: 'filterLabel', text: '只看指引內容', foreground: 'rgb(227, 233, 223)', layers: ['rgba(0, 0, 0, 0)', 'rgb(250, 251, 247)'] },
      { kind: 'filterDescription', text: '僅篩正文', foreground: 'rgb(176, 190, 177)', layers: ['rgba(0, 0, 0, 0)', 'rgb(250, 251, 247)'] },
      { kind: 'filterStatus', text: '目前顯示', foreground: 'rgb(176, 190, 177)', layers: ['rgba(0, 0, 0, 0)', 'rgb(250, 251, 247)'] },
    ];
    for (const bad of cases) expect(() => assertProseContrast(kinds.map((kind) => kind === bad.kind ? { ...good(kind), ...bad } : good(kind)))).toThrow(/對比/);
  });
});
