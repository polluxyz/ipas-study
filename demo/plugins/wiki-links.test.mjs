/** 用隔離的概念資料與真正 Markdown 管線，驗證連結規則及公式、提示框的 AST 邊界。 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { stringify } from 'yaml';
import remarkMath from 'remark-math';
import wikiLinks from './wiki-links.mjs';
import asides from './asides.mjs';

let folder, processor;
const fixtures = [
  { id: 'recall', title: '召回率', aliases: ['Recall', 'recall', 'TPR', 'TP'] },
  { id: 'confusion-matrix', title: '混淆矩陣', aliases: ['Confusion Matrix'] },
  { id: 'roc-auc', title: 'ROC 曲線與 AUC', aliases: ['ROC', 'AUC', 'ROC-AUC'] },
  { id: 'pr-auc', title: 'PR 曲線與面積', aliases: ['PR-AUC'] },
  { id: 'f1-score', title: 'F1 分數', aliases: ['F1', 'F'] },
  { id: 'k-fold', title: 'K 折交叉驗證', aliases: ['K-fold'] },
  { id: 'artificial-intelligence', title: 'AI', aliases: ['ML'] },
];
async function render(markdown, id) {
  return (await processor.render(markdown, { frontmatter: id ? { id } : {}, fileURL: pathToFileURL(join(folder, `${id ?? 'other'}.md`)) })).code;
}
function autoLinks(html) { return [...html.matchAll(/<a\b[^>]*data-auto-concept-link[^>]*>.*?<\/a>/g)].map(([link]) => link); }
beforeAll(async () => {
  folder = mkdtempSync(join(tmpdir(), 'ipas-wiki-'));
  for (const data of fixtures) writeFileSync(join(folder, `${data.id}.md`), `---\n${stringify(data)}---\n`);
  processor = await createMarkdownProcessor({ remarkPlugins: [asides, remarkMath, [wikiLinks, { folder }]], syntaxHighlight: false });
});
afterAll(() => { if (folder) rmSync(folder, { recursive: true, force: true }); });

describe('概念連結', () => {
  it('補充區塊內保留概念自動連結與手動連結', async () => {
    const html = await render(':::supplement[來源：外部文件]\n混淆矩陣與 [[recall]]。\n:::');
    expect(autoLinks(html)).toHaveLength(1);
    expect(html).toContain('href="/concepts/confusion-matrix/"');
    expect(html).toContain('>召回率</a>');
    expect(html).toContain('class="supplement-source">來源：外部文件');
  });
  it('所有手動 ID、標題、別名都顯示標題，包括沒有連字號的 recall', async () => {
    const html = await render('[[recall]]、[[Recall]]、[[召回率]]、[[pr-auc]]');
    expect(html.match(/>召回率<\/a>/g)).toHaveLength(3);
    expect(html).toContain('>PR 曲線與面積</a>');
    expect(autoLinks(html)).toHaveLength(0);
  });
  it('自動連結保留原字、大小寫與中文別名', async () => {
    const html = await render('混淆矩陣與 rEcAlL');
    expect(autoLinks(html)).toHaveLength(2);
    expect(html).toContain('>混淆矩陣</a>'); expect(html).toContain('>rEcAlL</a>');
  });
  it('長詞優先，重複的 PR-AUC 不拆成 AUC', async () => {
    const html = await render('PR-AUC、PR-AUC、AUC');
    expect(autoLinks(html)).toHaveLength(2);
    expect(html).toMatch(/href="\/concepts\/pr-auc\/"[^>]*>PR-AUC<\/a>、PR-AUC、<a/);
    expect(html).toMatch(/href="\/concepts\/roc-auc\/"[^>]*>AUC<\/a>/);
  });
  it('本頁的長詞也不拆成其他概念', async () => {
    expect(autoLinks(await render('PR-AUC、PR-AUC', 'pr-auc'))).toHaveLength(0);
  });
  it('英文整詞相符，不連到長英文單字、數字或底線內部', async () => {
    const html = await render('preRecall RecallSuffix Recall2 x_Recall 2Recall Recall_x，Recall。');
    expect(autoLinks(html)).toHaveLength(1); expect(html).toContain('>Recall</a>。');
  });
  it('兩字元以下英文別名跳過，但完整標題和三字元別名可用', async () => {
    expect(autoLinks(await render('TP F1 F'))).toHaveLength(0);
    expect(autoLinks(await render('TPR F1 分數'))).toHaveLength(2);
    expect(autoLinks(await render('AI ML'))).toHaveLength(1);
  });
  it('不對 ID 自動連結，也不連不存在頁面的概念', async () => {
    expect(autoLinks(await render('confusion-matrix ndcg NDCG'))).toHaveLength(0);
    await expect(render('[[ndcg]]')).rejects.toThrow('找不到目標');
  });
  it('每個二級標題重設一次，三級標題不重設，別名共用概念次數', async () => {
    const html = await render('## 第一節\n\n混淆矩陣 Recall 召回率\n\n### 補充\n\n混淆矩陣 Recall\n\n## 第二節\n\n混淆矩陣 Recall');
    expect(autoLinks(html)).toHaveLength(4);
  });
  it('不自動連結標題，標題也不消耗正文的首次提及', async () => {
    const html = await render('## 混淆矩陣\n\n混淆矩陣');
    expect(html).toMatch(/<h2[^>]*>混淆矩陣<\/h2>/);
    expect(autoLinks(html)).toHaveLength(1);
  });
  it('公式、程式碼、既有連結和圖片說明保持原樣', async () => {
    const html = await render('`Recall`\n\n```text\n混淆矩陣\n```\n\n$Recall$\n\n$$\n混淆矩陣\n$$\n\n[混淆矩陣](https://example.test)\n\n[Recall][ref]\n\n[ref]: https://example.test\n\n![混淆矩陣](example.png)\n\n混淆矩陣 Recall');
    expect(autoLinks(html)).toHaveLength(2);
    expect(html).toContain('<code>Recall</code>');
    expect(html).toContain('class="language-math math-inline">Recall');
    expect(html).toContain('<a href="https://example.test">混淆矩陣</a>');
    expect(html).not.toMatch(/<a[^>]*><a/);
  });
  it('既有概念連結與手動連結會占用該節的首次連結', async () => {
    const html = await render('[[recall]] Recall\n\n[混淆矩陣](/concepts/confusion-matrix/) 混淆矩陣');
    expect(autoLinks(html)).toHaveLength(0);
  });
  it('參照式概念連結也會占用該節的首次連結', async () => {
    expect(autoLinks(await render('[召回率][recall-page] Recall\n\n[recall-page]: /concepts/recall/'))).toHaveLength(0);
  });
  it('原生行內 HTML 連結和程式碼內不插入連結', async () => {
    const html = await render('<a href="/other/">**Recall** 混淆矩陣</a> <code>Recall</code> Recall');
    expect(html).toContain('<a href="/other/"><strong>Recall</strong> 混淆矩陣</a>');
    expect(html).toContain('<code>Recall</code>');
    expect(autoLinks(html)).toHaveLength(1);
  });
  it('不連結本頁標題或別名，仍保留明確的手動連結', async () => {
    const html = await render('召回率 Recall [[recall]] 混淆矩陣', 'recall');
    expect(autoLinks(html)).toHaveLength(1); expect(html).toContain('>召回率</a>');
  });
  it('沒有 frontmatter 時仍從來源路徑辨認本頁', () => {
    const tree = { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', value: '召回率 Recall' }] }] };
    wikiLinks({ folder })(tree, { path: join(folder, 'recall.md') });
    expect(tree.children[0].children.every((child) => child.type === 'text')).toBe(true);
  });
  it('提示框標題不連結，框內正文的首次提及仍連結', async () => {
    const html = await render(':::tip[混淆矩陣]\n混淆矩陣 Recall\n:::');
    expect(html).toContain('class="starlight-aside__title">混淆矩陣</p>');
    expect(autoLinks(html)).toHaveLength(2);
  });
  it('混合中英標題的大小寫相符不會破壞查表', async () => {
    expect(autoLinks(await render('k 折交叉驗證'))).toHaveLength(1);
  });
  it('歧義會報出詞與所有概念，即使正文沒提到；同一概念的重複別名可用', () => {
    const tree = { type: 'root', children: [] };
    const extra = join(folder, 'ambiguous.md');
    writeFileSync(extra, `---\n${stringify({ id: 'other', title: '其他', aliases: ['Recall', 'AUC'] })}---\n`);
    try {
      expect(() => wikiLinks({ folder })(tree)).toThrow(/Recall.*recall.*other|Recall.*other.*recall/);
      expect(() => wikiLinks({ folder })(tree)).toThrow(/AUC.*other.*roc-auc|AUC.*roc-auc.*other/);
    } finally { rmSync(extra); }
    expect(() => wikiLinks({ folder })(tree)).not.toThrow();
  });
});
