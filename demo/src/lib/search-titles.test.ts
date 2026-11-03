/** 用真實名稱守住補充詞與既有查詢；未知名稱不能產生錯誤入口。 */
import { readFileSync, readdirSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { findSearchTitles, findSearchSummary, type SearchTitle } from './search-titles';

// 此檔在 demo/src/lib/，回到 repo 根目錄後讀權威內容。
const contentDirectory = new URL('../../../content/concepts/', import.meta.url);
const entries: SearchTitle[] = readdirSync(contentDirectory).filter((name) => name.endsWith('.md')).map((name) => {
  const text = readFileSync(new URL(name, contentDirectory), 'utf8');
  const { id, title, aliases = [], summary } = parse(text.match(/^---\r?\n([\s\S]*?)\r?\n---/)![1]);
  return { id, title, aliases, summary };
});

describe('空摘要的來源界線', () => {
  const baseUrl = 'https://study.test/';
  it('只回傳該概念已有的真實摘要', () => {
    const expected = entries.find(({ id }) => id === 'stratified-k-fold')!.summary;
    expect(expected?.trim()).toBeTruthy();
    expect(findSearchSummary('/concepts/stratified-k-fold/', baseUrl, entries)).toBe(expected);
    expect(findSearchSummary('/concepts/stratified-k-fold/#範例', baseUrl, entries)).toBe(expected);
  });

  it.each(['https://foreign.test/concepts/precision/', '/codes/precision/', '/concepts/no-such-concept/', 'http://'])('不替未知來源 %s 偽造摘要', (href) => {
    expect(findSearchSummary(href, baseUrl, entries)).toBeUndefined();
  });

  it('沒有正文摘要時不拿標題或占位文字代替', () => {
    expect(findSearchSummary('/concepts/empty/', baseUrl, [{ id: 'empty', title: '只有標題', aliases: [] }])).toBeUndefined();
  });
});

describe('完整概念名稱入口', () => {
  it.each([
    ['精確率', 'precision'], ['準確率', 'accuracy'], ['正確率', 'accuracy'], ['召回率', 'recall'],
    ['資料洩漏', 'data-leakage'], ['資料泄漏', 'data-leakage'], ['過擬合', 'overfitting'], ['梯度裁剪', 'gradient-clipping'],
  ])('自然輸入 %s 可直接到 %s，不依賴斷詞', (query, id) => {
    expect(findSearchTitles(query, entries).map((entry) => entry.id)).toContain(id);
  });

  it.each([
    ['ROC', 'roc-auc'], ['AUC', 'roc-auc'], ['StratifiedKFold', 'stratified-k-fold'],
    ['Statistical Parity', 'statistical-parity'], ['NIST AI RMF', 'nist-ai-rmf'],
  ])('正式英文查詢 %s 也保留名稱入口', (query, id) => {
    expect(findSearchTitles(query, entries).map((entry) => entry.id)).toContain(id);
    expect(findSearchTitles(query.toLowerCase(), entries).map((entry) => entry.id)).toContain(id);
  });

  it('沒有獨立 LoRA 名稱時不猜別名，保留原 Pagefind 的結果', () => {
    expect(findSearchTitles('LoRA', entries)).toEqual([]);
  });

  it.each(['', '   ', '不存在的概念名稱xyz', '精確率錯誤', '精 確 率', '<script>準確率</script>'])('不為空值、部分名稱或不相關的 %s 建立入口', (query) => {
    expect(findSearchTitles(query, entries)).toEqual([]);
  });

  it('一般化使用既有名稱與別名，支援未列入驗收的概念', () => {
    const synthetic = [{ id: 'new-concept', title: '新概念', aliases: ['另一個新名稱'] }];
    expect(findSearchTitles(' 另一個新名稱 ', synthetic)).toEqual(synthetic);
    expect(findSearchTitles('新概念', [...synthetic, ...synthetic])).toEqual(synthetic);
  });

  it('名稱有歧義時保留所有目標，不任意挑選其中一頁', () => {
    const ambiguous = [
      { id: 'first', title: '同名', aliases: [] },
      { id: 'second', title: '其他', aliases: ['同名'] },
    ];
    expect(findSearchTitles('同名', ambiguous)).toEqual(ambiguous);
  });
});
