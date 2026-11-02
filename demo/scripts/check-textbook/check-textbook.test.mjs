/** 以通過與失敗教材驗證每條規則，並測試行號、遷移等級、涵蓋率與 CLI 的可觀察行為。 */
import { afterEach, describe, expect, it } from 'vitest';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { checkConcept } from './concept.mjs';
import { checkCoverage, coverageHeaders, parseCsv } from './coverage.mjs';
import { parseConcept, tableCells } from './markdown.mjs';
import { checkTextbook, formatReport } from './index.mjs';
import { main } from './cli.mjs';

function fixture(name) { return readFile(resolve(import.meta.dirname, 'fixtures', name), 'utf8'); }
function only(issues, rule) { return issues.filter((issue) => issue.rule === rule); }
const sampleRevision = 'sha256:8b38b495ecef38ca94bc91bd0f6590aa643162be356f4c42085407175c19cea2';
function sampleRevisions() { return new Map([['sample', sampleRevision]]); }
function concept(body, fields = '') {
  const checks = fields.includes('self_check:') ? '' : 'self_check: [{ id: c1, goal: g1, type: choice, prompt: 題目, options: { A: 甲, B: 乙, C: 丙, D: 丁 }, answer: A, explain: { A: 理由, B: 理由, C: 理由, D: 理由 } }]\n';
  return `---\ntextbook: v2\nsummary: 簡短摘要。\ngoals: [{ id: g1, text: 能理解概念。 }]\n${checks}${fields}---\n${body}`;
}

