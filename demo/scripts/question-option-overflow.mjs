/**
 * 在協調者既有服務驗證原生題卡；不開服務、不修改頁面樣式，也不碰完整驗收契約。
 * node demo/scripts/question-option-overflow.mjs --base http://127.0.0.1:4325 --output tmp/question-option-overflow/after
 * 候選可加 --build-receipt <協調者收據>，沿用逐回應及來源核對。
 * 原版執行同一組斷言會退出 1，仍保留各尺寸的量測、截圖及錯誤。
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';
import { parse } from 'yaml';
import { freshOutput, localUrl, readBuildReceipt, routeLocalOnly, watchBuildResponses, gotoSettled } from './rollout-smoke.mjs';

const root = resolve(import.meta.dirname, '../..');
const choices = ['A', 'B', 'C', 'D'];
const cases = [
  { id: '114-2-S3-Q45', kind: 'code' },
  { id: '114-2-S3-Q01', kind: 'text' },
  { id: '114-2-S3-Q49', kind: 'math' },
];

/** 量測格線、表單與選項本身，讓祖先溢出不能被局部捲軸遮過。 */
export function measureOptions() {
  const rect = (element) => {
    const box = element.getBoundingClientRect(), css = getComputedStyle(element);
    return { left: box.left, right: box.right, width: box.width, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth,
      minWidth: css.minWidth, overflowX: css.overflowX, fontSize: css.fontSize, gridTemplateColumns: css.gridTemplateColumns };
  };
  const card = document.querySelector('[data-question]');
  return {
    viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth, theme: document.documentElement.dataset.theme,
    ancestors: ['html', 'body', '[data-question]', '[data-answer-form]', 'fieldset', '.answer-options'].map((selector) => ({ selector, ...rect(document.querySelector(selector)) })),
    card: rect(card), options: [...card.querySelectorAll('[data-option]')].map((option) => ({
      choice: option.dataset.option, ...rect(option), children: [...option.children].map((child) => ({ tag: child.tagName, class: child.className, ...rect(child) })),
      checked: option.querySelector('input').checked, status: option.querySelector('.option-status').textContent,
      blocks: [...option.querySelectorAll('pre')].map((pre) => ({ ...rect(pre), text: pre.textContent, whiteSpace: getComputedStyle(pre).whiteSpace })),
    })),
  };
}

export function assertContained(measurement) {
  assert.ok(measurement.scrollWidth <= measurement.viewport, `整頁溢出 ${measurement.scrollWidth}/${measurement.viewport}`);
  assert.ok(measurement.bodyScrollWidth <= measurement.viewport, `body 溢出 ${measurement.bodyScrollWidth}/${measurement.viewport}`);
  for (const ancestor of measurement.ancestors) {
    assert.ok(!['hidden', 'clip'].includes(ancestor.overflowX), `${ancestor.selector} 隱藏了橫向溢出`);
  }
  for (const option of measurement.options) {
    assert.ok(option.left >= measurement.card.left - 1 && option.right <= measurement.card.right + 1, `${option.choice} 超出題卡`);
    for (const child of option.children) {
      assert.ok(child.left >= option.left - 1 && child.right <= option.right + 1, `${option.choice} ${child.class} 超出選項`);
    }
  }
}

