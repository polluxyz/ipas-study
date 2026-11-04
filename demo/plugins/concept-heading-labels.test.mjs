/** 透過安裝的 Astro 擷取器驗證顯示名稱與目錄，同時保護來源錨點、行內格式和非目標文字。 */
import { describe, expect, it } from 'vitest';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { conceptHeadingLabels } from './concept-heading-labels.mjs';
import { supplementSections } from './supplement.mjs';

const fileURL = new URL('../../content/concepts/accuracy.md', import.meta.url);
async function render(markdown, { path = fileURL, before = [] } = {}) {
  const processor = await createMarkdownProcessor({ rehypePlugins: [...before, supplementSections, conceptHeadingLabels] });
  return processor.render(markdown, { fileURL: path });
}

describe('概念小節顯示名稱', () => {
  it('正式設定的 Markdown 外掛鏈輸出新名稱與舊錨點', async () => {
    const { default: config } = await import('../astro.config.mjs');
    const processor = await config.markdown.processor.createRenderer({});
    const result = await processor.render('## 直覺（補充）\n\n正文中的直覺保持原文。', { fileURL });
    expect(result.code).toContain('<h2 id="直覺補充">概念說明（補充）</h2>');
    expect(result.code).toContain('正文中的直覺保持原文。');
    expect(result.metadata.headings).toEqual([{ depth: 2, slug: '直覺補充', text: '概念說明（補充）' }]);
  });

  it('本文與最後擷取的目錄一致，保留一般及補充錨點', async () => {
    const { code, metadata } = await render('## 直覺\n\n正文。\n\n## 直覺（補充）\n\n補充正文。');
    expect(code).toContain('<h2 id="直覺">概念說明</h2>');
    expect(code).toContain('<h2 id="直覺補充">概念說明（補充）</h2>');
    expect(code).toContain('data-supplement-kind="section"');
    expect(metadata.headings).toEqual([
      { depth: 2, slug: '直覺', text: '概念說明' },
      { depth: 2, slug: '直覺補充', text: '概念說明（補充）' },
    ]);
  });

  it('保留明確指定的 ID、屬性及連結語意', async () => {
    const assignId = () => (tree) => {
      const heading = tree.children.find((node) => node.tagName === 'h2');
      heading.properties = { id: 'existing-anchor', className: ['keep'] };
    };
    const { code, metadata } = await render('## [直覺](#old-reference)（補充）', { before: [assignId] });
    expect(code).toContain('<h2 id="existing-anchor" class="keep"><a href="#old-reference">概念說明</a>（補充）</h2>');
    expect(metadata.headings).toEqual([{ depth: 2, slug: 'existing-anchor', text: '概念說明（補充）' }]);
  });

  it('保留巢狀格式，名稱跨文字節點也只替換一次', async () => {
    const { code, metadata } = await render('### **直**覺（補充）');
    expect(code).toContain('<h3 id="直覺補充"><strong>概念說明</strong>（補充）</h3>');
    expect(metadata.headings).toEqual([{ depth: 3, slug: '直覺補充', text: '概念說明（補充）' }]);
  });

  it('保留全部原有重複標題 ID，不與既有新名稱合併', async () => {
    const { metadata } = await render('## 直覺\n\n## 概念說明\n\n## 直覺\n\n## 直覺（補充）（延伸）');
    expect(metadata.headings).toEqual([
      { depth: 2, slug: '直覺', text: '概念說明' },
      { depth: 2, slug: '概念說明', text: '概念說明' },
      { depth: 2, slug: '直覺-1', text: '概念說明' },
      { depth: 2, slug: '直覺補充延伸', text: '概念說明（補充）（延伸）' },
    ]);
  });

  it('一般正文、連結、程式碼及非完整小節名稱完全不變', async () => {
    const source = '# 直覺\n\n## 建立直覺\n\n直覺是正文。[直覺](#直覺)。`直覺`\n\n## 直覺與公式\n\n## 直覺（補充）之後\n\n```md\n## 直覺\n```';
    const baseline = await (await createMarkdownProcessor()).render(source, { fileURL });
    expect(await render(source)).toEqual(baseline);
  });

  for (const path of [undefined, new URL('../../content/codes/L23303.md', import.meta.url), new URL('../../content/concepts-other/example.md', import.meta.url)]) {
    it(`不轉換其他集合或未知來源：${path ?? 'unknown'}`, async () => {
      const processor = await createMarkdownProcessor({ rehypePlugins: [conceptHeadingLabels] });
      const result = await processor.render('## 直覺', { fileURL: path });
      expect(result.code).toBe('<h2 id="直覺">直覺</h2>');
      expect(result.metadata.headings[0].text).toBe('直覺');
    });
  }

  it('支援 Windows 路徑與重複執行，保留標題首尾空白', () => {
    const heading = { type: 'element', tagName: 'h2', properties: { id: 'keep' }, children: [{ type: 'text', value: ' 直覺（補充） ' }] };
    const tree = { type: 'root', children: [heading] };
    const file = { path: 'E:\\repo\\content\\concepts\\example.md', data: {}, history: [] };
    const transform = conceptHeadingLabels();
    transform(tree, file);
    const once = structuredClone(tree);
    transform(tree, file);
    expect(tree).toEqual(once);
    expect(heading.children[0].value).toBe(' 概念說明（補充） ');
    expect(heading.properties.id).toBe('keep');
    expect(file.data.astro.headings[0]).toEqual({ depth: 2, slug: 'keep', text: ' 概念說明（補充） ' });
  });
});