describe('概念頁 T1–T5 與檢核小題', () => {
  it('同一份完整教材通過所有規則，frontmatter 的考題 ID 與字母 A、B 不誤報', async () => {
    expect(checkConcept(await fixture('pass.md'), 'pass.md', new Set(['sample']))).toEqual([]);
  });
  it('T1 拒絕考題 ID、阿拉伯數字與中文題號、場次引用，附原始行號', async () => {
    const issues = only(checkConcept(await fixture('T1-fail.md'), 'T1-fail.md'), 'T1');
    expect(issues.map((issue) => issue.line)).toEqual([7, 9, 11, 13, 15]);
    expect(issues.every((issue) => issue.severity === 'error')).toBe(true);
  });
  it('T1 只豁免相關考題區的純連結，不豁免解析與後續章節', () => {
    const issues = only(checkConcept(concept('## 相關考古題\n- [115-1-S3-Q44](/questions/115-1-S3-Q44/)\n115-1 科3 第44題的解析。\n## 小結\n第45題。'), 'links.md'), 'T1');
    expect(issues).toHaveLength(2);
  });
  it('T2 新版頁缺欄位、未知標題、倒序與重複均列錯誤，舊版均列警告', async () => {
    const source = await fixture('T2-fail.md');
    const current = only(checkConcept(source, 'new.md'), 'T2');
    expect(current).toHaveLength(5);
    expect(current.every((issue) => issue.severity === 'error')).toBe(true);
    const legacy = only(checkConcept(source.replace('textbook: v2', 'kind: metric'), 'old.md'), 'T2');
    expect(legacy).toHaveLength(current.length);
    expect(legacy.every((issue) => issue.severity === 'warning')).toBe(true);
  });
  it('T2 接受流程標題、補充註記、可省略小節，忽略程式區的假標題', () => {
    expect(only(checkConcept(concept('## 走一次流程\n\n步驟。\n\n~~~python\n## 不存在\n~~~\n\n## 進階（補充）\n\n補充。'), 'flow.md'), 'T2')).toEqual([]);
  });
  it('T2 goals 不接受空白 id/text 與重複 id', async () => {
    const source = (await fixture('pass.md')).replace('id: g1\n    text: 能說明正類與負類。', 'id: g1\n    text: ""\n  - { id: g2, text: 目標 }\n  - { id: g2, text: 重複 }');
    expect(only(checkConcept(source, 'goals.md', new Set(['sample'])), 'T2')).toHaveLength(2);
  });
  it('T3 長段落、超過四句、第四個提示框、大表格及長程式各列一次警告', async () => {
    const issues = only(checkConcept(await fixture('T3-fail.md'), 'T3-fail.md'), 'T3');
    expect(issues).toHaveLength(5);
    expect(issues.every((issue) => issue.severity === 'warning')).toBe(true);
    for (const token of ['90 字', '5 句', '4 個提示框', '5 欄、7 列', '16 行']) expect(issues.some((issue) => issue.message.includes(token))).toBe(true);
  });
  it('T3 邊界：90 字、四句、三個提示框、4 欄 6 列及 15 行程式都通過', () => {
    const body = ['## 直覺', '字'.repeat(90), '一。二。三。四。', ...Array(3).fill(':::tip[重點]\n短文。\n:::'), '| A | B | C | D |\n| --- | --- | --- | --- |\n' + Array(6).fill('| 1 | 2 | 3 | 4 |').join('\n'), '```python\n' + Array(15).fill('x = 1').join('\n') + '\n```'].join('\n\n');
    expect(only(checkConcept(concept(body), 'boundary.md'), 'T3')).toEqual([]);
    expect(only(checkConcept(concept('字'.repeat(91)), 'over.md'), 'T3')).toHaveLength(1);
  });
  it('表格中的跳脫符號與行內程式管線不增加欄數', () => {
    expect(tableCells('| A | `x|y` | z\\|w |')).toEqual(['A', '`x|y`', 'z\\|w']);
  });
  it('T4 缺公式來源與 verified 核對者各列錯誤', async () => {
    expect(only(checkConcept(await fixture('T4-fail.md'), 'T4-fail.md'), 'T4')).toHaveLength(2);
  });
  it('T4 區塊公式缺群組不通過；程式內 $$ 與行內公式不觸發', () => {
    expect(only(checkConcept(concept('$$\np=1\n$$'), 'formula.md'), 'T4')).toHaveLength(1);
    expect(only(checkConcept(concept('$p=1$\n\n```js\n$$\n```'), 'inline.md'), 'T4')).toEqual([]);
  });
  it('T4 記錄無效狀態、缺核對欄、重複群組，接受完整 verified 紀錄', () => {
    const valid = 'formula_groups: [{ id: f1, source: "guide-3:5-22", status: verified, checked_by: reviewer }]\n';
    expect(only(checkConcept(concept('$$\np=1\n$$', valid), 'formula.md'), 'T4')).toEqual([]);
    const invalid = 'formula_groups: [{ id: f1, source: source, status: invalid }, { id: f1, source: source, status: pending, checked_by: null }]\n';
    expect(only(checkConcept(concept('$$\np=1\n$$', invalid), 'formula.md'), 'T4')).toHaveLength(3);
  });
  it('T5 分別指出空白圖說與不存在的圖 ID，程式碼中的圖語法不當成引用', async () => {
    const issues = only(checkConcept(await fixture('T5-fail.md'), 'T5-fail.md', new Set(['sample'])), 'T5');
    expect(issues).toHaveLength(2);
    expect(issues.map((issue) => issue.line)).toEqual([7, 9]);
    expect(only(checkConcept(concept('```md\n![](figure:missing)\n```'), 'code.md'), 'T5')).toEqual([]);
  });
  it('self_check 指出不存在目標、答案不在選項、解析缺項、缺 key_points、缺 options', async () => {
    expect(only(checkConcept(await fixture('self-check-fail.md'), 'check.md'), 'SELF_CHECK')).toHaveLength(5);
  });
  it('self_check 不接受錯誤型別、重複 id 與空白題幹', () => {
    expect(only(checkConcept(concept('', 'self_check: wrong\n'), 'check.md'), 'SELF_CHECK')).toHaveLength(1);
    const fields = 'self_check: [{ id: c, goal: g1, type: short, prompt: 題目, key_points: [答案] }, { id: c, goal: g1, type: other, prompt: "" }]\n';
    expect(only(checkConcept(concept('', fields), 'check.md'), 'SELF_CHECK')).toHaveLength(3);
  });
  it('YAML 格式錯誤有 PARSE 診斷，CRLF 與 BOM 不破壞正文行號', () => {
    expect(checkConcept('---\ngoals: [\n---\n', 'bad.md')[0].rule).toBe('PARSE');
    expect(checkConcept('---\nsummary: 沒有結束\n', 'unclosed.md')[0]).toMatchObject({ rule: 'PARSE', line: 1 });
    const parsed = parseConcept('\uFEFF---\r\nsummary: 摘要\r\n---\r\n第44題。');
    expect(parsed.body[0].line).toBe(4);
    expect(checkConcept('\uFEFF---\r\nsummary: 摘要\r\n---\r\n第44題。', 'bom.md').find((issue) => issue.rule === 'T1').line).toBe(4);
  });
});