/** 最長行的最後一字必須能捲進可見範圍，不能只驗 scrollWidth 大於 clientWidth。 */
async function scrollCodeToEnd(page, pre) {
  await pre.scrollIntoViewIfNeeded();
  const before = await pre.evaluate((element) => {
    element.scrollLeft = 0;
    const css = getComputedStyle(element);
    return { text: element.textContent, fontSize: css.fontSize, whiteSpace: css.whiteSpace, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth };
  });
  assert.equal(before.whiteSpace, 'pre', '程式碼須保留縮排與不折行');
  if (before.scrollWidth > before.clientWidth) {
    const box = await pre.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(10000, 0);
    await pre.evaluate((element) => new Promise((resolve) => {
      const finish = () => resolve();
      if (element.scrollLeft >= element.scrollWidth - element.clientWidth - 1) finish();
      else { element.addEventListener('scrollend', finish, { once: true }); setTimeout(finish, 1500); }
    }));
  }
  const end = await pre.evaluate((element) => {
    const walker = document.createTreeWalker(element.querySelector('code'), NodeFilter.SHOW_TEXT);
    let node, farthest;
    while ((node = walker.nextNode())) {
      const index = node.textContent.search(/\S\s*$/);
      if (index < 0) continue;
      const range = document.createRange(); range.setStart(node, index); range.setEnd(node, index + 1);
      const box = range.getBoundingClientRect();
      if (!farthest || box.right > farthest.right) farthest = { character: node.textContent[index], left: box.left, right: box.right, width: box.width };
    }
    const box = element.getBoundingClientRect(), css = getComputedStyle(element);
    return { text: element.textContent, fontSize: css.fontSize, scrollLeft: element.scrollLeft, maximum: element.scrollWidth - element.clientWidth,
      left: box.left + element.clientLeft, right: box.left + element.clientLeft + element.clientWidth, farthest };
  });
  assert.equal(end.text, before.text, '橫捲不得改程式文字');
  assert.equal(end.fontSize, before.fontSize, '橫捲不得縮字');
  assert.ok(end.scrollLeft >= end.maximum - 1, '原生橫捲未到最右端');
  assert.ok(end.farthest?.width > 0 && end.farthest.left >= end.left - 1 && end.farthest.right <= end.right + 1, '最長行最後一字不可見');
  return { before, end };
}

