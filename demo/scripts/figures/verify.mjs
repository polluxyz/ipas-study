/** 驗證自己的隔離建置與離線輸出，留下桌面、窄螢幕、深色截圖及可重查的數字。 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

export async function verify() {
  const base = process.env.DEMO_URL ?? 'http://127.0.0.1:4322';
  const output = fileURLToPath(new URL('../../../tmp/textbook/shots/', import.meta.url));
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
  const errors = [], external = [], failed = [], fontRequests = [];
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (['http:', 'https:'].includes(url.protocol) && !['127.0.0.1', 'localhost'].includes(url.hostname)) { external.push(url.href); return route.abort(); }
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => failed.push(request.url()));
  page.on('request', (request) => { if (/\.(woff2?|ttf)(?:\?|$)/.test(request.url())) fontRequests.push(request.url()); });
  const report = { figures: 0, formulas: 0, mathml: 0, searchable: false, collapsed: false, mobileWidth: 0, fonts: fontRequests, errors, external, failed };
  const screenshot = async (name) => {
    await page.evaluate(() => { window.scrollTo({ top: 0, behavior: 'instant' }); });
    await page.waitForFunction(() => window.scrollY === 0);
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
    await page.screenshot({ path: resolve(output, name), fullPage: true, animations: 'disabled' });
  };
  try {
    await page.goto(`${base}/dev/figures/`);
    await page.evaluate(async () => { await document.fonts.ready; });
    report.figures = await page.locator('.textbook-figure').count(); assert.equal(report.figures, 5);
    report.formulas = await page.locator('.katex').count(); assert.equal(report.formulas, 3);
    report.mathml = await page.locator('math').count(); assert.equal(report.mathml, 3);
    assert.equal(await page.locator('.katex[data-pagefind-ignore]').count(), 3);
    assert.equal(await page.locator('.textbook-figure svg[role="img"] title').count(), 5);
    assert.equal(await page.locator('.textbook-figure figcaption').count(), 5);
    report.collapsed = await page.locator('.textbook-advanced').evaluate((el) => !el.open); assert.ok(report.collapsed);
    await page.locator('.textbook-advanced > summary').click();
    assert.ok(await page.getByText('同分樣本一起跨過閾值').isVisible());
    await page.locator('.textbook-advanced > summary').click();
    await page.locator('.figure-values > summary').first().click();
    assert.ok(await page.locator('.figure-values table').first().isVisible());
    await page.locator('.figure-values > summary').first().click();
    const search = await page.evaluate(async () => {
      const pagefind = await import('/pagefind/pagefind.js');
      const result = await pagefind.search('精確率');
      const pages = await Promise.all(result.results.map((r) => r.data()));
      return pages.map((p) => p.url);
    });
    report.searchable = search.some((url) => url.includes('/dev/figures/')); assert.ok(report.searchable, 'Pagefind 搜得到公式周圍中文');
    await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; window.scrollTo({ top: 0, behavior: 'instant' }); });
    await screenshot('s1-desktop.png');
    await page.setViewportSize({ width: 375, height: 812 });
    report.mobileWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.equal(report.mobileWidth, 375);
    assert.ok(await page.locator('.textbook-figure .figure-scroll').first().evaluate((el) => el.scrollWidth > el.clientWidth));
    await screenshot('s1-mobile.png');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; window.scrollTo({ top: 0, behavior: 'instant' }); });
    const contrast = await page.locator('.textbook-figure').first().evaluate((el) => {
      const luminance = (color) => {
        const rgb = color.match(/[\d.]+/g).slice(0, 3).map(Number).map((value) => { const c = value / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; });
        return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
      };
      const style = getComputedStyle(el), fg = luminance(style.color), bg = luminance(style.backgroundColor);
      return (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05);
    });
    report.darkTextContrast = contrast; assert.ok(contrast >= 4.5, '深色圖說文字對比');
    await screenshot('s1-dark.png');
    assert.ok(fontRequests.some((url) => url.includes('KaTeX')));
    assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(failed, []);
    const noJs = await browser.newContext({ javaScriptEnabled: false });
    const staticPage = await noJs.newPage(); await staticPage.goto(`${base}/dev/figures/`);
    assert.equal(await staticPage.locator('.textbook-figure svg').count(), 5);
    assert.equal(await staticPage.locator('math').count(), 3);
    await noJs.close();
    await writeFile(resolve(output, 's1-verification.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await verify();
