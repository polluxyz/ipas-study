/** 逐份速查驗證真錨點、六格、鍵盤與列印；只用協調者既有 preview 及全新 context。 */
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { parse } from 'yaml';
import { collectInlineCodeSamples, assertInlineCodeContrast } from '../prose-contrast.mjs';
import { CELLS, loadContent, localUrl, routeLocalOnly, hasMath, freshOutput, readBuildReceipt, watchBuildResponses, assertExactLinks, supplementCounts, sourceFeatures, verifyFeatures, gotoSettled, settlePage } from '../rollout-smoke.mjs';

export function sheetLinks(body) {
  return [...body.replace(/```[\s\S]*?```|`[^`\n]*`/g, '').matchAll(/(?<!!)\[[^\]]*\]\((\/concepts\/[^)]+)\)/g)].map((match) => match[1]);
}
export function canonicalSection(href) {
  const url = new URL(href, 'http://127.0.0.1');
  assert.ok(url.hash, `教材連結須指定小節：${href}`);
  return `${url.pathname}#${decodeURIComponent(url.hash.slice(1)).replace(/[\s\p{P}]/gu, '').toLowerCase()}`;
}
export function assertSheetContent(hrefs, rows, lists, body) {
  const expectedLinks = sheetLinks(body), expected = supplementCounts(body);
  assertExactLinks(hrefs.map(canonicalSection), expectedLinks.map(canonicalSection));
  assert.equal(rows, expected.rows, '補充表列須全部保留');
  assert.equal(lists, expected.lists, '補充清單項須全部保留');
  return { expectedLinks, ...expected };
}

/** 只檢查獨立的二、三字中文短標籤，逐字量位置，避免把一般長句換行視為缺陷。 */
export function measurePrintShortLabels() {
  const candidates = [...document.querySelectorAll('.cheatsheet-body th, .cheatsheet-body td, .cheatsheet-body a')]
    .filter((element) => /^[\p{Script=Han}]{2,3}$/u.test(element.textContent.trim()) && !element.querySelector('th, td, a'));
  const labels = candidates.map((element) => {
    const text = element.textContent.trim();
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const positions = [];
    let node;
    while ((node = walker.nextNode())) {
      for (let i = 0; i < node.length; i++) {
        if (!/\p{Script=Han}/u.test(node.data[i])) continue;
        const range = document.createRange();
        range.setStart(node, i); range.setEnd(node, i + 1);
        const rect = range.getBoundingClientRect();
        positions.push(Math.round(rect.top));
      }
    }
    return { text, lines: new Set(positions).size, cellWidth: element.closest('th, td')?.getBoundingClientRect().width ?? 0 };
  });
  const supplements = [...document.querySelectorAll('.cheatsheet-body .cheatsheet-print-supplement')].map((element) => {
    const range = document.createRange(); range.selectNodeContents(element);
    return { text: element.textContent, lines: new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size };
  });
  return { checked: labels.length, vertical: labels.filter((label) => label.lines === label.text.length), supplements: supplements.length, splitSupplements: supplements.filter((item) => item.lines > 1) };
}

/** 每次正式驗收先以瀏覽器實測直排負例與自然折行正例。 */
export async function verifyPrintShortLabelFixture(page) {
  await page.emulateMedia({ media: 'print' });
  await page.setContent('<div class="cheatsheet-body"><table style="table-layout:fixed;width:32px"><tr><th>教材</th></tr><tr><td><a>看教材</a></td></tr><tr><td><span class="cheatsheet-print-supplement">（補充）</span></td></tr></table></div><style>th,td{padding:0;font:16px sans-serif;overflow-wrap:anywhere}</style>');
  const bad = await page.evaluate(measurePrintShortLabels);
  assert.equal(bad.checked, 2); assert.deepEqual(bad.vertical.map((item) => item.text), ['教材', '看教材']); assert.equal(bad.splitSupplements.length, 1);
  await page.setContent('<div class="cheatsheet-body"><table><tr><td style="width:32px">這是一段需要自然換行的句子</td><td style="width:16px">字</td><td style="width:16px">2</td><td style="width:80px"><a>看教材</a></td><th style="width:50px">教材</th><td><span class="cheatsheet-print-supplement" style="white-space:nowrap">（補充）</span></td></tr></table></div><style>td,th{padding:0;font:16px sans-serif}</style>');
  const good = await page.evaluate(measurePrintShortLabels);
  assert.equal(good.checked, 2); assert.deepEqual(good.vertical, []); assert.equal(good.supplements, 1); assert.deepEqual(good.splitSupplements, []);
  await page.emulateMedia({ media: 'screen' });
  return { bad, good };
}

export async function verifyCheatsheet() {
  const root = resolve(import.meta.dirname, '../../..');
  assert.ok(process.env.Q2_OUTPUT ?? process.env.SMOKE_OUTPUT, '請由協調者指定獨立 Q2_OUTPUT 或 SMOKE_OUTPUT');
  const output = resolve(process.env.Q2_OUTPUT ?? process.env.SMOKE_OUTPUT);
  const base = localUrl(process.env.DEMO_URL ?? 'http://127.0.0.1:4321/', process.env.DEMO_URL ?? 'http://127.0.0.1:4321/').origin;
  const mode = process.env.Q2_MODE ?? 'real'; assert.ok(['real', 'fixture'].includes(mode));
  const binding = await readBuildReceipt();
  const content = await loadContent(root);
  let sheets = content.cheatsheets;
  if (mode === 'fixture') {
    const directory = resolve(import.meta.dirname, 'fixtures/cheatsheets'); sheets = [];
    for (const name of (await readdir(directory)).filter((name) => name.endsWith('.md'))) {
      const raw = await readFile(resolve(directory, name), 'utf8'); const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
      assert.ok(match); sheets.push({ ...parse(match[1]), body: raw.slice(match[0].length) });
    }
  }
  assert.ok(sheets.some((sheet) => sheet.code === 'L23303'), '保留 L23303 回歸');
  await freshOutput(output);
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, serviceWorkers: 'block' });
  const finishBuildCheck = watchBuildResponses(context, binding, base);
  const errors = []; const external = []; const assets = [];
  context.on('page', (page) => page.on('pageerror', (error) => errors.push({ url: page.url(), error: error.message })));
  context.on('response', (response) => { if (response.status() !== 200) assets.push({ url: response.url(), status: response.status() }); });
  context.on('requestfailed', (request) => assets.push({ url: request.url(), error: request.failure()?.errorText }));
  await routeLocalOnly(context, base, external, assets);
  const report = { mode, sha: binding.receipt.sha, buildSha: binding.receipt.sha, receiptDigest: binding.receiptDigest,
    pages: [], browserErrors: errors, externalRequests: external, assetFailures: assets, themeMethod: '每次導航後注入 data-theme 並斷言，非使用者主題切換', manualReview: '未執行：請協調者目視截圖' };
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  async function go(path, cell = CELLS[4]) {
    await page.setViewportSize({ width: cell.width, height: cell.height });
    const response = await gotoSettled(page, localUrl(path, base).href, { waitUntil: 'networkidle' }); assert.equal(response?.status(), 200, path);
    await page.evaluate(async (theme) => { document.documentElement.dataset.theme = theme; await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode().catch(() => undefined))); }, cell.theme);
    assert.equal(await page.locator('html').getAttribute('data-theme'), cell.theme);
  }
  try {
    report.printShortLabelFixture = await verifyPrintShortLabelFixture(page);
    for (const sheet of sheets) {
      const path = `/codes/${sheet.code}/cheatsheet/`;
      const entry = { code: sheet.code, path, status: '未執行', links: [], viewports: [] }; report.pages.push(entry);
      try {
        await go(`/codes/${sheet.code}/`); await settlePage(page); await page.locator(`a[href="${path}"]`).first().click(); await page.waitForURL((url) => url.pathname === path); await settlePage(page); await go(path);
        const body = page.locator('.cheatsheet-body'); await body.waitFor();
        const formulaExpected = hasMath(sheet.body);
        assert.equal(await body.locator('.katex-error').count(), 0);
        const formulas = await body.locator('.katex').count(); const mathml = await body.locator('.katex math').count();
        if (formulaExpected) assert.ok(formulas > 0, `${sheet.code} 原文有公式，輸出缺 KaTeX`);
        assert.equal(formulas, mathml, '每份實際公式需 MathML'); entry.formulas = { expected: formulaExpected, formulas, mathml };
        const rows = await body.locator('tr[data-supplement-kind="row"]').count();
        const lists = await body.locator('li[data-supplement-kind="list-item"]').count();
        const expectedRows = supplementCounts(sheet.body).rows;
        if (mode === 'fixture') assert.ok(await body.locator('li[data-supplement-kind="list-item"]').count() > 0);
        entry.supplementRows = { expectedRows, actual: rows };
        const hrefs = await body.locator('a[href^="/concepts/"]').evaluateAll((links) => links.map((link) => link.getAttribute('href')));
        const sourceExpected = assertSheetContent(hrefs, rows, lists, sheet.body);
        entry.expectedLinks = sourceExpected.expectedLinks.map(canonicalSection); entry.supplementLists = { expected: sourceExpected.lists, actual: lists };
        if (mode === 'fixture') assert.equal(hrefs.length, 5, JSON.stringify(hrefs));
        for (const [index, href] of hrefs.entries()) {
          const url = localUrl(href, base); const id = decodeURIComponent(url.hash.slice(1)); assert.ok(id, `看教材需指定小節：${href}`);
          const html = await readFile(resolve(root, 'demo/dist', '.' + url.pathname, 'index.html'), 'utf8'); assert.ok(html.includes(`id="${id}"`), `建置缺目標 ${href}`);
          await go(path); await settlePage(page); await page.locator('.cheatsheet-body a[href^="/concepts/"]').nth(index).click();
          await page.waitForURL((location) => location.pathname === url.pathname && location.hash === url.hash); await settlePage(page);
          await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; }); assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
          const target = page.locator(`[id=${JSON.stringify(id)}]`); await target.waitFor({ state: 'visible' }); assert.equal(await target.count(), 1);
          entry.links.push({ href, id, builtId: true, clicked: true });
        }
        for (const cell of CELLS) {
          await go(path, cell);
          const inlineCode = assertInlineCodeContrast(await page.evaluate(collectInlineCodeSamples, '.cheatsheet-body'));
          if (mode === 'real' && sheet.code === 'L21101') assert.ok(inlineCode.count > 0, '保留真實fit行內程式見證');
          const features = await verifyFeatures(page, sourceFeatures(sheet, 'before', content.concepts));
          assertSheetContent(await body.locator('a[href^="/concepts/"]').evaluateAll((links) => links.map((link) => link.getAttribute('href'))), await body.locator('tr[data-supplement-kind="row"]').count(), await body.locator('li[data-supplement-kind="list-item"]').count(), sheet.body);
          const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth, overflow: [document.documentElement, document.body].map((e) => getComputedStyle(e).overflowX) }));
          assert.ok(dimensions.document <= cell.width && dimensions.body <= cell.width, JSON.stringify(dimensions)); assert.ok(dimensions.overflow.every((o) => !['hidden', 'clip'].includes(o)));
          const tables = await body.locator('.textbook-table-scroll').evaluateAll((elements) => elements.map((e) => ({ client: e.clientWidth, scroll: e.scrollWidth, tabIndex: e.tabIndex }))); assert.ok(tables.every((table) => table.tabIndex === 0));
          if (sheet.code === 'L23303' && cell.width === 320) assert.ok(tables.some((table) => table.scroll > table.client), '保留 L23303 窄版表格局部橫捲回歸');
          for (const [index, table] of tables.entries()) if (table.scroll > table.client) {
            const element = body.locator('.textbook-table-scroll').nth(index); await element.focus(); assert.equal(await element.evaluate((e) => document.activeElement === e), true); await page.keyboard.press('ArrowRight');
            await page.waitForFunction((index) => document.querySelectorAll('.cheatsheet-body .textbook-table-scroll')[index].scrollLeft > 0, index); await element.evaluate((e) => { e.scrollLeft = 0; e.blur(); });
          }
          const filename = `${mode}-${sheet.code}-${cell.width}-${cell.theme}.png`; await page.screenshot({ path: resolve(output, filename), fullPage: true, animations: 'disabled' });
          entry.viewports.push({ ...cell, dimensions, tables, features, inlineCode, screenshot: filename, manualReview: '未執行' });
        }
        await go(path); await page.setViewportSize({ width: 794, height: 1123 }); await page.emulateMedia({ media: 'print' });
        const print = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth, button: getComputedStyle(document.querySelector('.cheatsheet-top')).display, navigation: [...document.querySelectorAll('header.header, .sidebar-pane, .right-sidebar-container, .cheatsheet-jump')].map((e) => getComputedStyle(e).display) }));
        assert.ok(print.document <= print.viewport, JSON.stringify(print)); assert.equal(print.button, 'none'); assert.ok(print.navigation.every((display) => display === 'none'));
        print.shortLabels = await page.evaluate(measurePrintShortLabels);
        assert.deepEqual(print.shortLabels.vertical, [], `短標籤逐字換行：${JSON.stringify(print.shortLabels.vertical)}`);
        assert.deepEqual(print.shortLabels.splitSupplements, [], `補充標記換行：${JSON.stringify(print.shortLabels.splitSupplements)}`);
        const printInlineCode = [];
        for (const theme of ['light', 'dark']) {
          await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
          const measured = assertInlineCodeContrast(await page.evaluate(collectInlineCodeSamples, '.cheatsheet-body'));
          if (mode === 'real' && sheet.code === 'L21101') assert.ok(measured.count > 0, '列印保留真實fit行內程式見證');
          printInlineCode.push({ theme, ...measured });
        }
        await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
        entry.print = { ...print, inlineCode: printInlineCode, verified: true }; await page.screenshot({ path: resolve(output, `${mode}-${sheet.code}-print.png`), fullPage: true, animations: 'disabled' }); entry.status = '通過';
      } catch (error) {
        entry.status = '失敗'; entry.failure = { url: page.url(), width: page.viewportSize()?.width, theme: await page.locator('html').getAttribute('data-theme').catch(() => null), error: String(error), screenshot: `${mode}-${sheet.code}-failure.png` };
        await page.screenshot({ path: resolve(output, entry.failure.screenshot), fullPage: true }).catch(() => undefined);
      } finally { await page.emulateMedia({ media: 'screen' }); }
    }
    await finishBuildCheck(); report.buildResponses = [finishBuildCheck.evidence()];
    assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(assets, []); report.completed = true;
  } finally {
    try { await finishBuildCheck(); }
    catch (error) { report.completed = false; report.failure = String(error); throw error; }
    finally {
      report.buildResponses = [finishBuildCheck.evidence()];
      report.passed = report.pages.filter((p) => p.status === '通過').length; report.total = sheets.length;
      await writeFile(resolve(output, `${mode}-verification.json`), JSON.stringify(report, null, 2) + '\n'); await browser.close();
    }
  }
  assert.equal(report.passed, report.total, `${report.passed}/${report.total} 份速查通過`); assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(assets, []);
  process.stdout.write(`${mode}：${report.passed}/${report.total} 份速查，${report.pages.reduce((n, p) => n + p.links.length, 0)} 個真錨點，${report.pages.reduce((n, p) => n + p.viewports.length, 0)} 格；截圖待人工複核。\n`);
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await verifyCheatsheet();
