/** 以真實題目及合成欄位驗證輸出 HTML 結構與資料，不依賴元件原始碼字串。 */
import { mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';
import { renderQuestionMarkdown } from './question-markdown';

// 沿用 Markdown 處理器本身的 HTML parser，避免增加測試依賴。
const requireFromMarkdown = createRequire(import.meta.resolve('@astrojs/markdown-remark'));
const { fromHtml } = await import(pathToFileURL(requireFromMarkdown.resolve('hast-util-from-html')).href);
type Node = { type: string; tagName?: string; value?: string; properties?: Record<string, unknown>; children?: Node[] };
const tree = (html: string): Node => fromHtml(html, { fragment: true });
function all(node: Node, tag: string): Node[] {
  return [...(node.tagName === tag ? [node] : []), ...(node.children ?? []).flatMap((child) => all(child, tag))];
}
function textOf(node: Node): string { return node.value ?? (node.children ?? []).map(textOf).join(''); }

describe('題目 Markdown', () => {
  it('相同題目重渲染會反映概念詞彙更新，並重新驗證歧義', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ipas-question-links-'));
    const save = (name: string, id: string, title: string, alias: string) => {
      const path = join(dir, name);
      writeFileSync(path, `---\nid: ${id}\ntitle: ${title}\naliases: [${alias}]\n---\n`);
      // 明確改變時間，避免檔案系統時間精度影響快取失效測試。
      utimesSync(path, new Date('2020-01-01'), new Date('2020-01-01'));
    };
    save('one.md', 'one', '舊標題', 'Alpha');
    vi.resetModules();
    vi.doMock('../../plugins/wiki-links.mjs', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../../plugins/wiki-links.mjs')>();
      return { default: () => actual.default({ folder: dir }) };
    });
    try {
      const { renderQuestionMarkdown: render } = await import('./question-markdown');
      const source = 'Alpha Alpha Delta Delta [[one]] **粗體** $x^2$';
      const first = tree(await render(source));
      const repeat = tree(await render(source));
      const links = (node: Node) => all(node, 'a').map((link) => [link.properties?.href, textOf(link)]);
      expect(links(first)).toEqual([['/concepts/one/', 'Alpha'], ['/concepts/one/', '舊標題']]);
      expect(links(repeat)).toEqual(links(first));
      save('one.md', 'one', '新標題', 'Delta');
      const updated = tree(await render(source));
      expect(links(updated)).toEqual([['/concepts/one/', 'Delta'], ['/concepts/one/', '新標題']]);
      expect(textOf(all(updated, 'strong')[0])).toBe('粗體');
      expect(all(updated, 'annotation').map(textOf)).toContain('x^2');
      save('two.md', 'two', '另一概念', 'Delta');
      await expect(render(source)).rejects.toThrow(/歧義.*[\s\S]*Delta/);
      await expect(render(source)).rejects.toThrow(/歧義.*[\s\S]*Delta/);
      save('two.md', 'two', '另一概念', 'Bravo');
      expect(links(tree(await render(source)))).toEqual(links(updated));
    } finally {
      vi.doUnmock('../../plugins/wiki-links.mjs');
      vi.resetModules();
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30000);

  it('真實 Q49 保留五段程式、三張表及每個儲存格，獨立 code 不被併入 stem', async () => {
    const q = parse(readFileSync('../content/questions/exam/114-2/114-2-S3-Q49.yaml', 'utf8'));
    const ast = tree(await renderQuestionMarkdown(q.stem));
    const codes = all(ast, 'pre');
    expect(codes).toHaveLength(5);
    expect(codes.map(textOf)).toEqual([...q.stem.matchAll(/```(?:python|text)\n([\s\S]*?)```/g)].map((match) => match[1].replace(/\n$/, '')));
    expect(codes.map((node) => node.properties?.dataLanguage)).toEqual(['python', 'python', 'python', 'python', 'text']);
    const tables = all(ast, 'table');
    expect(tables).toHaveLength(3);
    const sourceTables = q.stem.split('\n\n').filter((block: string) => /^\|/m.test(block));
    for (const [index, table] of tables.entries()) {
      const expected = sourceTables[index].split('\n').filter((line: string) => /^\|/.test(line) && !/^\|[-| ]+\|$/.test(line)).flatMap((line: string) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
      const cells = [...all(table, 'th'), ...all(table, 'td')].map(textOf);
      expect(cells).toEqual(expected);
    }
    expect(textOf(ast)).not.toContain('model.compile');
    expect(q.code).toContain('model.compile');
    const option = tree(await renderQuestionMarkdown(q.options.A));
    expect(all(option, 'annotation').map(textOf)).toContain('f(x)=\\frac{1}{1+e^{-x}}');
    expect(all(option, 'p')).toHaveLength(1);
    const explanation = tree(await renderQuestionMarkdown(q.explanation.correct));
    expect(all(explanation, 'code').map(textOf)).toContain('dataset_train[:, 0:9]');
    expect(all(explanation, 'a').some((node) => node.properties?.href === 'https://keras.io/api/layers/core_layers/dense/')).toBe(true);
  }, 30000);

  it('文字、選項、解析與規則可包含區塊、公式、連結及補充', async () => {
    const fields = [
      '一般純文字',
      '**選項**\n\n```python\nprint(42)\n```',
      '解析 $x^2$\n\n| 欄位 | 值 |\n| --- | --- |\n| A | 42 |',
      ':::supplement[來源：測試]\n規則 [[roc-auc]]\n:::',
    ];
    const [plain, option, explanation, rule] = await Promise.all(fields.map(async (field) => tree(await renderQuestionMarkdown(field))));
    expect(textOf(plain)).toBe('一般純文字');
    expect(textOf(all(option, 'strong')[0])).toBe('選項');
    expect(textOf(all(option, 'pre')[0])).toBe('print(42)');
    expect(all(explanation, 'annotation').map(textOf)).toContain('x^2');
    expect(all(explanation, 'td').map(textOf)).toEqual(['A', '42']);
    expect(all(rule, 'div').some((node) => String(node.properties?.className).includes('textbook-supplement'))).toBe(true);
    expect(all(rule, 'a').some((node) => node.properties?.href === '/concepts/roc-auc/')).toBe(true);
  }, 30000);
});
