/** 速查 fixture 同時驗證通過／失敗與建置使用的連結轉換，並測試 CLI 確實納入新目錄。 */
import { describe, expect, it } from 'vitest';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkCheatsheet, cheatsheetConceptIndex } from './cheatsheet.mjs';
import { checkTextbook } from './index.mjs';
import { cheatsheetAnchor, normalizeCheatsheetLinks } from '../../src/lib/cheatsheets.mjs';
const fixture = (name) => readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const concepts = new Map([
  ['precision', [{ text: '定義與公式', slug: '定義與公式' }, { text: '怎麼用、怎麼判讀', slug: '怎麼用怎麼判讀' }]],
  ['pr-auc', [{ text: '定義與公式（補充）', slug: '定義與公式補充' }, { text: '怎麼用、怎麼判讀（補充）', slug: '怎麼用怎麼判讀補充' }]],
  ['overfitting', [{ text: '怎麼用、怎麼判讀', slug: '怎麼用怎麼判讀' }]],
]);
describe('T10 評鑑代碼速查', () => {
  it('通過 fixture 的三個標題、公式、補充項與所有教材連結', async () => {
    expect(await checkCheatsheet(await fixture('cheatsheets/L23303.md'), 'pass.md', concepts)).toEqual([]);
  });
  it('失敗 fixture 回報錯序／額外標題、缺少概念／錨點、非法連結與考題資訊', async () => {
    const issues = await checkCheatsheet(await fixture('T10-fail.md'), 'fail.md', concepts);
    expect(issues).toHaveLength(6);
    expect(issues.every((issue) => issue.rule === 'T10' && issue.line > 0 && issue.severity === 'error')).toBe(true);
    for (const text of ['二級標題', '概念 ID 不存在', '錨點不存在', '必須指向', '考題 ID']) expect(issues.some((issue) => issue.message.includes(text))).toBe(true);
  });
  it('驗證 frontmatter、缺少／重複標題、參照式連結與 HTML 連結', async () => {
    const pass = await fixture('cheatsheets/L23303.md');
    for (const source of [pass.replace('code: L23303', 'code: XXX'), pass.replace('title: 模型訓練、評估與驗證 速查', 'title: ""'), pass.replace('## 診斷', ''), pass + '\n## 診斷', pass + '\n[壞連結][target]\n\n[target]: /concepts/missing/#直覺', pass + '\n<a href="/concepts/precision/#不存在">壞連結</a>']) {
      expect((await checkCheatsheet(source, 'bad.md', concepts)).length, source).toBeGreaterThan(0);
    }
    expect((await checkCheatsheet('---\ncode: [\n---', 'bad.md', concepts))[0].rule).toBe('T10');
  });
  it('沿用 T1，不能用「相關考題」區豁免速查引用', async () => {
    const pass = await fixture('cheatsheets/L23303.md');
    for (const text of ['第一題', '第 3～5 題', '115-1 科3', '115-1-S1-Q08', '### 相關考題\n[115-1-S3-Q44](/questions/115-1-S3-Q44/)']) {
      expect((await checkCheatsheet(pass + '\n' + text, 'bad.md', concepts)).some((issue) => issue.message.includes('考題 ID'))).toBe(true);
    }
  });
  it('取 Astro 實際標題，去空白與標點後轉成正確 slug，支援百分比編碼', async () => {
    const source = '---\nid: sample\n---\n## 怎麼用、怎麼判讀（補充）\n### A B：比較（補充）';
    const index = await cheatsheetConceptIndex([{ source }]);
    expect(cheatsheetAnchor('A B：比較（補充）')).toBe('ab比較補充');
    const heading = index.get('sample')[1];
    const href = '/concepts/sample/#' + encodeURIComponent('AB比較補充');
    expect(normalizeCheatsheetLinks(`<a href="${href}">教材</a>`, index)).toContain(`href="/concepts/sample/#${heading.slug}"`);
    expect(normalizeCheatsheetLinks('<a href="/codes/L23303/">返回</a>', index)).toContain('/codes/L23303/');
    expect(normalizeCheatsheetLinks('<a href="/concepts/sample/" data-auto-concept-link>名詞</a>', index)).toBe('名詞');
    expect(normalizeCheatsheetLinks('<a data-auto-concept-link="" href="/concepts/sample/">名詞</a>', index)).toBe('名詞');
    expect(() => normalizeCheatsheetLinks('<a href="/concepts/sample/#不存在">教材</a>', index)).toThrow('唯一小節');
  });
  it('沒有速查目錄時不產生錯誤；有速查目錄時整合進報告', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'cheatsheets-'));
    try {
      await mkdir(join(folder, 'concepts'));
      const source = await fixture('pass.md');
      await writeFile(join(folder, 'concepts/sample.md'), source);
      expect((await checkTextbook({ contentDir: folder })).cheatsheets).toBe(0);
      await mkdir(join(folder, 'cheatsheets'));
      await writeFile(join(folder, 'cheatsheets/L23303.md'), await fixture('T10-fail.md'));
      const report = await checkTextbook({ contentDir: folder });
      expect(report.cheatsheets).toBe(1);
      expect(report.summary.rules.T10.errors).toBeGreaterThan(0);
    } finally { await rm(folder, { recursive: true, force: true }); }
  });
});
