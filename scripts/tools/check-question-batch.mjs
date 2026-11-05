/** 統計單批題目的答案位置與選項長度，讓寫作者在送審前確認作答線索門檻。 */
import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export function analyzeBatch(questions) {
  const letters = ['A', 'B', 'C', 'D'];
  const counts = Object.fromEntries(letters.map((letter) => [letter, 0]));
  let uniqueLongest = 0;
  let tiedLongest = 0;
  for (const [index, question] of questions.entries()) {
    if (!question || !letters.includes(question.answer) || !letters.every((letter) => typeof question.options?.[letter] === 'string')) {
      throw new Error(`第 ${index + 1} 題須有 A–D 正解與完整文字選項`);
    }
    counts[question.answer]++;
    // 用 Unicode 字元計數，避免非基本平面字元被當成 2 字。
    const lengths = Object.fromEntries(letters.map((letter) => [letter, [...question.options[letter].trim()].length]));
    const longest = Math.max(...Object.values(lengths));
    if (lengths[question.answer] === longest) {
      if (Object.values(lengths).filter((length) => length === longest).length === 1) uniqueLongest++;
      else tiedLongest++;
    }
  }
  const total = questions.length;
  const metric = (count) => ({ count, ratio: total ? count / total : 0 });
  const answers = Object.fromEntries(letters.map((letter) => [letter, metric(counts[letter])]));
  const distributionPassed = total > 0 && Object.values(answers).every(({ ratio }) => ratio >= 0.15 && ratio <= 0.35);
  const lengthPassed = total > 0 && uniqueLongest / total <= 0.65;
  return {
    total, answers, uniqueLongest: metric(uniqueLongest), tiedLongest: metric(tiedLongest),
    thresholds: {
      answerDistribution: { min: 0.15, max: 0.35, passed: distributionPassed },
      uniqueLongest: { max: 0.65, passed: lengthPassed },
    },
    passed: distributionPassed && lengthPassed,
  };
}

export async function loadQuestions(inputs) {
  if (!inputs.length) throw new Error('用法：node scripts/tools/check-question-batch.mjs <檔案或目錄> [...]');
  const files = new Set();
  async function visit(input) {
    const file = await realpath(input);
    if ((await stat(file)).isDirectory()) {
      for (const entry of (await readdir(file)).sort()) await visit(join(file, entry));
    } else if (/\.ya?ml$/i.test(file)) files.add(file);
  }
  for (const input of inputs) await visit(resolve(input));
  // 從網站既有安裝位置載入 YAML；根目錄不需要另一份相依。
  const { parse } = createRequire(new URL('../../demo/package.json', import.meta.url))('yaml');
  return Promise.all([...files].map(async (file) => {
    try {
      const question = parse(await readFile(file, 'utf8'));
      analyzeBatch([question]);
      return question;
    } catch (error) { throw new Error(`${file}：${error.message}`, { cause: error }); }
  }));
}

export function formatSummary(report) {
  const percent = (ratio) => `${(ratio * 100).toFixed(2)}%`;
  return [
    `題數：${report.total}`,
    `正解分布：${Object.entries(report.answers).map(([letter, value]) => `${letter} ${value.count} 題（${percent(value.ratio)}）`).join('、')}`,
    `正解唯一最長：${report.uniqueLongest.count} 題（${percent(report.uniqueLongest.ratio)}）`,
    `正解並列最長：${report.tiedLongest.count} 題（${percent(report.tiedLongest.ratio)}）`,
    `A–D 各 15%–35%：${report.thresholds.answerDistribution.passed ? '通過' : '不通過'}`,
    `唯一最長 ≤ 65%：${report.thresholds.uniqueLongest.passed ? '通過' : '不通過'}`,
    `批次門檻：${report.passed ? '通過' : '不通過'}`,
  ].join('\n');
}

export async function main(args = process.argv.slice(2)) {
  try {
    const report = analyzeBatch(await loadQuestions(args));
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.stderr.write(`${formatSummary(report)}\n`);
    return report.passed ? 0 : 1;
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ passed: false, error: error.message })}\n`);
    process.stderr.write(`批次檢查失敗：${error.message}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = await main();
