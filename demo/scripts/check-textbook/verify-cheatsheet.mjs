/** 對既有 preview 驗證速查的真實連結、表格捲動與列印；不自行開關伺服器。 */
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

export async function verifyCheatsheet() {
  const root = resolve(import.meta.dirname, '../../..');
  const output = resolve(root, 'tmp/textbook/q2');
  const base = process.env.DEMO_URL ?? 'http://127.0.0.1:4321';
  const mode = process.env.Q2_MODE ?? 'real';
  const path = '/codes/L23303/cheatsheet/';
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
  const errors = [];
  const report = { mode, links: [], viewports: [], browserErrors: errors };
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/*', (route) => {
      const url = new URL(route.request().url());
      return ['127.0.0.1', 'localhost'].includes(url.hostname) ? route.continue() : route.abort();
    });
    await page.goto(base + '/codes/L23303/');
    await page.locator(`a[href="${path}"]`).click();
    await page.waitForSelector('.cheatsheet-body .katex');
    assert.equal(new URL(page.url()).pathname, path);
    assert.equal(await page.locator('.cheatsheet-body .katex-error').count(), 0);
    assert.ok(await page.locator('.cheatsheet-body .katex').count() > 0);
    assert.equal(await page.locator('.cheatsheet-body tr[data-supplement-kind="row"]').count() > 0, true);
    if (mode === 'fixture') assert.equal(await page.locator('.cheatsheet-body li[data-supplement-kind="list-item"]').count() > 0, true);
    const hrefs = await page.locator('.cheatsheet-body a[href^="/concepts/"]').evaluateAll((links) => links.map((link) => link.getAttribute('href')));
    if (mode === 'fixture') assert.equal(hrefs.length, 5, JSON.stringify(hrefs));
    for (const [index, href] of hrefs.entries()) {
      const url = new URL(href, base);
      const id = decodeURIComponent(url.hash.slice(1));
      const html = await readFile(resolve(root, 'demo/dist', '.' + url.pathname, 'index.html'), 'utf8');
      assert.ok(html.includes(`id="${id}"`), `建置 HTML 缺少 ${href} 的目標 ID`);
      await page.goto(base + path);
      await page.locator('.cheatsheet-body a[href^="/concepts/"]').nth(index).click();
      assert.equal(decodeURIComponent(new URL(page.url()).hash.slice(1)), id);
      const target = page.locator(`[id=${JSON.stringify(id)}]`);
      await target.waitFor({ state: 'visible' });
      assert.equal(await target.count(), 1);
      assert.equal(await target.isVisible(), true);
      report.links.push({ href, id, builtId: true, clicked: true });
    }
    for (const width of [320, 375, 1440]) for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 1050 });
      await page.goto(base + path);
      await page.evaluate(async (theme) => { document.documentElement.dataset.theme = theme; await document.fonts.ready; }, theme);
      const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
      assert.ok(dimensions.document <= width, JSON.stringify(dimensions));
      const tables = await page.locator('.cheatsheet-body .textbook-table-scroll').evaluateAll((elements) => elements.map((element) => ({ client: element.clientWidth, scroll: element.scrollWidth, tabIndex: element.tabIndex })));
      assert.ok(tables.every((table) => table.tabIndex === 0));
      if (width === 320) {
        assert.ok(tables.some((table) => table.scroll > table.client));
        const table = page.locator('.cheatsheet-body .textbook-table-scroll').first();
        await table.focus();
        await page.keyboard.press('ArrowRight');
        await page.waitForFunction(() => document.querySelector('.cheatsheet-body .textbook-table-scroll').scrollLeft > 0);
        await table.evaluate((element) => { element.scrollLeft = 0; element.blur(); });
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: resolve(output, `${mode}-${width}-${theme}.png`), fullPage: true, animations: 'disabled' });
      report.viewports.push({ width, theme, dimensions, tables });
    }
    await page.setViewportSize({ width: 794, height: 1123 });
    await page.emulateMedia({ media: 'print' });
    const print = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth, button: getComputedStyle(document.querySelector('.cheatsheet-top')).display }));
    assert.ok(print.document <= print.viewport, `列印溢出：${JSON.stringify(print)}`);
    assert.equal(print.button, 'none');
    report.print = print;
    await page.screenshot({ path: resolve(output, `${mode}-print.png`), fullPage: true, animations: 'disabled' });
    assert.deepEqual(errors, []);
    await writeFile(resolve(output, `${mode}-verification.json`), JSON.stringify(report, null, 2) + '\n');
    process.stdout.write(`${mode}：${hrefs.length} 個連結、${report.viewports.length} 組版面、列印驗證通過。\n`);
  } finally { await browser.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await verifyCheatsheet();
