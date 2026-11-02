/** 逐份速查驗證真錨點、六格、鍵盤與列印；只用協調者既有 preview 及全新 context。 */
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { parse } from 'yaml';
import { CELLS, loadContent, localUrl, routeLocalOnly, hasMath, freshOutput, readBuildReceipt, watchBuildResponses, assertExactLinks, supplementCounts, sourceFeatures, verifyFeatures } from '../rollout-smoke.mjs';

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
    const response = await page.goto(localUrl(path, base).href, { waitUntil: 'networkidle' }); assert.equal(response?.status(), 200, path);
    await page.evaluate(async (theme) => { document.documentElement.dataset.theme = theme; await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode().catch(() => undefined))); }, cell.theme);
    assert.equal(await page.locator('html').getAttribute('data-theme'), cell.theme);
  }
  try {
    for (const sheet of sheets) {
      const path = `/codes/${sheet.code}/cheatsheet/`;
      const entry = { code: sheet.code, path, status: '未執行', links: [], viewports: [] }; report.pages.push(entry);
      try {
        await go(`/codes/${sheet.code}/`); await page.locator(`a[href="${path}"]`).first().click(); await page.waitForURL((url) => url.pathname === path); await go(path);
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
          await go(path); await page.locator('.cheatsheet-body a[href^="/concepts/"]').nth(index).click();
          await page.waitForURL((location) => location.pathname === url.pathname && location.hash === url.hash);
          await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; }); assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
          const target = page.locator(`[id=${JSON.stringify(id)}]`); await target.waitFor({ state: 'visible' }); assert.equal(await target.count(), 1);
          entry.links.push({ href, id, builtId: true, clicked: true });
        }
        for (const cell of CELLS) {
          await go(path, cell);
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
          entry.viewports.push({ ...cell, dimensions, tables, features, screenshot: filename, manualReview: '未執行' });
        }
        await go(path); await page.setViewportSize({ width: 794, height: 1123 }); await page.emulateMedia({ media: 'print' });
        const print = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth, button: getComputedStyle(document.querySelector('.cheatsheet-top')).display, navigation: [...document.querySelectorAll('header.header, .sidebar-pane, .right-sidebar-container, .cheatsheet-jump')].map((e) => getComputedStyle(e).display) }));
        assert.ok(print.document <= print.viewport, JSON.stringify(print)); assert.equal(print.button, 'none'); assert.ok(print.navigation.every((display) => display === 'none'));
        entry.print = { ...print, verified: true }; await page.screenshot({ path: resolve(output, `${mode}-${sheet.code}-print.png`), fullPage: true, animations: 'disabled' }); entry.status = '通過';
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
