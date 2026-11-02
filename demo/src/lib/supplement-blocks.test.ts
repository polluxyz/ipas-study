/** 驗證補充合併的來源判定與指引邊界，確保未來教材重用時不會混併出處。 */
import { describe, expect, it } from 'vitest';
import { mergeSupplementBlocks, type ReadingBlock } from './supplement-blocks';

const supplement = (part: string, sources = ['Hastie §7.10']): ReadingBlock<string> => ({ kind: 'supplement', sources, parts: [part] });

describe('mergeSupplementBlocks', () => {
  it('相鄰同來源合併，保留三段內容順序，來源只保留一份', () => {
    expect(mergeSupplementBlocks([supplement('定義'), supplement('表格與清單'), supplement('成本')]))
      .toEqual([{ kind: 'supplement', sources: ['Hastie §7.10'], parts: ['定義', '表格與清單', '成本'] }]);
  });

  it('相鄰不同來源不合併', () => {
    const blocks = [supplement('第一段'), supplement('第二段', ['scikit-learn'])];
    expect(mergeSupplementBlocks(blocks)).toEqual(blocks);
  });

  it('中間夾指引內容時，同來源也不合併', () => {
    const blocks: ReadingBlock<string>[] = [supplement('第一段'), { kind: 'guide', parts: ['指引'] }, supplement('第二段')];
    expect(mergeSupplementBlocks(blocks)).toEqual(blocks);
  });

  it('多來源集合相同仍合併並去除重複來源，沿用首次列出的順序', () => {
    expect(mergeSupplementBlocks([supplement('一', ['A', 'B', 'A']), supplement('二', ['B', 'A'])]))
      .toEqual([{ kind: 'supplement', sources: ['A', 'B'], parts: ['一', '二'] }]);
  });

  it('有部分來源重疊仍視為不同來源', () => {
    const blocks = [supplement('一', ['A']), supplement('二', ['A', 'B'])];
    expect(mergeSupplementBlocks(blocks)).toEqual(blocks);
  });

  it('未標來源的補充不自動視為同來源', () => {
    expect(mergeSupplementBlocks([supplement('一', []), supplement('二', [])])).toHaveLength(2);
  });

  it('支援空內容且不改動輸入陣列', () => {
    expect(mergeSupplementBlocks([])).toEqual([]);
    const blocks = Object.freeze([
      Object.freeze({ kind: 'supplement' as const, sources: Object.freeze(['A']), parts: Object.freeze(['一']) }),
      Object.freeze({ kind: 'supplement' as const, sources: Object.freeze(['A']), parts: Object.freeze(['二']) }),
    ]);
    expect(mergeSupplementBlocks(blocks)[0].parts).toEqual(['一', '二']);
    expect(blocks[0].parts).toEqual(['一']);
  });
});
