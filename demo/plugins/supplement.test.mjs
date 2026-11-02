/** 以正式 Markdown 處理器驗證補充解析、來源整併與隱藏邊界，覆蓋巢狀提示框及排版外掛。 */
import { describe, expect, it } from 'vitest';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import asides from './asides.mjs';
import { supplementSections } from './supplement.mjs';
import { collapseAdvanced, readableTables } from './textbook.mjs';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { supplementFixture } from '../src/components/dev/supplement-fixture.mjs';
async function render(markdown) {
  const processor = await createMarkdownProcessor({ remarkPlugins: [asides, remarkMath], rehypePlugins: [rehypeKatex, supplementSections, collapseAdvanced, readableTables] });
  return (await processor.render(markdown)).code;
}
describe('正式補充呈現', () => {
  it('表格第一個 td 的文字可含行內格式，去頭尾空白後以補充結尾才標示', async () => {
    const html = await render('| 方法 | 說明 |\n| --- | --- |\n| **延伸（補充）**   | 隱藏 |');
    expect(html.match(/data-supplement-kind="row"/g)).toHaveLength(1);
  });
  for (const [name, row] of [
    ['第二欄的尾端標記', '| 指引列 | 說明（補充） |'],
    ['第一欄的句中標記', '| 名稱（補充）仍有後文 | 指引內容 |'],
    ['一般資料列', '| 指引列 | 指引內容 |'],
  ]) it(`表格不因${name}隱藏資料列`, async () => {
    const html = await render(`| 名稱（補充） | 說明 |\n| --- | --- |\n${row}`);
    expect(html).not.toContain('data-supplement-kind="row"');
  });
  it('無序清單辨識自己的尾端標記並保留文字，不替項目加序號', async () => {
    const html = await render('- 指引內容\n- **延伸內容（補充）**   ');
    expect(html).toMatch(/<li data-supplement="" data-supplement-kind="list-item"><strong>延伸內容（補充）<\/strong>/);
    expect(html).not.toContain('value=');
  });
  it('清單項不因句中標記或子清單尾端標記而隱藏父項', async () => {
    const html = await render('- 名稱（補充）仍有後文\n- 指引父項\n  - 子項（補充）');
    expect(html.match(/data-supplement-kind="list-item"/g)).toHaveLength(1);
    expect(html).toContain('<li>名稱（補充）仍有後文</li>');
    expect(html).toContain('<li>指引父項');
  });
  it('父項自己的尾端標記可在子清單前，子項不必重複標記', async () => {
    const html = await render('- 延伸父項（補充）\n  - 延伸細節');
    expect(html.match(/data-supplement-kind="list-item"/g)).toHaveLength(1);
    expect(html).toMatch(/data-supplement-kind="list-item">延伸父項（補充）/);
    expect(html).toContain('<li>延伸細節</li>');
  });
  it('有序清單固定全部原始序號，包含非 1 的起始值', async () => {
    const html = await render('5. 準備\n6. 選做（補充）\n7. 核對');
    expect(html).toContain('<ol start="5">');
    expect([...html.matchAll(/\bvalue="(\d+)"/g)].map((match) => Number(match[1]))).toEqual([5, 6, 7]);
    expect(html).toMatch(/data-supplement-kind="list-item" value="6">選做（補充）/);
  });
  it('無補充的有序清單不增加 value 屬性，巢狀有序清單獨立編號', async () => {
    expect(await render('1. 準備\n2. 核對')).not.toContain('value=');
    const html = await render('1. 指引父項\n\n   3. 子步驟（補充）\n   4. 後續子步驟\n\n2. 指引後項');
    expect([...html.matchAll(/\bvalue="(\d+)"/g)].map((match) => Number(match[1]))).toEqual([3, 4]);
  });
  it('有序清單保留原有 value 跳號與 reversed 倒序語意', () => {
    const item = (value, content) => ({ type: 'element', tagName: 'li', properties: value === undefined ? {} : { value }, children: [{ type: 'text', value: content }] });
    const list = { type: 'element', tagName: 'ol', properties: { start: 9, reversed: true }, children: [item(undefined, '起點'), item(6, '選做（補充）'), item(undefined, '核對')] };
    supplementSections()({ type: 'root', children: [list] });
    expect(list.children.map((node) => node.properties.value)).toEqual([9, 6, 5]);
    expect(list.children[1].properties['data-supplement-kind']).toBe('list-item');
  });
  it('解析寫法，來源僅在合併區塊末尾顯示，同來源順序不同也合併', async () => {
    const html = await render(':::supplement[來源：甲；乙]\n段落甲。\n:::\n\n:::supplement[來源：乙；甲]\n段落乙。\n:::');
    expect(html.match(/class="textbook-supplement"/g)).toHaveLength(1);
    expect(html.match(/class="supplement-label"/g)).toHaveLength(1);
    expect(html).toMatch(/段落甲[\s\S]*段落乙[\s\S]*<p class="supplement-source">來源：甲；乙<\/p>\s*<\/div>/);
  });
  it('不同來源或中間有指引正文時保留邊界', async () => {
    const html = await render(':::supplement[來源：甲]\n甲\n:::\n\n指引\n\n:::supplement[來源：甲]\n乙\n:::\n\n:::supplement[來源：丙]\n丙\n:::');
    expect(html.match(/class="textbook-supplement"/g)).toHaveLength(3);
  });
  it('保留段落、清單、表格、KaTeX、程式高亮與內部提示框', async () => {
    const html = await render(supplementFixture);
    expect(html).toContain('<ul>'); expect(html).toContain('<table>'); expect(html).toContain('class="katex"');
    expect(html).toContain('starlight-aside--note'); expect(html).toContain('data-language="python"');
    expect(html.match(/class="supplement-source"/g)).toHaveLength(1);
    expect(html).not.toContain(':::');
  });
  it('補充三級節含四級子節，直到下個三級節；四級節直到同級節；參考來源永遠在外', async () => {
    const html = await render(supplementFixture);
    expect(html).toMatch(/data-supplement-kind="section"[\s\S]*換個場景[\s\S]*延伸細節[\s\S]*<\/section>\s*<h3[^>]*id="回到指引"/);
    expect(html).toMatch(/data-supplement-kind="section"[\s\S]*小範例[\s\S]*<\/section>\s*<h4[^>]*id="繼續閱讀"/);
    expect(html).toMatch(/data-supplement-kind="row"><td[^>]*>延伸列（補充）/);
    expect(html).toMatch(/<\/table>[\s\S]*<h3[^>]*id="參考來源"/);
    expect(await render('## 進階（補充）\n補充\n### 參考來源\n來源')).toMatch(/<\/section>\s*<h3[^>]*id="參考來源"/);
  });
  for (const opening of [':::supplement', ':::supplement[文字]', ':::supplement[來源： ]']) it(`拒絕 ${opening}`, async () => {
    await expect(render(`${opening}\n補充\n:::`)).rejects.toThrow();
  });
  it('拒絕未閉合補充', async () => { await expect(render(':::supplement[來源：文件]\n補充')).rejects.toThrow('缺少'); });
});
