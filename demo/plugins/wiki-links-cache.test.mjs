/** 使用真實檔案與轉換流程計數讀取、解析，驗證快取更新與頁面狀態隔離。 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readdirSync, renameSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';

const counts = vi.hoisted(() => ({ active: false, reads: 0, parses: 0 }));
vi.mock('node:fs', async (importOriginal) => {
  const fs = await importOriginal();
  return { ...fs, readFileSync: (...args) => { if (counts.active) counts.reads++; return fs.readFileSync(...args); } };
});
vi.mock('yaml', async (importOriginal) => {
  const yaml = await importOriginal();
  return { ...yaml, parse: (...args) => { if (counts.active) counts.parses++; return yaml.parse(...args); } };
});
import wikiLinks from './wiki-links.mjs';

const folders = [];
function folder() {
  const result = mkdtempSync(join(tmpdir(), 'ipas-wiki-cache-'));
  folders.push(result);
  return result;
}
function save(dir, name, id, title, alias) {
  writeFileSync(join(dir, name), `---\nid: ${id}\ntitle: ${title}\naliases: [${alias}]\n---\n`);
}
function tree(text) {
  return { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', value: text }] }] };
}
function run(transform, text, file) {
  const result = tree(text);
  transform(result, file);
  return result.children[0].children;
}
function measure(fn) {
  counts.reads = 0; counts.parses = 0; counts.active = true;
  try { fn(); return { reads: counts.reads, parses: counts.parses }; }
  finally { counts.active = false; }
}
afterEach(() => { for (const dir of folders.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe('概念詞彙表快取', () => {
  it('真實概念資料在同一 Markdown processor 重複渲染時只讀取及解析一次', async () => {
    const dir = fileURLToPath(new URL('../../content/concepts/', import.meta.url));
    const total = readdirSync(dir).filter((name) => name.endsWith('.md')).length;
    const processor = await createMarkdownProcessor({ remarkPlugins: [[wikiLinks, { folder: resolve(dir) }]], syntaxHighlight: false });
    counts.reads = 0; counts.parses = 0; counts.active = true;
    try {
      const first = (await processor.render('準確率 [[accuracy]]')).code;
      expect({ reads: counts.reads, parses: counts.parses }).toEqual({ reads: total, parses: total });
      counts.reads = 0; counts.parses = 0;
      for (let i = 0; i < 5; i++) expect((await processor.render('準確率 [[accuracy]]')).code).toBe(first);
      expect({ reads: counts.reads, parses: counts.parses }).toEqual({ reads: 0, parses: 0 });
      expect(first).toContain('data-auto-concept-link');
      expect(first).toContain('href="/concepts/accuracy/"');
      console.log(`真實資料 ${total} 檔：首次讀取／解析各 ${total} 次；後續 5 次渲染各 0 次。`);
    } finally { counts.active = false; }
  });

  it('首次轉換才讀取及解析，後續重用，且每次轉換獨立計算首次連結', () => {
    const dir = folder();
    save(dir, 'one.md', 'one', '第一概念', 'Alpha');
    save(dir, 'two.md', 'two', '第二概念', 'Bravo');
    let transform;
    expect(measure(() => { transform = wikiLinks({ folder: dir }); })).toEqual({ reads: 0, parses: 0 });
    let first, second;
    expect(measure(() => { first = run(transform, 'Alpha Alpha [[two]]'); })).toEqual({ reads: 2, parses: 2 });
    expect(measure(() => { second = run(transform, 'Alpha Alpha [[two]]'); })).toEqual({ reads: 0, parses: 0 });
    expect(second).toEqual(first);
    expect(first.filter((node) => node.type === 'link').map((node) => node.url)).toEqual(['/concepts/one/', '/concepts/two/']);
  });

  it('儲存同長度別名、增加、刪除與更名均更新資料，只重讀變動檔案', () => {
    const dir = folder();
    save(dir, 'one.md', 'one', '第一概念', 'Alpha');
    save(dir, 'two.md', 'two', '第二概念', 'Bravo');
    const transform = wikiLinks({ folder: dir });
    run(transform, 'Alpha');
    const path = join(dir, 'one.md');
    const size = statSync(path).size;
    save(dir, 'one.md', 'one', '第一概念', 'Delta');
    expect(statSync(path).size).toBe(size);
    // 明確設定不同時間，避免檔案系統時間解析度造成測試偶發失敗。
    utimesSync(path, new Date('2020-01-01'), new Date('2020-01-01'));
    expect(measure(() => expect(run(transform, 'Alpha Delta')[1].url).toBe('/concepts/one/'))).toEqual({ reads: 1, parses: 1 });
    save(dir, 'three.md', 'three', '第三概念', 'Gamma');
    expect(measure(() => expect(run(transform, 'Gamma')[0].url).toBe('/concepts/three/'))).toEqual({ reads: 1, parses: 1 });
    rmSync(join(dir, 'two.md'));
    expect(measure(() => expect(run(transform, 'Bravo')[0].type).toBe('text'))).toEqual({ reads: 0, parses: 0 });
    renameSync(join(dir, 'three.md'), join(dir, 'renamed.md'));
    expect(measure(() => expect(run(transform, 'Gamma')[0].url).toBe('/concepts/three/'))).toEqual({ reads: 1, parses: 1 });
    expect(run(transform, 'Gamma', { path: join(dir, 'renamed.md') })[0].type).toBe('text');
  });

  it('歧義即使不在正文也反覆報錯，修復或刪除後恢復', () => {
    const dir = folder();
    save(dir, 'one.md', 'one', '第一概念', 'Alpha');
    save(dir, 'two.md', 'two', '第二概念', 'Bravo');
    const transform = wikiLinks({ folder: dir });
    run(transform, '沒有概念');
    save(dir, 'two.md', 'two', '第二概念', 'Alpha');
    utimesSync(join(dir, 'two.md'), new Date('2020-01-01'), new Date('2020-01-01'));
    expect(() => run(transform, '沒有概念')).toThrow(/Alpha/);
    expect(() => run(transform, '沒有概念')).toThrow(/Alpha/);
    rmSync(join(dir, 'two.md'));
    expect(run(transform, 'Alpha')[0].url).toBe('/concepts/one/');
  });

  it('不同目錄與同目錄的不同 factory 各自隔離', () => {
    const a = folder(), b = folder();
    save(a, 'one.md', 'one', '第一概念', 'Alpha');
    save(b, 'two.md', 'two', '第二概念', 'Alpha');
    const first = wikiLinks({ folder: a }), second = wikiLinks({ folder: b }), third = wikiLinks({ folder: a });
    expect(measure(() => expect(run(first, 'Alpha')[0].url).toBe('/concepts/one/'))).toEqual({ reads: 1, parses: 1 });
    expect(measure(() => expect(run(second, 'Alpha')[0].url).toBe('/concepts/two/'))).toEqual({ reads: 1, parses: 1 });
    expect(measure(() => expect(run(third, 'Alpha')[0].url).toBe('/concepts/one/'))).toEqual({ reads: 1, parses: 1 });
    expect(run(first, 'Alpha', { data: { astro: { frontmatter: { id: 'one' } } } })[0].type).toBe('text');
    expect(run(first, 'Alpha')[0].url).toBe('/concepts/one/');
  });
});
