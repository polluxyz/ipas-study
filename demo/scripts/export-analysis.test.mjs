/** 用小型固定來源驗證資料保留、失敗邊界與發布回復；測試只在本機暫存目錄寫檔。 */
import { beforeAll, afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { buildAnalysis, exportAnalysis, formatSummary, main, parseCsv, serializeCsv, writeAnalysis } from './export-analysis.mjs';

const fixtureDir = fileURLToPath(new URL('../../tests/fixtures/analysis-export/', import.meta.url));
const temporary = [];
let valid;
const invalid = JSON.parse(await fs.readFile(join(fixtureDir, 'fail/cases.json'), 'utf8'));
beforeAll(async () => {
  const folder = join(fixtureDir, 'pass');
  const documents = async name => Promise.all((await fs.readdir(join(folder, name))).map(async filename => ({ path: `${name}/${filename}`, text: await fs.readFile(join(folder, name, filename), 'utf8') })));
  valid = { conceptIndex: await fs.readFile(join(folder, 'concept-index.csv'), 'utf8'), questions: await documents('questions'), concepts: await documents('concepts') };
});
afterEach(async () => {
  // mkdtemp 的回傳路徑固定在系統暫存目錄內，清理前再確認一次範圍。
  for (const dir of temporary.splice(0)) {
    expect(resolve(dir).startsWith(resolve(tmpdir()) + '\\') || resolve(dir).startsWith(resolve(tmpdir()) + '/')).toBe(true);
    await fs.rm(dir, { recursive: true, force: true });
  }
});
async function temp() {
  const dir = await fs.mkdtemp(join(tmpdir(), 'ipas-analysis-export-'));
  temporary.push(dir);
  return dir;
}
function changed(fixture) {
  const result = structuredClone(valid);
  if (fixture.path === 'concept-index.csv') {
    expect(result.conceptIndex).toContain(fixture.find);
    result.conceptIndex = result.conceptIndex.replace(fixture.find, fixture.replace);
  } else {
    const document = [...result.questions, ...result.concepts].find(doc => doc.path === fixture.path);
    expect(document.text).toContain(fixture.find);
    document.text = document.text.replace(fixture.find, fixture.replace);
  }
  return result;
}

describe('分析表的純轉換', () => {
  it('保留官方答案、主碼順序、全部概念標題與跨科頁碼', () => {
    const result = buildAnalysis(valid);
    expect(result.questionsCsv).toBe('場次,科目,題號,答案,代碼,題型,關鍵概念,指引頁碼\n114-2,1,8,C,L23203;L21102,觀念,"乙""定義"";甲,方法;末項;問題\n第二行;乙""定義""",guide-1:3-48;guide-3:4-69;guide-3:5-35\n');
    expect(result.summary).toEqual({ questions: 1, relations: 8, sessions: { '114-2-S1': 1 }, excluded: { mock: 1 }, conceptCountExceptions: ['114-2-S1-Q08'] });
  });
  it('每條來源宣告各列一次，不補來源、不反向推導、不去重來源 token', () => {
    expect(parseCsv(buildAnalysis(valid).relationsCsv)).toEqual([
      ['from_id', 'type', 'to_id', 'note', 'source_refs'],
      ['alpha', 'is_a', 'zeta', '', ''],
      ['alpha', 'part_of', 'beta', '', ''],
      ['alpha', 'requires', 'beta', '', ''],
      ['alpha', 'requires', 'problem', '', ''],
      ['alpha', 'mitigates', 'problem', '保留,逗號與"引號"\n第二行', 'guide-3:5-21;114-2-S1-Q08;guide-1:3-48;guide-3:5-21'],
      ['alpha', 'contrasts', 'beta', '  保留前後空白  ', '114-2-S1-Q08;guide-3:5-21'],
      ['beta', 'contrasts', 'alpha', '方向照來源保留', 'guide-3:5-21'],
      ['zeta', 'mitigates', 'problem', '', 'guide-1:3-48'],
    ]);
  });
  it('mitigates 的選填 note 可為空字串，輸出保持空白', () => {
    const input = changed({ path: 'concepts/zeta.md', find: '    source: [guide-1:3-48]', replace: '    note: ""\n    source: [guide-1:3-48]' });
    expect(parseCsv(buildAnalysis(input).relationsCsv).at(-1)).toEqual(['zeta', 'mitigates', 'problem', '', 'guide-1:3-48']);
  });
  it('場次用數值對排序，科目與題號也用數值排序', () => {
    const input = structuredClone(valid);
    const base = input.questions.find(doc => doc.path === 'questions/exam.yaml');
    for (const [session, subject, number] of [['114-10', 1, 1], ['114-2', 3, 1], ['114-2', 1, 10], ['114-2', 1, 2], ['115-1', 1, 1]]) {
      input.questions.push({ path: `${session}-${subject}-${number}`, text: base.text.replaceAll('114-2-S1-Q08', `${session}-S${subject}-Q${String(number).padStart(2, '0')}`).replace('session: 114-2', `session: ${session}`).replace('subject: 1', `subject: ${subject}`).replace('number: 8', `number: ${number}`) });
    }
    expect(parseCsv(buildAnalysis(input).questionsCsv).slice(1).map(row => row.slice(0, 3))).toEqual([
      ['114-2', '1', '2'], ['114-2', '1', '8'], ['114-2', '1', '10'], ['114-2', '3', '1'], ['114-10', '1', '1'], ['115-1', '1', '1'],
    ]);
  });
  it.each([undefined, []])('未提供或空 guide_refs 留空：%s', refs => {
    const input = changed({ path: 'questions/exam.yaml', find: 'guide_refs: [guide-1:3-48, guide-3:4-69, guide-3:5-35]', replace: refs === undefined ? '' : 'guide_refs: []' });
    expect(parseCsv(buildAnalysis(input).questionsCsv)[1][7]).toBe('');
  });
  it('未審查題目仍輸出；單概念只列摘要', () => {
    const input = changed({ path: 'questions/exam.yaml', find: 'concepts: [beta, alpha, zeta, problem, beta]', replace: 'concepts: [alpha]' });
    input.questions[0].text = input.questions[0].text.replace('review: {status: disputed}', 'review: {status: draft}');
    const result = buildAnalysis(input);
    expect(result.summary.questions).toBe(1);
    expect(result.summary.conceptCountExceptions).toEqual(['114-2-S1-Q08']);
    expect(parseCsv(result.questionsCsv)[1][6]).toBe('甲,方法');
  });
  it('相同輸入與不同讀檔順序產出逐 byte 相同，且不改輸入', () => {
    const original = structuredClone(valid);
    const a = buildAnalysis(valid), b = buildAnalysis(valid);
    const c = buildAnalysis({ ...valid, questions: [...valid.questions].reverse(), concepts: [...valid.concepts].reverse() });
    for (const key of ['questionsCsv', 'relationsCsv']) {
      expect(Buffer.from(a[key]).equals(Buffer.from(b[key]))).toBe(true);
      expect(Buffer.from(a[key]).equals(Buffer.from(c[key]))).toBe(true);
      expect(a[key].startsWith('\uFEFF')).toBe(false);
      expect(a[key].endsWith('\n')).toBe(true);
      expect(a[key].endsWith('\n\n')).toBe(false);
    }
    expect(valid).toEqual(original);
  });
  it('CSV 逗號、引號、CR、LF、空白與空欄可往返', () => {
    const rows = [['逗,號', '雙"引號', '換\n行', 'CR\rLF\r\n', '  空白  ', ''], ['', '', '', '', '', '']];
    expect(parseCsv(serializeCsv(rows))).toEqual(rows);
    expect(parseCsv('\uFEFFid,title\r\na,甲\r\n')).toEqual([['id', 'title'], ['a', '甲']]);
  });
  it('摘要列出排除來源與概念數差異', () => {
    expect(formatSummary(buildAnalysis(valid).summary)).toContain('排除來源：mock=1');
    expect(formatSummary(buildAnalysis(valid).summary)).toContain('概念數不在 2–4：1 題（完整保留）');
  });
  it.each(invalid)('負 fixture：$name；原始正例可通過', fixture => {
    expect(() => buildAnalysis(valid)).not.toThrow();
    expect(() => buildAnalysis(changed(fixture))).toThrow(fixture.error);
  });
  it.each(['questions', 'concepts'])('重複 ID 報錯：%s', key => {
    const input = structuredClone(valid);
    input[key].push(input[key][0]);
    expect(() => buildAnalysis(input)).toThrow('重複');
  });
  it('題目引用的概念頁缺失時報錯', () => {
    const input = { ...valid, concepts: valid.concepts.filter(doc => doc.path !== 'concepts/beta.md') };
    expect(() => buildAnalysis(input)).toThrow('未知概念 beta');
  });
});

describe('讀寫與入口', () => {
  it('讀真 fixture 樹並生成 2 表，重跑逐 byte 相同', async () => {
    const outputDir = join(await temp(), 'analysis');
    const options = { contentDir: join(fixtureDir, 'pass'), outputDir };
    expect(await exportAnalysis(options)).toEqual(buildAnalysis(valid).summary);
    const first = await Promise.all(['questions.csv', 'relations.csv'].map(name => fs.readFile(join(outputDir, name))));
    await exportAnalysis(options);
    const second = await Promise.all(['questions.csv', 'relations.csv'].map(name => fs.readFile(join(outputDir, name))));
    expect(second).toEqual(first);
    expect(await fs.readdir(outputDir)).toEqual(['questions.csv', 'relations.csv']);
  });
  it.each([false, true])('來源失敗不留下半套表，也不改舊表：舊表=%s', async existing => {
    const root = await temp(), contentDir = join(root, 'content'), outputDir = join(root, 'analysis');
    await fs.cp(join(fixtureDir, 'pass'), contentDir, { recursive: true });
    await fs.writeFile(join(contentDir, 'concepts/zeta.md'), '---\nid: zeta\nmitigates: [{target: problem}]\n---\n');
    if (existing) {
      await fs.mkdir(outputDir);
      await fs.writeFile(join(outputDir, 'questions.csv'), '舊題表');
      await fs.writeFile(join(outputDir, 'relations.csv'), '舊關係表');
    }
    await expect(exportAnalysis({ contentDir, outputDir })).rejects.toThrow('source');
    if (existing) {
      expect(await fs.readFile(join(outputDir, 'questions.csv'), 'utf8')).toBe('舊題表');
      expect(await fs.readFile(join(outputDir, 'relations.csv'), 'utf8')).toBe('舊關係表');
    } else await expect(fs.stat(outputDir)).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it.each([false, true])('第 2 表發布失敗時還原第 1 表：舊表=%s', async existing => {
    const outputDir = await temp();
    if (existing) {
      await fs.writeFile(join(outputDir, 'questions.csv'), '舊題表');
      await fs.writeFile(join(outputDir, 'relations.csv'), '舊關係表');
    }
    const io = { ...fs, rename: async (from, to) => {
      if (from.endsWith('relations.csv')) throw new Error('測試模擬第 2 表寫入失敗');
      return fs.rename(from, to);
    } };
    await expect(writeAnalysis(outputDir, buildAnalysis(valid), io)).rejects.toThrow('第 2 表寫入失敗');
    if (existing) {
      expect(await fs.readFile(join(outputDir, 'questions.csv'), 'utf8')).toBe('舊題表');
      expect(await fs.readFile(join(outputDir, 'relations.csv'), 'utf8')).toBe('舊關係表');
      expect(await fs.readdir(outputDir)).toEqual(['questions.csv', 'relations.csv']);
    } else expect(await fs.readdir(outputDir)).toEqual([]);
  });
  it('暫存寫入失敗時不碰任何舊表', async () => {
    const outputDir = await temp();
    await fs.writeFile(join(outputDir, 'questions.csv'), '舊題表');
    await fs.writeFile(join(outputDir, 'relations.csv'), '舊關係表');
    const io = { ...fs, writeFile: async (path, ...args) => {
      if (path.endsWith('relations.csv')) throw new Error('測試模擬暫存寫入失敗');
      return fs.writeFile(path, ...args);
    } };
    await expect(writeAnalysis(outputDir, buildAnalysis(valid), io)).rejects.toThrow('暫存寫入失敗');
    expect(await fs.readFile(join(outputDir, 'questions.csv'), 'utf8')).toBe('舊題表');
    expect(await fs.readFile(join(outputDir, 'relations.csv'), 'utf8')).toBe('舊關係表');
  });
  it('發布與還原皆失敗時保留備份並報錯，不宣稱成功', async () => {
    const outputDir = await temp();
    await fs.writeFile(join(outputDir, 'questions.csv'), '舊題表');
    await fs.writeFile(join(outputDir, 'relations.csv'), '舊關係表');
    const io = { ...fs, rename: async (from, to) => {
      if (from.endsWith('relations.csv') || from.endsWith('.old')) throw new Error('測試模擬裝置拒絕寫入');
      return fs.rename(from, to);
    } };
    await expect(writeAnalysis(outputDir, buildAnalysis(valid), io)).rejects.toThrow('發布與還原皆失敗');
    const staging = (await fs.readdir(outputDir)).find(name => name.startsWith('.analysis-export-'));
    expect(await fs.readFile(join(outputDir, staging, 'questions.csv.old'), 'utf8')).toBe('舊題表');
    expect(await fs.readFile(join(outputDir, staging, 'relations.csv.old'), 'utf8')).toBe('舊關係表');
  });
  it('缺來源檔時不產生輸出', async () => {
    const root = await temp();
    await expect(exportAnalysis({ contentDir: join(root, 'missing'), outputDir: join(root, 'out') })).rejects.toThrow();
    await expect(fs.stat(join(root, 'out'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('在禁用檔案讀寫的子行程匯入兩個模組，沒有副作用', async () => {
    const output = execFileSync(process.execPath, ['--input-type=module', '-e', `
      import * as fs from 'node:fs/promises';
      import { syncBuiltinESMExports } from 'node:module';
      const promiseFs = (await import('node:fs')).default.promises;
      for (const name of ['readFile','writeFile','readdir','mkdir','copyFile','rename','mkdtemp','unlink','rmdir']) promiseFs[name] = () => { throw new Error('匯入副作用：' + name); };
      syncBuiltinESMExports();
      await import(${JSON.stringify(pathToFileURL(fileURLToPath(new URL('./export-analysis.mjs', import.meta.url))).href)});
      await import(${JSON.stringify(pathToFileURL(fileURLToPath(new URL('./prepare.mjs', import.meta.url))).href)});
    `], { encoding: 'utf8', cwd: await temp() });
    expect(output).toBe('');
  });
  it('CLI 幫助與未知參數有明確結束碼', async () => {
    let stdout = '', stderr = '';
    const io = { stdout: { write: value => { stdout += value; } }, stderr: { write: value => { stderr += value; } } };
    expect(await main(['--help'], io)).toBe(0);
    expect(stdout).toContain('用法');
    expect(await main(['--typo'], io)).toBe(2);
    expect(stderr).toContain('未知參數');
  });
});
