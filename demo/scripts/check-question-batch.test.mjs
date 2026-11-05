/** 用通過與失敗批次保護比例邊界、字元計數和命令列退出碼，不依賴正式題庫內容。 */
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { stringify } from 'yaml';
import { analyzeBatch, formatSummary, loadQuestions } from '../../scripts/tools/check-question-batch.mjs';

const fixtures = JSON.parse(readFileSync(new URL('../../tests/fixtures/question-batch/cases.json', import.meta.url), 'utf8'));
const question = (answer, options = { A: '甲', B: '乙', C: '丙', D: '丁' }) => ({ answer, options });
const balanced = () => [...fixtures.balanced].map((answer) => question(answer));
const cli = fileURLToPath(new URL('../../scripts/tools/check-question-batch.mjs', import.meta.url));

describe('題目批次門檻', () => {
  it('平均答案與並列最長通過，並列不計入唯一最長門檻', () => {
    const report = analyzeBatch(balanced());
    expect(report.total).toBe(4);
    expect(Object.values(report.answers).map((value) => value.ratio)).toEqual([0.25, 0.25, 0.25, 0.25]);
    expect(report.uniqueLongest).toEqual({ count: 0, ratio: 0 });
    expect(report.tiedLongest).toEqual({ count: 4, ratio: 1 });
    expect(report.passed).toBe(true);
    expect(formatSummary(report)).toContain('批次門檻：通過');
  });
  it('15%、35% 與唯一最長 65% 的等號邊界通過', () => {
    const questions = [...fixtures.distribution_boundary].map((answer, index) => question(answer, {
      A: '甲', B: '乙', C: '丙', D: '丁', ...(index < fixtures.unique_longest_boundary ? { [answer]: '較長' } : {}),
    }));
    const report = analyzeBatch(questions);
    expect(report.answers.A.ratio).toBe(0.15);
    expect(report.answers.B.ratio).toBe(0.35);
    expect(report.uniqueLongest.ratio).toBe(0.65);
    expect(report.passed).toBe(true);
  });
  it.each(fixtures.distribution_failures)('不平均分布 %s 不通過', (answers) => {
    const report = analyzeBatch([...answers].map((answer) => question(answer)));
    expect(report.thresholds.answerDistribution.passed).toBe(false);
    expect(report.passed).toBe(false);
  });
  it('唯一最長 75% 不通過，即使 A–D 各占 25%', () => {
    const report = analyzeBatch(balanced().map((item, index) => index < fixtures.unique_longest_failure ? { ...item, options: { ...item.options, [item.answer]: '最長' } } : item));
    expect(report.uniqueLongest.ratio).toBe(0.75);
    expect(report.thresholds.answerDistribution.passed).toBe(true);
    expect(report.passed).toBe(false);
  });
  it('去除前後空白後以 Unicode 字元數計算，較短正解不計入最長', () => {
    const report = analyzeBatch(fixtures.unicode_lengths);
    expect(report.uniqueLongest.count).toBe(1);
    expect(report.tiedLongest.count).toBe(1);
  });
  it('空批次不通過且不輸出 NaN', () => {
    expect(analyzeBatch(fixtures.empty).passed).toBe(false);
    expect(formatSummary(analyzeBatch(fixtures.empty))).not.toContain('NaN');
  });
  it.each(fixtures.malformed)('拒絕缺正解或選項的題目 %j', (fixture) => {
    expect(() => analyzeBatch([fixture])).toThrow('完整文字選項');
  });
  it('遞迴讀取 YAML、去重檔案，CLI 輸出 JSON 與摘要並用退出碼表示結果', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'ipas-batch-'));
    try {
      await mkdir(join(folder, 'nested'));
      await writeFile(join(folder, 'LICENSE.md'), '略過非題目檔');
      for (const [index, item] of balanced().entries()) await writeFile(join(folder, 'nested', `${index}.yaml`), stringify(item));
      expect(await loadQuestions([folder, join(folder, 'nested', '0.yaml')])).toHaveLength(4);
      const pass = spawnSync(process.execPath, [cli, folder], { encoding: 'utf8' });
      expect(pass.status).toBe(0);
      expect(JSON.parse(pass.stdout)).toMatchObject({ total: 4, passed: true });
      expect(pass.stderr).toContain('正解並列最長：4 題（100.00%）');
      const fail = spawnSync(process.execPath, [cli, join(folder, 'nested', '0.yaml')], { encoding: 'utf8' });
      expect(fail.status).toBe(1);
      expect(JSON.parse(fail.stdout).passed).toBe(false);
      await writeFile(join(folder, 'invalid.yml'), 'options: [');
      const invalid = spawnSync(process.execPath, [cli, folder], { encoding: 'utf8' });
      expect(invalid.status).toBe(1);
      expect(JSON.parse(invalid.stdout).error).toContain('invalid.yml');
      const missing = spawnSync(process.execPath, [cli], { encoding: 'utf8' });
      expect(missing.status).toBe(1);
      expect(JSON.parse(missing.stdout).error).toContain('用法');
    } finally { await rm(folder, { recursive: true, force: true }); }
  });
});
