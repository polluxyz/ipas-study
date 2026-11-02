/** 實測工具採注入執行器驗證比對、同頁共用與錯誤報告，測試不啟動 uv 或連線。 */
import { describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildPageProgram, compareOutput, formatRunReport, main, normalizeOutput, runFiles } from '../../../scripts/tools/run-code.mjs';

describe('stdout 逐行比對', () => {
  it('忽略行尾空白、CRLF 與一個結尾換行；保留繁體中文', () => {
    expect(compareOutput('訓練 1\n驗證 2', '訓練 1  \r\n驗證 2\t\r\n')).toEqual({ passed: true, differences: [] });
    expect(normalizeOutput('')).toEqual([]);
    expect(compareOutput('', '')).toEqual({ passed: true, differences: [] });
  });
  it('行首空白、內部空白與空白行仍有意義，逐行附上缺行與多行', () => {
    expect(compareOutput(' x\na b', 'x\na  b').differences).toEqual([{ line: 1, expected: ' x', actual: 'x' }, { line: 2, expected: 'a b', actual: 'a  b' }]);
    expect(compareOutput('a\n\nb', 'a\nb').passed).toBe(false);
    expect(compareOutput('a\nb', 'a').differences[0]).toEqual({ line: 2, expected: 'b', actual: null });
    expect(compareOutput('a', 'a\n\n').differences[0]).toEqual({ line: 2, expected: null, actual: '' });
  });
});

describe('同頁依序執行與報告', () => {
  const page = '```python\nx = 1\nprint(x)\n```\n```text\n1\n```\n\n```python\nprint(x + 1)\n```\n```text\n2\n```\n\n```python\nprint(x + 2)\n```\n```text\n3\n```';
  function fake(records, tail = {}) {
    return async (code) => {
      const marker = code.match(/print\('(TEXTBOOK_[^']+)'/)[1];
      return { stdout: records.map((record) => marker + JSON.stringify(record)).join('\n'), stderr: '', exitCode: 0, ...tail };
    };
  }
  async function withPage(task, source = page) {
    const folder = await mkdtemp(join(tmpdir(), 'run-code-test-'));
    try { const file = join(folder, 'sample.md'); await writeFile(file, source); await task(file, folder); }
    finally { await rm(folder, { recursive: true, force: true }); }
  }
  it('串成同頁一個行程，保留後段參照前段變數的程式與獨立輸出', async () => {
    await withPage(async (file) => {
      let calls = 0;
      const executor = fake([0, 1, 2].map((index) => ({ index, stdout: `${index + 1}\n`, stderr: '', failed: false })));
      const result = await runFiles([file], { execute: async (code, options) => { calls++; expect(options.timeout).toBe(120); return executor(code); } });
      expect(calls).toBe(1);
      expect(result.map((row) => row.status)).toEqual(['通過', '通過', '通過']);
      expect(result.map((row) => row.line)).toEqual([1, 9, 16]);
      expect(formatRunReport(result)).toContain('通過 3；不符 0；執行失敗 0');
    });
  });
  it('某段例外後該段與後續均標為失敗，之前的結果保留', async () => {
    await withPage(async (file) => {
      const result = await runFiles([file], { execute: fake([{ index: 0, stdout: '1\n', stderr: '', failed: false }, { index: 1, stdout: '', stderr: 'NameError: x', failed: true }]) });
      expect(result.map((row) => row.status)).toEqual(['通過', '執行失敗', '執行失敗']);
      expect(result[2].failure).toContain('後續未執行');
      expect(formatRunReport(result)).toContain('NameError: x');
    });
  });
  it('輸出不符仍執行後段，報告有 diff 與 stderr 摘要', async () => {
    await withPage(async (file) => {
      const result = await runFiles([file], { execute: fake([{ index: 0, stdout: '錯誤\n', stderr: '警告', failed: false }, { index: 1, stdout: '2\n', failed: false }, { index: 2, stdout: '3\n', failed: false }]) });
      expect(result.map((row) => row.status)).toEqual(['不符', '通過', '通過']);
      expect(formatRunReport(result)).toContain('- 1\n+ 錯誤');
      expect(formatRunReport(result)).toContain('警告');
    });
  });
  it('缺輸出、缺 uv、逾時、無 Python 都能產出明確狀態', async () => {
    await withPage(async (file) => {
      const missing = await runFiles([file], { execute: fake([{ index: 0, stdout: '1\n', failed: false }]) });
      expect(missing[0]).toMatchObject({ status: '不符', expected: null });
      const timeout = await runFiles([file], { execute: fake([], { timedOut: true, exitCode: null }) });
      expect(timeout[0]).toMatchObject({ status: '執行失敗', timedOut: true });
      const failed = await runFiles([file], { execute: async () => { throw new Error('spawn uv ENOENT'); } });
      expect(failed[0].failure).toBe('spawn uv ENOENT');
    }, '```python\nprint(1)\n```');
    await withPage(async (file) => { expect((await runFiles([file]))[0].status).toBe('無程式'); }, '說明。');
  });
  it('每頁各呼叫一次執行器，不會把另一頁的變數一起串入', async () => {
    await withPage(async (file, folder) => {
      const second = join(folder, 'second.md'); await writeFile(second, '```python\nprint(99)\n```\n```text\n99\n```');
      let calls = 0;
      await runFiles([file, second], { execute: async (code) => { calls++; return fake([])(code); } });
      expect(calls).toBe(2);
    });
  });
  it('行程在所有區塊完成後以非零結束碼退出，最後一段仍列為執行失敗', async () => {
    await withPage(async (file) => {
      const result = await runFiles([file], { execute: fake([0, 1, 2].map((index) => ({ index, stdout: `${index + 1}\n`, failed: false })), { exitCode: 1, stderr: 'atexit failure' }) });
      expect(result.map((row) => row.status)).toEqual(['通過', '通過', '執行失敗']);
    });
  });
  it('序列化程式碼與分隔符號，不把教材字串直接插入包裝器', () => {
    const first = buildPageProgram([{ line: 4, code: 'print("敏感字串")' }]);
    expect(first.code).not.toContain('敏感字串');
    expect(first.code).toContain('except BaseException:');
    expect(first.code).toContain("'__name__': '__main__'");
    expect(buildPageProgram([]).marker).not.toBe(first.marker);
  });
  it('CLI help、必要參數與 timeout 驗證不會執行 uv', async () => {
    let output = ''; const io = { stdout: { write: (value) => { output += value; } }, stderr: { write: (value) => { output += value; } } };
    expect(await main(['--help'], io)).toBe(0);
    for (const args of [[], ['x.md', '--out', 'x.md'], ['x.md', '--out'], ['x.md', '--out', 'o.md', '--timeout', '0'], ['x.md', '--out', 'o.md', '--timeout', 'NaN']]) expect(await main(args, io)).toBe(2);
    expect(output).toContain('用法');
  });
  it('匯入 run-code 無掃描與執行副作用', () => {
    const url = new URL('../../../scripts/tools/run-code.mjs', import.meta.url).href;
    const run = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(url)})`], { cwd: tmpdir(), encoding: 'utf8' });
    expect(run.status).toBe(0); expect(run.stdout).toBe(''); expect(run.stderr).toBe('');
  });
});
