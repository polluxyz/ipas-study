/** 離線驗證巡檢工具的文字排除區、主責導覽與錯誤收尾。 */
import { describe, expect, it } from 'vitest';
import { assertNavigation, expectedNavigation, hasUnconvertedWikiLink, runSmokeWithCleanup } from './smoke.mjs';

// 只模擬巡檢需要的 DOM API；不啟動瀏覽器或修改正式資料。
function mainWithText(...nodes) {
  let index = -1;
  return { ownerDocument: { createTreeWalker: () => ({
    nextNode() { index++; return index < nodes.length; },
    get currentNode() {
      const { text, excluded = false, visible = true } = nodes[index];
      return { textContent: text, parentElement: { closest: () => excluded, checkVisibility: () => visible } };
    },
  }) } };
}
const link = (href) => ({ count: async () => href ? 1 : 0, getAttribute: async () => href });
const content = {
  concepts: [
    { id: 'a', codes: ['owner'] }, { id: 'cross', codes: ['owner', 'foreign'] },
    { id: 'b', codes: ['owner'] }, { id: 'unlisted', codes: ['owner', 'foreign'] },
    { id: 'unavailable', codes: ['absent', 'foreign'] },
  ],
  codes: [
    { code: 'owner', concepts: ['b', 'cross', 'a'], stages: [{ concepts: [{ id: 'a' }, { id: 'missing' }, { id: 'cross' }, { id: 'b' }] }] },
    { code: 'foreign', concepts: ['b', 'unlisted', 'cross', 'unavailable', 'a'] },
  ],
};

describe('未轉換的手動概念連結', () => {
  it('正文的完整 wikilink 必須被攔下', () => {
    expect(hasUnconvertedWikiLink(mainWithText({ text: '請讀 [[recall]]。' }))).toBe(true);
    expect(hasUnconvertedWikiLink(mainWithText({ text: '[[召回率]]' }))).toBe(true);
  });
  it('程式、輸出、公式及既有連結的內容，以及非 wikilink 的 [[ 不誤判', () => {
    expect(hasUnconvertedWikiLink(mainWithText(
      { text: '[[1, 2], [3, 4]]', excluded: true }, { text: '[[recall]]', excluded: true },
      { text: '[[recall]]', visible: false }, { text: '輸出開頭 [[' },
    ))).toBe(false);
    expect(hasUnconvertedWikiLink(mainWithText({ text: '[[1, 2], [3, 4]]', excluded: true }, { text: '正文 [[recall]]' }))).toBe(true);
  });
});

describe('主責閱讀路線', () => {
  it('跨碼概念使用主責階段順序、略過缺頁，並驗證確切 href', async () => {
    const expected = expectedNavigation('cross', content);
    expect(expected).toEqual({ owner: 'owner', listed: true, previous: 'a', next: 'b' });
    await expect(assertNavigation(link('/concepts/a/'), link('/concepts/b/'), expected, 'cross')).resolves.toBeUndefined();
    await expect(assertNavigation(link('/concepts/b/'), link('/concepts/a/'), expected, 'cross')).rejects.toThrow();
  });
  it('主責路線未列或不存在時，即使跨碼路線收錄也不借用前後頁', async () => {
    for (const id of ['unlisted', 'unavailable']) {
      const expected = expectedNavigation(id, content);
      expect(expected).toMatchObject({ listed: false, previous: undefined, next: undefined });
      await expect(assertNavigation(link(null), link(null), expected, id)).resolves.toBeUndefined();
      await expect(assertNavigation(link('/concepts/b/'), link(null), expected, id)).rejects.toThrow();
    }
  });
  it('無階段時使用 concepts，明列空階段不得回退', () => {
    const noStages = structuredClone(content); delete noStages.codes[0].stages;
    expect(expectedNavigation('cross', noStages)).toMatchObject({ previous: 'b', next: 'a' });
    noStages.codes[0].stages = [];
    expect(expectedNavigation('cross', noStages)).toMatchObject({ listed: false, previous: undefined, next: undefined });
  });
});

describe('收尾與證據', () => {
  async function exercise(initialError, cleanupError) {
    const report = {}; let saved, closed = false, screenshots = 0, caught;
    try {
      await runSmokeWithCleanup({ report,
        run: async () => { if (initialError) throw initialError; },
        finish: async () => { if (cleanupError) throw cleanupError; },
        evidence: () => ({ observed: true }), save: async () => { saved = structuredClone(report); },
        close: async () => { closed = true; }, onFailure: async () => { screenshots++; },
      });
    } catch (error) { caught = error; }
    return { report, saved, closed, screenshots, caught };
  }
  it('主流程失敗必須失敗並保存原錯誤', async () => {
    const initial = new Error('正文錯誤'); const result = await exercise(initial);
    expect(result.caught).toBe(initial); expect(result.saved).toMatchObject({ completed: false, failure: '正文錯誤', initialFailure: 'Error: 正文錯誤', buildResponses: [{ observed: true }] });
    expect(result.closed).toBe(true); expect(result.screenshots).toBe(1);
  });
  it('只有收尾失敗也必須失敗', async () => {
    const cleanup = new Error('收尾錯誤'); const result = await exercise(undefined, cleanup);
    expect(result.caught).toBe(cleanup); expect(result.saved).toMatchObject({ completed: false, failure: 'Error: 收尾錯誤', cleanupFailure: 'Error: 收尾錯誤' });
    expect(result.closed).toBe(true);
  });
  it('兩個錯誤同時保存，且以 aggregate failure 結束', async () => {
    const initial = new Error('正文錯誤'), cleanup = new Error('收尾錯誤'); const result = await exercise(initial, cleanup);
    expect(result.caught).toBeInstanceOf(AggregateError); expect(result.caught.errors).toEqual([initial, cleanup]);
    expect(result.saved).toMatchObject({ completed: false, failure: '正文錯誤', initialFailure: 'Error: 正文錯誤', cleanupFailure: 'Error: 收尾錯誤' });
    expect(result.closed).toBe(true);
  });
  it('無錯誤時正常收尾', async () => {
    const result = await exercise(); expect(result.caught).toBeUndefined(); expect(result.closed).toBe(true);
  });
});