export async function main() {
  const { values } = parseArgs({ options: { base: { type: 'string' }, output: { type: 'string' }, 'build-receipt': { type: 'string' } } });
  assert.ok(values.base && values.output, '需要 --base 與 --output');
  const base = localUrl(values.base, values.base).origin;
  assert.equal(new URL(base).hostname, '127.0.0.1');
  const output = await freshOutput(resolve(values.output));
  const binding = values['build-receipt'] ? await readBuildReceipt(values['build-receipt']) : undefined;
  const report = { completed: false, base, sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    receiptDigest: binding?.receiptDigest ?? null, themeMethod: '每次導航後注入 data-theme，僅探測深淺配色，非產品切換功能',
    sourceInputs: [], cells: [], browserErrors: [], externalRequests: [], assetFailures: [], failures: [], buildResponses: [] };
  const questions = [];
  for (const item of cases) {
    const file = `content/questions/exam/114-2/${item.id}.yaml`, raw = await readFile(resolve(root, file), 'utf8');
    report.sourceInputs.push({ file, sha256: createHash('sha256').update(raw).digest('hex') });
    questions.push({ ...item, question: parse(raw) });
  }
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : { channel: 'chrome' }) });
  try {
    for (const width of [320, 375, 1440]) for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 1050 : 812 }, deviceScaleFactor: 1, serviceWorkers: 'block', colorScheme: theme });
      const finish = binding ? watchBuildResponses(context, binding, base) : undefined;
      if (binding) await routeLocalOnly(context, base, report.externalRequests, report.assetFailures);
      else await context.route('**/*', (route) => {
        const url = route.request().url();
        if (/^https?:/.test(url) && new URL(url).origin !== base) { report.externalRequests.push(url); return route.abort(); }
        return route.continue();
      });
      const page = await context.newPage();
      page.on('pageerror', (error) => report.browserErrors.push(String(error)));
      page.on('response', (response) => { if (response.status() >= 400) report.assetFailures.push({ url: response.url(), status: response.status() }); });
      for (const { id, kind, question } of questions) {
        const cell = { id, kind, width, theme, selections: [], submissions: [], scrolls: [], screenshots: [], failures: [] };
        report.cells.push(cell);
        const capture = async (name) => {
          const file = `${id}-${width}-${theme}-${name}.png`;
          await page.screenshot({ path: resolve(output, file) }); cell.screenshots.push(file);
        };
        const verify = (measurement) => { try { assertContained(measurement); } catch (error) { cell.failures.push(error.message); } };
        try {
          const url = `${base}/questions/${id}/`;
          const navigate = async () => {
            const response = binding ? await gotoSettled(page, url) : await page.goto(url);
            assert.equal(response.status(), 200);
            cell.htmlSha256 = createHash('sha256').update(await response.body()).digest('hex');
            await page.waitForSelector('[data-question][data-ready]');
            await page.evaluate(async (theme) => {
              document.documentElement.dataset.theme = theme;
              await document.fonts.ready;
              await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            }, theme);
          };
          await navigate();
          cell.before = await page.evaluate(measureOptions); verify(cell.before);
          assert.equal(cell.before.theme, theme);
          await page.locator('.answer-options').scrollIntoViewIfNeeded(); await capture('options');
          assert.equal(cell.before.options.length, 4);
          if (kind === 'math') assert.ok(await page.locator('.option-content .katex').count(), '缺數學選項');
          for (const choice of choices) {
            const option = page.locator(`[data-option="${choice}"]`), input = option.locator('input');
            // 交替使用原 radio 與字母標籤，最後再核對選項內容的點擊代理。
            if (['A', 'C'].includes(choice)) await input.check(); else await option.locator('label').click();
            assert.equal(await input.isChecked(), true); cell.selections.push(choice);
            if (kind === 'code') {
              const expected = question.options[choice].match(/^```\w+\n([\s\S]*?)\n```$/)?.[1];
              assert.ok(expected, '測試資料缺程式選項');
              const pre = option.locator('pre');
              assert.equal((await pre.textContent()).replace(/\n$/, ''), expected, `${choice} 程式內容／縮排變更`);
              cell.scrolls.push({ choice, ...await scrollCodeToEnd(page, pre) });
              await capture(`rightmost-${choice}`);
            } else assert.equal(await option.locator('pre').count(), 0);
          }
          for (const chosen of [choices.find((choice) => choice !== question.answer), question.answer]) {
            if (cell.submissions.length) await navigate();
            const option = page.locator(`[data-option="${chosen}"]`);
            await option.locator('.option-content').click();
            assert.equal(await option.locator('input').isChecked(), true, '點選內容未選取答案');
            await page.locator('[data-answer-form] button[type="submit"]').click();
            await page.waitForSelector('[data-question][data-answered="true"][data-saved="true"]');
            assert.equal(await page.locator('[data-explanation]').isVisible(), true);
            assert.equal(await page.locator('[data-answer-form] input:disabled').count(), 4);
            assert.match(await page.locator(`[data-option="${question.answer}"] .option-status`).textContent(), /正解/);
            if (chosen !== question.answer) assert.match(await option.locator('.option-status').textContent(), /你的答案/);
            assert.ok((await page.locator('.explanation-correct').textContent()).trim());
            const measurement = await page.evaluate(measureOptions); verify(measurement);
            cell.submissions.push({ chosen, correct: chosen === question.answer, measurement });
            await page.locator('.answer-options').scrollIntoViewIfNeeded(); await capture(`submitted-${chosen}`);
            await page.locator('[data-explanation]').scrollIntoViewIfNeeded(); await capture(`explanation-${chosen}`);
          }
        } catch (error) { cell.failures.push(error.stack ?? String(error)); await capture('failure').catch(() => undefined); }
        report.failures.push(...cell.failures.map((failure) => `${id}/${width}/${theme}: ${failure}`));
      }
      try { if (finish) await finish(); else await context.close(); }
      catch (error) { report.failures.push(String(error)); }
      finally { if (finish) report.buildResponses.push(finish.evidence()); }
    }
    assert.equal(report.cells.length, 18);
    assert.equal(report.browserErrors.length, 0, '瀏覽器錯誤');
    assert.equal(report.externalRequests.length, 0, '外部請求');
    assert.equal(report.assetFailures.length, 0, '資產失敗');
    report.completed = !report.failures.length;
  } catch (error) { report.failures.push(error.stack ?? String(error)); }
  finally {
    await browser.close();
    await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
  }
  console.log(JSON.stringify({ completed: report.completed, cells: report.cells.length, failures: report.failures.length, output }));
  assert.ok(report.completed, `題目選項回歸失敗：${report.failures.length}，詳見 ${output}/report.json`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch((error) => { console.error(error); process.exitCode = 1; });
