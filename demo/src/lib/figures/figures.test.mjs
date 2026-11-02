/** 用人工可核算的獨立答案驗證圖表，再從完整 Markdown 管線確認作者語法與失敗訊息。 */
import { describe, it, expect } from 'vitest';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { classificationCurve, confusion, ratio } from './metrics.mjs';
import { validateFigure } from './schema.mjs';
import { renderFigure, niceAxis } from './render.mjs';
import figures, { loadFigure } from '../../../plugins/figures.mjs';
import { collapseAdvanced, mathSearchPolicy, readableTables } from '../../../plugins/textbook.mjs';
import asides from '../../../plugins/asides.mjs';
import wikiLinks from '../../../plugins/wiki-links.mjs';

const directory = fileURLToPath(new URL('./examples/', import.meta.url));
const example = (name) => JSON.parse(readFileSync(join(directory, `${name}.json`), 'utf8'));
const samples = example('roc').samples;
const pipeline = async () => createMarkdownProcessor({ remarkPlugins: [asides, wikiLinks, remarkMath, [figures, { directory }]], rehypePlugins: [[rehypeKatex, { output: 'htmlAndMathml' }], mathSearchPolicy, collapseAdvanced, readableTables] });

describe('座標刻度可讀性', () => {
  it('epoch 整數刻度、損失非負、殘差包含零線且涵蓋原始資料', () => {
    expect(niceAxis([1, 6], true).ticks).toEqual([1, 2, 3, 4, 5, 6]);
    expect(niceAxis([0, 1]).ticks).toEqual([0, .2, .4, .6, .8, 1]);
    expect(niceAxis([-2, 2]).ticks).toEqual([-2, -1, 0, 1, 2]);
    expect(niceAxis([10, 50]).ticks).toEqual([10, 20, 30, 40, 50]);
    expect(niceAxis([1, 1000], true).ticks.every(Number.isInteger)).toBe(true);
    expect(niceAxis([.012, .018]).range).toEqual([.012, .018]);
  });
  it('圖上刻度符合實際示例；原始數值表不被四捨五入成刻度', () => {
    const learning = renderFigure(example('learning-curve'));
    expect([...learning.matchAll(/class="fig-tick fig-tick-x">([^<]+)/g)].map((match) => Number(match[1]))).toEqual([1, 2, 3, 4, 5, 6]);
    expect(learning).not.toMatch(/>-0.08<|>2.05<|>4.95</);
    expect(renderFigure(example('residual'))).toContain('class="fig-tick fig-tick-y">-2</text>');
  });
});

describe('分類數值獨立核對', () => {
  it('scikit-learn 四筆例子的 ROC 座標與 AUC=0.75', () => {
    const result = classificationCurve(samples);
    expect(result.points.map((p) => [p.fpr, p.tpr])).toEqual([[0, 0], [0, .5], [.5, .5], [.5, 1], [1, 1]]);
    expect(result.auc).toBe(.75);
  });
  it('AP 以 1/2×1 + 1/2×2/3 = 5/6 核對', () => {
    const result = classificationCurve(example('pr').samples);
    expect(result.averagePrecision).toBeCloseTo(5 / 6, 12);
    expect(result.points.map((p) => [p.recall, p.precision])).toEqual([[0, 1], [.5, 1], [.5, .5], [1, 2 / 3], [1, .5]]);
  });
  it('同分正負樣本一次加入；全部同分 AUC=0.5、AP=0.5', () => {
    const tied = [{ label: 1, score: .4 }, { label: 0, score: .4 }];
    expect(classificationCurve(tied).points).toHaveLength(2);
    expect(classificationCurve(tied).auc).toBe(.5);
    expect(classificationCurve(tied).averagePrecision).toBe(.5);
    expect(classificationCurve(tied)).toEqual(classificationCurve(tied.reverse()));
  });
  it.each([0, 1])('拒絕只有類別 %s 的 ROC 與 PR', (label) => {
    for (const kind of ['roc', 'pr']) expect(() => renderFigure({ ...example(kind), samples: [{ label, score: .5 }] })).toThrow(/單一類別/);
  });
  it('閾值相等也判正例；四格與指標由原始四筆資料算出', () => {
    expect(confusion(example('confusion-matrix').samples, .35)).toEqual({ tp: 2, fp: 1, tn: 1, fn: 0, precision: 2 / 3, recall: 1, fpr: .5, accuracy: .75, f1: .8 });
  });
  it('沒有預測正例時 Precision 未定義；有正例時 F1=0', () => {
    expect(confusion(samples, 2)).toMatchObject({ precision: null, recall: 0, f1: 0 });
    expect(renderFigure({ ...example('confusion-matrix'), threshold: 2 })).toContain('Precision = 未定義');
    expect(() => renderFigure({ ...example('pr'), thresholds: [2] })).toThrow(/無預測正例/);
  });
  it('沒有實際正例時 Recall 未定義；全為真負例時 F1 未定義', () => {
    expect(confusion([{ label: 0, score: .1 }], .5)).toMatchObject({ tp: 0, fp: 0, tn: 1, fn: 0, precision: null, recall: null, fpr: 0, f1: null });
    expect(ratio(0, 0)).toBeNull();
    expect(confusion([{ label: 1, score: .1 }], .5).fpr).toBeNull();
  });
  it.each([[], [{ label: 2, score: .5 }], [{ label: 1, score: NaN }]])('拒絕無效樣本 %j', (invalid) => {
    expect(() => classificationCurve(invalid)).toThrow();
  });
});