describe('T6 涵蓋表', () => {
  async function run(topics = 'topics-pass.csv', coverage = 'coverage-pass.csv') {
    return checkCoverage(await fixture(topics), await fixture(coverage), 'topics.csv', 'coverage.csv', sampleRevisions());
  }
  it('通過 fixture 將 mentioned 算已對應，只有經審查 complete 算完整，排除範圍外目標', async () => {
    const result = await run();
    expect(result.issues).toEqual([]);
    expect(result.metrics).toMatchObject({ total: 3, mapped: 2, reviewed: 1 });
    expect(result.metrics.mappedRate).toBeCloseTo(66.6667);
    expect(result.metrics.reviewedRate).toBeCloseTo(33.3333);
  });
  it('失敗 fixture 指出不存在主題、錯誤狀態、缺必要對應與審查紀錄', async () => {
    const result = await run('topics-pass.csv', 'coverage-fail.csv');
    expect(result.issues.filter((issue) => issue.severity === 'error')).toHaveLength(5);
    expect(result.issues.filter((issue) => issue.severity === 'warning')).toHaveLength(4);
    expect(result.metrics.mapped).toBe(0);
    expect(result.metrics.reviewed).toBe(0);
  });
  it('拒絕錯誤欄位、重複 topic_id 與無效 in_scope', async () => {
    expect((await run('topics-pass.csv', 'columns-fail.csv')).issues.some((issue) => issue.message.includes('CSV 欄位不符'))).toBe(true);
    const result = await run('topics-fail.csv');
    expect(result.issues.some((issue) => issue.message.includes('topic_id 重複'))).toBe(true);
    expect(result.issues.some((issue) => issue.message.includes('in_scope 必須'))).toBe(true);
  });
  it('goal_id 與 evidence_refs 留白只警告，不降低已對應與審查完整率', async () => {
    const source = (await fixture('coverage-pass.csv')).replace('T01-G01,sample#g1,sample,算一次,guide-3:5-22', 'T01-G01,,sample,算一次,');
    const result = checkCoverage(await fixture('topics-pass.csv'), source, 'topics.csv', 'coverage.csv', sampleRevisions());
    expect(result.issues).toHaveLength(2);
    expect(result.issues.every((issue) => issue.severity === 'warning')).toBe(true);
    expect(result.metrics).toMatchObject({ mapped: 2, reviewed: 1 });
  });
  it('多筆教材證據不重複增加目標分子，已有效審查的 partial 支援列可算審查完整', async () => {
    const source = (await fixture('coverage-pass.csv')) + `\nT01-G01,sample#g2,sample,直覺,guide-3:5-22,partial,reviewer-2,${sampleRevision},支援\n`;
    const result = checkCoverage(await fixture('topics-pass.csv'), source, 'topics.csv', 'coverage.csv', sampleRevisions());
    expect(result.metrics).toMatchObject({ total: 3, mapped: 2, reviewed: 1 });
  });
  it('涵蓋表可不存在；零分母與缺檔時回傳 N/A，不假造 100%', () => {
    const result = checkCoverage(undefined, undefined, 'topics.csv', 'coverage.csv');
    expect(result.issues).toEqual([]);
    expect(result.metrics).toMatchObject({ available: false, mappedRate: null, reviewedRate: null });
  });
  it('T6 空表、重複欄位與資料欄數不符均有錯誤診斷', async () => {
    const topics = await fixture('topics-pass.csv');
    for (const csv of ['', 'topic_id,topic_id\nT01-G01,T01-G01\n', (await fixture('coverage-pass.csv')).replace('T02-G01,,,,,unmapped,,,', 'T02-G01,unmapped')]) {
      expect(checkCoverage(topics, csv, 'topics.csv', 'coverage.csv').issues.some((issue) => issue.severity === 'error')).toBe(true);
    }
  });
  it('T6 complete 尚未核對時仍可已對應，但審查完整率為零', async () => {
    const csv = (await fixture('coverage-pass.csv')).replace(`complete,reviewer-1,${sampleRevision}`, 'complete,,');
    const result = checkCoverage(await fixture('topics-pass.csv'), csv, 'topics.csv', 'coverage.csv', sampleRevisions());
    expect(result.metrics).toMatchObject({ mapped: 2, reviewed: 0 });
    expect(result.issues.some((issue) => issue.message.includes('reviewer'))).toBe(true);
  });
  it('CSV 接受逗號、跳脫引號、跨行與 BOM，保留每列起始行號', async () => {
    const parsed = parseCsv('\uFEFF' + await fixture('csv-pass.csv'));
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[1].cells).toEqual(['1', '包含逗號,與"引號"', '']);
    expect(parsed.rows[2]).toEqual({ cells: ['2', '跨行\n文字', '值'], line: 3 });
    expect(parseCsv(await fixture('csv-fail.csv')).errors[0].line).toBe(2);
  });
});

