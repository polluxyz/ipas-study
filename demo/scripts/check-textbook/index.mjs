/** 組合唯讀掃描與固定格式報告，供 CLI 與離線 fixture 測試共用，不在匯入時執行掃描。 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative, resolve } from 'node:path';
import { checkConcept } from './concept.mjs';
import { checkCoverage, parseCsv } from './coverage.mjs';
import { parseConcept } from './markdown.mjs';
import { checkUnitAnswers } from './self-check.mjs';
import { checkCheatsheet, cheatsheetConceptIndex } from './cheatsheet.mjs';

async function files(folder) {
  try {
    const entries = await readdir(folder, { withFileTypes: true });
    return (await Promise.all(entries.map((entry) => entry.isDirectory() ? files(join(folder, entry.name)) : [join(folder, entry.name)]))).flat().sort();
  } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}

async function optionalRead(file) {
  try { return await readFile(file, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return undefined; throw error; }
}

export async function checkTextbook({ contentDir = resolve(import.meta.dirname, '../../../content'), rootDir = resolve(contentDir, '..') } = {}) {
  contentDir = resolve(contentDir);
  if (!(await stat(contentDir)).isDirectory()) throw new Error(`content 路徑不是目錄：${contentDir}`);
  const display = (file) => relative(rootDir, file).replace(/\\/g, '/');
  const conceptFiles = (await files(join(contentDir, 'concepts'))).filter((file) => /\.mdx?$/.test(file));
  const figureIds = new Set((await files(join(contentDir, 'figures'))).filter((file) => /\.(json|svg)$/.test(file)).map((file) => relative(join(contentDir, 'figures'), file).replace(/\\/g, '/').replace(/\.(json|svg)$/, '')));
  const pages = await Promise.all(conceptFiles.map(async (file) => {
    // 雜湊保留換行與 BOM 的原始位元組，才能對上 reviewer 記錄的教材版本。
    const bytes = await readFile(file);
    return { file: display(file), source: bytes.toString('utf8'), conceptId: relative(join(contentDir, 'concepts'), file).replace(/\\/g, '/').replace(/\.mdx?$/, ''), revision: `sha256:${createHash('sha256').update(bytes).digest('hex')}` };
  }));
  const issues = pages.flatMap(({ source, file }) => checkConcept(source, file, figureIds));
  const cheatsheetFiles = (await files(join(contentDir, 'cheatsheets'))).filter((file) => /\.md$/.test(file));
  if (cheatsheetFiles.length) {
    const concepts = await cheatsheetConceptIndex(pages);
    for (const file of cheatsheetFiles) issues.push(...await checkCheatsheet(await readFile(file, 'utf8'), display(file), concepts));
  }
  const indexSource = await optionalRead(join(contentDir, 'concept-index.csv'));
  const owners = new Map();
  if (indexSource !== undefined) {
    const { rows, errors } = parseCsv(indexSource);
    const header = rows[0]?.cells ?? [];
    if (!errors.length && header.includes('id') && header.includes('owner_code')) {
      for (const row of rows.slice(1)) owners.set(row.cells[header.indexOf('id')], row.cells[header.indexOf('owner_code')]);
    }
  }
  issues.push(...checkUnitAnswers(pages.flatMap(({ source, file }) => {
    const parsed = parseConcept(source);
    return parsed.errors.length ? [] : [{ ...parsed, file, ownerCode: owners.get(parsed.data.id) }];
  })));
  const topicsFile = join(contentDir, 'guide-topics.csv');
  const coverageFile = join(contentDir, 'guide-coverage.csv');
  const [topics, coverage] = await Promise.all([optionalRead(topicsFile), optionalRead(coverageFile)]);
  const checked = checkCoverage(topics, coverage, display(topicsFile), display(coverageFile), new Map(pages.map((page) => [page.conceptId, page.revision])));
  issues.push(...checked.issues);
  issues.sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line || a.rule.localeCompare(b.rule) || a.message.localeCompare(b.message, 'zh-Hant'));
  const rules = Object.fromEntries(['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'SELF_CHECK', 'PARSE'].map((rule) => [rule, { errors: issues.filter((issue) => issue.rule === rule && issue.severity === 'error').length, warnings: issues.filter((issue) => issue.rule === rule && issue.severity === 'warning').length }]));
  return { version: 1, concepts: conceptFiles.length, cheatsheets: cheatsheetFiles.length, issues, summary: { errors: issues.filter((issue) => issue.severity === 'error').length, warnings: issues.filter((issue) => issue.severity === 'warning').length, rules }, coverage: checked.metrics };
}

export function formatReport(report, { summaryOnly = false } = {}) {
  const lines = ['教材檢查報告 v1'];
  if (!summaryOnly) for (const issue of report.issues) lines.push(`[${issue.severity === 'error' ? '錯誤' : '警告'}] ${issue.rule} ${issue.file}:${issue.line}: ${issue.message}`);
  lines.push(`統計：${report.concepts} 頁；錯誤 ${report.summary.errors}；警告 ${report.summary.warnings}`);
  lines.push(`速查：${report.cheatsheets ?? 0} 頁`);
  for (const [rule, counts] of Object.entries(report.summary.rules)) lines.push(`${rule}：錯誤 ${counts.errors}；警告 ${counts.warnings}`);
  const { coverage } = report;
  lines.push(`涵蓋率分母：${coverage.denominator}，共 ${coverage.total} 個`);
  const rate = (value) => value === null ? 'N/A' : `${value.toFixed(2)}%`;
  lines.push(`已對應率：${rate(coverage.mappedRate)}（${coverage.mapped}/${coverage.total}）`);
  lines.push(`審查完整率：${rate(coverage.reviewedRate)}（${coverage.reviewed}/${coverage.total}）`);
  const { mappingReviews } = coverage;
  lines.push(`映射列審查：${mappingReviews.valid}/${mappingReviews.total} 有效；${Object.entries(mappingReviews.states).map(([state, count]) => `${state} ${count}`).join('；')}`);
  if (!coverage.available) lines.push('涵蓋表未齊備，兩種比例暫不計算。');
  return lines.join('\n') + '\n';
}