describe('五種黃金範例與 schema', () => {
  it.each(['roc', 'pr', 'learning-curve', 'residual', 'confusion-matrix'])('%s 產生圖、描述、來源、數值表', (kind) => {
    const html = renderFigure(example(kind));
    for (const text of ['<figure', '<figcaption>', 'role="img"', '<title', '<desc', '<table>', '<details', '教學模擬資料']) expect(html).toContain(text);
    expect(html).not.toMatch(/NaN|undefined/);
  });
  it('學習曲線核對原始損失與停止點', () => {
    const html = renderFigure(example('learning-curve'));
    expect(html).toContain('停止點：第 4 輪');
    expect(html).toContain('<td>4</td><td>0.3</td><td>0.4</td>');
    expect(html).toContain('fig-secondary');
  });
  it('殘差 actual-predicted：1,-2,0,2,-1', () => {
    const html = renderFigure(example('residual'));
    for (const row of ['<td>10</td><td>11</td><td>1</td>', '<td>20</td><td>18</td><td>-2</td>', '<td>30</td><td>30</td><td>0</td>', '<td>40</td><td>42</td><td>2</td>', '<td>50</td><td>49</td><td>-1</td>']) expect(html).toContain(row);
  });
  it('同值殘差與單一預測值仍有有限座標', () => {
    expect(renderFigure({ ...example('residual'), samples: [{ actual: 1, predicted: 1 }] })).not.toMatch(/NaN|Infinity/);
  });
  it.each(['tp', 'fp', 'auc', 'points'])('拒絕分類圖手填 %s', (key) => {
    expect(() => validateFigure({ ...example('roc'), [key]: 1 })).toThrow(/不接受欄位/);
  });
  it('拒絕重複 epoch、缺單位、無效停止點與檔名不一致', () => {
    expect(() => validateFigure({ ...example('learning-curve'), points: [{ epoch: 1, train: 1, validation: 1 }, { epoch: 1, train: 2, validation: 2 }] })).toThrow(/epoch/);
    expect(() => validateFigure({ ...example('learning-curve'), earlyStopping: 9 })).toThrow(/earlyStopping/);
    expect(() => validateFigure({ ...example('residual'), unit: '' })).toThrow(/unit/);
    expect(() => validateFigure(example('roc'), 'other')).toThrow(/ID/);
  });
  it('圖說 HTML 會轉義', () => expect(renderFigure(example('roc'), '<script>x</script>')).toContain('&lt;script&gt;'));
});