describe('T6 有效審查與支援映射', () => {
  async function runRows(rows, revisions = sampleRevisions()) {
    const header = coverageHeaders().coverage;
    const defaults = { topic_id: 'T01-G01', goal_id: 'sample#g1', concept_id: 'sample', section_anchor: '算一次', evidence_refs: 'guide-3:5-22', coverage_state: 'complete', reviewer: 'reviewer-1', reviewed_revision: sampleRevision };
    const csv = [header.join(','), ...rows.map((row) => header.map((key) => ({ ...defaults, ...row })[key] ?? '').join(','))].join('\n');
    return checkCoverage(await fixture('topics-pass.csv'), csv, 'topics.csv', 'coverage.csv', revisions);
  }
  it.each([
    ['只有已審 partial', [{ coverage_state: 'partial' }]],
    ['complete 加未審 partial', [{}, { coverage_state: 'partial', reviewer: '', reviewed_revision: '' }]],
    ['complete 加已審 mentioned', [{}, { coverage_state: 'mentioned' }]],
    ['complete 加已審 unmapped', [{}, { coverage_state: 'unmapped' }]],
    ['complete 加過期 partial', [{}, { coverage_state: 'partial', reviewed_revision: 'sha256:old' }]],
  ])('%s 不算審查完整', async (_name, rows) => {
    const result = await runRows(rows);
    expect(result.metrics).toMatchObject({ mapped: 1, reviewed: 0 });
  });
  it('至少一列有效 complete 加已審 partial 可計入，列數與四種狀態分別統計', async () => {
    const result = await runRows([{}, { coverage_state: 'partial' }]);
    expect(result.issues).toEqual([]);
    expect(result.metrics).toMatchObject({ reviewed: 1, mappingReviews: { valid: 2, total: 2, states: { complete: 1, partial: 1, mentioned: 0, unmapped: 0 } } });
  });
  it.each([
    ['缺 reviewer', { reviewer: '' }, sampleRevisions(), 'error', 'reviewer'],
    ['缺 reviewed_revision', { reviewed_revision: '' }, sampleRevisions(), 'error', 'reviewed_revision'],
    ['雜湊不符', { reviewed_revision: 'sha256:old' }, sampleRevisions(), 'warning', '雜湊不符'],
    ['概念頁不存在', {}, new Map(), 'warning', '概念頁不存在'],
  ])('%s 不計入且指出診斷原因', async (_name, row, revisions, severity, message) => {
    const result = await runRows([row], revisions);
    expect(result.metrics).toMatchObject({ mapped: 1, reviewed: 0, mappingReviews: { valid: 0, total: 1 } });
    expect(result.issues).toContainEqual(expect.objectContaining({ severity, message: expect.stringContaining(message) }));
    if (severity === 'warning') expect(result.issues).toContainEqual(expect.objectContaining({ rule: 'T6', line: 2, message: expect.stringMatching(/sample.*重新審查/) }));
  });
  it('同一目標多列有效 complete 只計一次，映射列仍逐列統計', async () => {
    const result = await runRows([{}, { goal_id: 'sample#g2' }]);
    expect(result.metrics).toMatchObject({ total: 3, mapped: 1, reviewed: 1, mappingReviews: { valid: 2, total: 2, states: { complete: 2 } } });
  });
  it('即使有有效審查，結構不合法的支援列仍阻擋完整率', async () => {
    const result = await runRows([{}, { coverage_state: 'partial', section_anchor: '' }]);
    expect(result.metrics.reviewed).toBe(0);
    expect(result.issues.some((issue) => issue.severity === 'error')).toBe(true);
  });
  it('未提供目前版本表時不接受僅填文字的審查紀錄', async () => {
    const result = checkCoverage(await fixture('topics-pass.csv'), await fixture('coverage-pass.csv'), 'topics.csv', 'coverage.csv');
    expect(result.metrics.reviewed).toBe(0);
    expect(result.issues.some((issue) => issue.message.includes('sample'))).toBe(true);
  });
  it('不合法的 in_scope 目標不進入分母', async () => {
    const topics = (await fixture('topics-pass.csv')).replace('會算指標,完整算例,true', ',完整算例,true');
    const result = checkCoverage(topics, await fixture('coverage-pass.csv'), 'topics.csv', 'coverage.csv', sampleRevisions());
    expect(result.metrics).toMatchObject({ total: 2, mapped: 1, reviewed: 0 });
  });
});

describe('唯讀整合、報告與 CLI', () => {
  const temporary = [];
  afterEach(async () => { await Promise.all(temporary.splice(0).map((folder) => rm(folder, { recursive: true, force: true }))); });
  async function content() {
    const folder = await mkdtemp(join(tmpdir(), 'check-textbook-')); temporary.push(folder);
    await mkdir(join(folder, 'concepts')); await mkdir(join(folder, 'figures'));
    await copyFile(resolve(import.meta.dirname, 'fixtures/pass.md'), join(folder, 'concepts/sample.md'));
    await writeFile(join(folder, 'figures/sample.svg'), '<svg/>');
    return folder;
  }
  it('原始位元組雜湊與文字／JSON 報告一致，暫存頁改字後完整率下降並要求重審', async () => {
    const folder = await content();
    const file = join(folder, 'concepts/sample.md');
    const bytes = await readFile(file);
    const revision = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
    await writeFile(join(folder, 'guide-topics.csv'), await fixture('topics-pass.csv'));
    await writeFile(join(folder, 'guide-coverage.csv'), (await fixture('coverage-pass.csv')).replace(sampleRevision, revision));
    const before = await checkTextbook({ contentDir: folder });
    expect(before.coverage).toMatchObject({ reviewed: 1, mappingReviews: { valid: 1, total: 3, states: { complete: 1, partial: 0, mentioned: 1, unmapped: 1 } } });
    expect(formatReport(before)).toContain('映射列審查：1/3 有效；unmapped 1；mentioned 1；partial 0；complete 1');
    let json = '';
    expect(await main(['--content', folder, '--json'], { stdout: { write: (value) => { json += value; } }, stderr: { write: () => {} } })).toBe(0);
    expect(JSON.parse(json).coverage.mappingReviews).toEqual(before.coverage.mappingReviews);
    const changed = bytes.toString('utf8').replace('用小例子', '用大例子');
    expect(changed).not.toBe(bytes.toString('utf8'));
    await writeFile(file, changed);
    const after = await checkTextbook({ contentDir: folder });
    expect(after.coverage).toMatchObject({ mapped: 2, reviewed: 0, mappingReviews: { valid: 0, total: 3 } });
    expect(after.issues).toContainEqual(expect.objectContaining({ rule: 'T6', severity: 'warning', message: expect.stringMatching(/sample.*雜湊不符.*重新審查/) }));
  });
  it('位元組差異（BOM 與 CRLF）必須使用實際版本，缺檔時審查無效', async () => {
    const folder = await content();
    const file = join(folder, 'concepts/sample.md');
    const bytes = Buffer.from('\uFEFF' + (await fixture('pass.md')).replace(/\r?\n/g, '\r\n'));
    await writeFile(file, bytes);
    const revision = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
    await writeFile(join(folder, 'guide-topics.csv'), await fixture('topics-pass.csv'));
    await writeFile(join(folder, 'guide-coverage.csv'), (await fixture('coverage-pass.csv')).replace(sampleRevision, revision));
    expect((await checkTextbook({ contentDir: folder })).coverage.reviewed).toBe(1);
    await rm(file);
    const missing = await checkTextbook({ contentDir: folder });
    expect(missing.coverage.reviewed).toBe(0);
    expect(missing.issues).toContainEqual(expect.objectContaining({ rule: 'T6', severity: 'warning', message: expect.stringMatching(/sample.*概念頁不存在/) }));
  });
  it('遞迴讀取概念，接受 SVG 與 JSON 圖宣告，輸出固定檔案行號格式與兩個比例', async () => {
    const folder = await content();
    await mkdir(join(folder, 'concepts/nested'));
    await writeFile(join(folder, 'concepts/nested/other.md'), concept('## 直覺\n![圖說](figure:json-sample)'));
    await writeFile(join(folder, 'figures/json-sample.json'), '{}');
    const before = await readFile(join(folder, 'concepts/sample.md'), 'utf8');
    const report = await checkTextbook({ contentDir: folder });
    expect(report).toMatchObject({ version: 1, concepts: 2, summary: { errors: 0, warnings: 0 } });
    expect(await readFile(join(folder, 'concepts/sample.md'), 'utf8')).toBe(before);
    expect(formatReport(report)).toContain('已對應率：N/A');
    expect(formatReport(report)).toContain('審查完整率：N/A');
    await writeFile(join(folder, 'concepts/nested/other.md'), concept('第44題。'));
    const bad = await checkTextbook({ contentDir: folder });
    expect(formatReport(bad)).toMatch(/\[錯誤\] T1 .+concepts\/nested\/other.md:7:/);
    expect(formatReport(bad, { summaryOnly: true })).not.toContain('[錯誤]');
  });
  it('CLI 支援 JSON、錯誤結束碼與參數錯誤', async () => {
    const folder = await content();
    const cli = resolve(import.meta.dirname, 'cli.mjs');
    const run = spawnSync(process.execPath, [cli, '--content', folder, '--json'], { encoding: 'utf8' });
    expect(run.status).toBe(0);
    expect(JSON.parse(run.stdout).summary.errors).toBe(0);
    await writeFile(join(folder, 'concepts/sample.md'), concept('第44題。'));
    const bad = spawnSync(process.execPath, [cli, '--content', folder, '--summary'], { encoding: 'utf8' });
    expect(bad.status).toBe(1);
    expect(bad.stdout).toContain('T1：錯誤 1；警告 0');
    const invalid = spawnSync(process.execPath, [cli, '--unknown'], { encoding: 'utf8' });
    expect(invalid.status).toBe(2);
    await writeFile(join(folder, 'concepts/sample.md'), '## 舊版標題\n短文。\n');
    const warning = spawnSync(process.execPath, [cli, '--content', folder, '--summary'], { encoding: 'utf8' });
    expect(warning.status).toBe(0);
    expect(warning.stdout).toContain('T2：錯誤 0；警告 3');
    const missing = spawnSync(process.execPath, [cli, '--content', join(folder, 'missing')], { encoding: 'utf8' });
    expect(missing.status).toBe(2);
  });
  it('匯入所有模組無掃描、輸出或檔案寫入副作用', () => {
    const imports = ['markdown', 'concept', 'coverage', 'self-check', 'python', 'index', 'cli'].map((name) => `await import(${JSON.stringify(new URL(`./${name}.mjs`, import.meta.url).href)})`).join(';');
    const run = spawnSync(process.execPath, ['--input-type=module', '-e', imports], { encoding: 'utf8', cwd: tmpdir() });
    expect(run.status).toBe(0);
    expect(run.stdout).toBe('');
    expect(run.stderr).toBe('');
  });
  it('CLI main 可注入輸出介面，help 不執行掃描', async () => {
    let output = '';
    const code = await main(['--help'], { stdout: { write: (value) => { output += value; } }, stderr: { write: () => {} } });
    expect(code).toBe(0);
    expect(output).toContain('用法');
  });
});