describe('Markdown 建置管線', () => {
  it('Starlight 已解析的 directive AST 也轉換，缺結尾及未知類型仍有來源錯誤', () => {
    const fixture = (value, name = 'tip') => ({ type: 'root', children: [{ type: 'containerDirective', name, position: { start: { line: 1, offset: 0 }, end: { offset: value.length } }, children: [{ type: 'paragraph', data: { directiveLabel: true }, children: [{ type: 'text', value: '自訂標題' }] }, { type: 'paragraph', children: [{ type: 'text', value: '內容' }] }] }] });
    const value = ':::tip[自訂標題]\n內容\n:::';
    const tree = fixture(value); asides()(tree, { value, path: 'concept.md' });
    expect(tree.children[0].data.hName).toBe('aside');
    expect(tree.children[0].data.hProperties.ariaLabel).toBe('自訂標題');
    expect(tree.children[0].children[1].children).toHaveLength(1);
    const invalid = ':::warning\n內容\n:::';
    expect(() => asides()(fixture(invalid, 'warning'), { value: invalid, path: 'concept.md' })).toThrow(/concept.md:1.*不支援/);
    const unclosed = ':::tip\n內容';
    expect(() => asides()(fixture(unclosed), { value: unclosed, path: 'concept.md' })).toThrow(/缺少結尾/);
  });
  it.each(['tip', 'caution', 'note'])('%s 提示框支援標題、行內格式、段落與清單', async (kind) => {
    const html = (await (await pipeline()).render(`:::${kind}[自訂標題]\n這是 **粗體** 與 $P$。\n\n- 第一點\n- 第二點\n\n另一段。\n:::`)).code;
    expect(html).toContain(`starlight-aside--${kind}`);
    expect(html).toContain('starlight-aside__title');
    expect(html).toContain('自訂標題'); expect(html).toContain('<strong>粗體</strong>');
    expect(html).toContain('<math'); expect(html).toContain('<li>第一點</li>'); expect(html).toContain('另一段。');
    expect(html).not.toContain(':::');
  });
  it('預設標題與巢狀框保留；程式碼內的範例不轉換', async () => {
    const html = (await (await pipeline()).render(':::tip\n重點。\n\n:::note[內框]\n例子。\n:::\n\n:::\n\n```md\n:::invalid\n```')).code;
    expect(html).toContain('重點</p>'); expect(html).toContain('內框</p>'); expect(html).toContain(':::invalid');
  });
  it.each([':::warning[標題]\n內容\n:::', ':::tip[未閉合\n內容\n:::', ':::tip\n內容', '內容\n:::', ':::tip[]\n內容\n:::'])('拒絕錯誤提示框：%s', async (markdown) => {
    await expect((await pipeline()).render(markdown)).rejects.toThrow(/提示框/);
  });
  it('表格保留完整內容，短儲存格標示為不換行並有可聚焦捲動區', async () => {
    const html = (await (await pipeline()).render('| 類別 | 筆數 | 明細 |\n|---|---|---|\n| 正類 | 8 | 這一格有超過十六個中文字的明細內容並應該允許換行 |')).code;
    expect(html).toContain('textbook-table-scroll'); expect(html).toContain('tabindex="0"');
    expect(html).toContain('class="table-short-cell">筆數</th>');
    expect(html).toContain('class="table-long-cell">這一格');
  });
  it('行內、區塊公式保留 MathML 且排除 Pagefind', async () => {
    const processor = await pipeline();
    const html = (await processor.render('精確率 $P$ 的定義。\n\n$$\nF_1=2PR/(P+R)\n$$')).code;
    expect(html).toContain('精確率'); expect(html).toContain('<math');
    expect(html.match(/data-pagefind-ignore/g)).toHaveLength(2);
    expect(html).toContain('katex-display');
  });
  it('無效 TeX 令建置失敗', async () => {
    const processor = await pipeline();
    await expect(processor.render('$\\notARealCommand{x}$')).rejects.toThrow();
  });
  it('figure 變成段落外的圖，保留前後文字與 wiki-links', async () => {
    const processor = await pipeline();
    const html = (await processor.render('前文 ![觀察閾值](figure:roc) 後文\n\n[[roc-auc]]')).code;
    expect(html).toContain('<figure'); expect(html).not.toContain('<p><figure');
    expect(html).toContain('前文'); expect(html).toContain('後文');
    expect(html).toContain('/concepts/roc-auc/');
  });
  it('找不到圖的錯誤包含正文檔與預期圖檔', async () => {
    const tree = { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'image', url: 'figure:missing', alt: '圖說' }] }] };
    expect(() => figures({ directory })(tree, { path: 'content/concepts/example.md' })).toThrow(/content\/concepts\/example.md.*missing.json/);
    expect(() => loadFigure('../escape', '圖說', directory)).toThrow(/ID/);
    expect(() => loadFigure('roc', '', directory)).toThrow(/替代文字/);
  });
  it('進階收合包含三級標題，在下個二級標題前結束', async () => {
    const processor = await pipeline();
    const html = (await processor.render('## 進階\n\n內容\n\n### 細節\n\n細節內容\n\n## 小結\n\n收尾')).code;
    expect(html).toMatch(/<details[^>]*textbook-advanced[^>]*><summary>/);
    expect(html).not.toMatch(/<details[^>]*\sopen/);
    expect(html).toMatch(/細節內容[\s\S]*<\/details>[\s\S]*小結/);
  });
  it('SVG 示意圖使用圖片替代文字，缺描述與外部資產會失敗', () => {
    const temporary = mkdtempSync(join(tmpdir(), 's1-figure-'));
    try {
      writeFileSync(join(temporary, 'diagram.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><title>流程</title><desc>切分示意</desc></svg>');
      expect(loadFigure('diagram', '切分流程', temporary)).toContain('alt="切分流程"');
      writeFileSync(join(temporary, 'diagram.svg'), '<svg><title>流程</title></svg>');
      expect(() => loadFigure('diagram', '流程', temporary)).toThrow(/desc/);
      writeFileSync(join(temporary, 'diagram.svg'), '<svg><title>流程</title><desc>描述</desc><image href="https://example.com/a.png"/></svg>');
      expect(() => loadFigure('diagram', '流程', temporary)).toThrow(/外部資源/);
    } finally { rmSync(temporary, { recursive: true, force: true }); }
  });
});
