/** 以建置產物與隔離瀏覽器驗證每日題組；暫時伺服器在驗證後立即關閉。 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

export async function runDailySmoke() {
  const root = fileURLToPath(new URL('../../dist/', import.meta.url));
  const output = fileURLToPath(new URL('../../../tmp/daily/', import.meta.url));
  await mkdir(output, { recursive: true });
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const file = resolve(root, `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`);
      if (!file.startsWith(resolve(root) + sep)) { response.writeHead(403).end(); return; }
      response.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream');
      response.end(await readFile(file));
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  const report = { port: server.address().port, cases: [], errors: [], screenshots: [], additional: {} };
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
    const observe = (page) => {
      page.on('pageerror', (error) => report.errors.push(String(error)));
      page.on('console', (message) => { if (message.type() === 'error') report.errors.push(message.text()); });
    };
    const load = async (page, url) => { await page.goto(url); await page.locator('#daily-status').filter({ hasText: /已固定|距離 50/ }).waitFor(); };
    for (const width of [1440, 375]) for (const subject of [1, 3]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, timezoneId: 'America/Los_Angeles' });
      const page = await context.newPage(); observe(page);
      await load(page, `${base}/daily/?subject=${subject}`);
      const catalog = await page.locator('#daily-catalog').evaluate((element) => JSON.parse(element.textContent));
      const ids = await page.locator('#daily-cards [data-question]').evaluateAll((cards) => cards.map((card) => card.dataset.qid));
      assert.equal(ids.length, 50); assert.equal(new Set(ids).size, 50);
      const specials = catalog.filter((q) => ids.includes(q.id) && ['程式', '圖表'].includes(q.type)).length;
      if (subject === 3) assert.ok(specials >= 10 && specials <= 13);
      const first = page.locator('#daily-cards [data-question]:visible');
      const firstId = await first.getAttribute('data-qid');
      const answer = await first.getAttribute('data-answer');
      if (width === 1440 && subject === 1) await page.waitForFunction(() => !document.getElementById('daily-time').textContent.includes('0 分 0 秒'));
      await first.locator(`input[value="${answer}"]`).check();
      await first.locator('button[type="submit"]').click();
      await first.locator('[data-explanation]').waitFor({ state: 'visible' });
      assert.match(await page.locator('#daily-progress').textContent(), /已答 1／50 題・答對 1 題/);
      const attemptsBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('ipas-attempts-v1')).attempts);
      assert.match(attemptsBefore[0].mode, new RegExp(`^daily:\\d{4}-\\d{2}-\\d{2}:S${subject}$`));
      await page.reload(); await page.locator('#daily-progress').filter({ hasText: '已答 1／50' }).waitFor();
      assert.deepEqual(await page.locator('#daily-cards [data-question]').evaluateAll((cards) => cards.map((card) => card.dataset.qid)), ids);
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('ipas-attempts-v1')).attempts.length), 1);
      await page.locator('#daily-previous').click();
      assert.equal(await first.getAttribute('data-qid'), firstId);
      assert.equal(await first.locator(`input[value="${answer}"]`).isChecked(), true);
      assert.equal(await first.locator('button[type="submit"]').isDisabled(), true);
      assert.equal(await first.locator('[data-explanation]').isVisible(), true);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert.ok(overflow <= 0, `width=${width}, overflow=${overflow}`);
      const screenshot = resolve(output, `daily-${width}-S${subject}.png`);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.screenshot({ path: screenshot, fullPage: true }); report.screenshots.push(screenshot);
      report.cases.push({ width, subject, count: ids.length, specials, answered: 1, correct: 1, overflow, refreshFixed: true, restored: true, date: await page.locator('#daily-date').textContent(), elapsed: await page.locator('#daily-time').textContent(), sources: Object.fromEntries(['exam', 'guide', 'mock'].map((source) => [source, catalog.filter((q) => ids.includes(q.id) && q.source === source).length])) });
      await context.close();
    }
    const context = await browser.newContext(); const page = await context.newPage(); observe(page);
    await load(page, `${base}/daily/?subject=1`);
    const snapshot = await page.evaluate(() => ({ catalog: JSON.parse(document.getElementById('daily-catalog').textContent), set: JSON.parse(localStorage.getItem('ipas-daily-v1')) }));
    // 瀏覽器中的隔離快取故障，不修改實際題庫。
    await page.evaluate(() => { const cache = JSON.parse(localStorage.getItem('ipas-daily-v1')); cache.sets[0].questions[0].id = 'removed-question'; cache.sets[0].questions[1].rev = 999; localStorage.setItem('ipas-daily-v1', JSON.stringify(cache)); });
    await page.reload(); await page.locator('#daily-status').filter({ hasText: '2 題已移除' }).waitFor();
    assert.equal(await page.locator('#daily-cards [data-question]').count(), 48);
    report.additional.invalidCacheSkipped = 2;
    await page.evaluate((catalog) => {
      localStorage.clear();
      const verified = catalog.filter((q) => q.subject === 1 && q.review.status === 'verified');
      const attempts = verified.slice(0, -7).map((q, index) => ({ id: `old-${index}`, qid: q.id, rev: 99, choice: 'A', correct: true, ts: '2026-11-04T00:00:00Z', mode: 'question', ms: 0 }));
      localStorage.setItem('ipas-attempts-v1', JSON.stringify({ version: 1, attempts }));
    }, snapshot.catalog);
    await page.reload(); await page.locator('#daily-status').filter({ hasText: '缺 43 題' }).waitFor();
    assert.equal(await page.locator('#daily-cards [data-question]').count(), 7);
    report.additional.shortage = 43;
    await page.locator('#daily-subject').selectOption('3'); await page.getByRole('button', { name: '開啟今日題組' }).click();
    await page.locator('#daily-date').filter({ hasText: '科目 3' }).waitFor(); assert.equal(await page.locator('#daily-cards [data-question]').count(), 50);
    await page.locator('#daily-subject').selectOption('1'); await page.getByRole('button', { name: '開啟今日題組' }).click();
    await page.locator('#daily-status').filter({ hasText: '缺 43 題' }).waitFor();
    report.additional.subjectCachesIndependent = true;
    await page.goto(`${base}/quiz/`); await page.locator('#quiz:not([hidden])').waitFor();
    assert.equal(await page.locator('#quiz [data-question]').count(), 10); assert.equal(await page.locator('a[href="/daily/"]').count() > 0, true);
    report.additional.quizUnchanged = 10; await context.close();
    const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 1000 } });
    const plain = await noJs.newPage(); observe(plain); await plain.goto(`${base}/daily/`);
    assert.equal(await plain.locator('noscript').isVisible(), true); report.additional.noJavaScript = true; await noJs.close();
    const blocked = await browser.newContext(); const denied = await blocked.newPage(); observe(denied);
    await denied.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error('storage denied'); }; });
    await denied.goto(`${base}/daily/`); await denied.locator('#daily-status').filter({ hasText: '無法載入每日題組' }).waitFor();
    assert.equal(await denied.locator('#daily-practice').isVisible(), false); report.additional.storageDenied = true; await blocked.close();
    assert.equal(report.errors.length, 0);
    await writeFile(resolve(output, 'browser-report.json'), JSON.stringify(report, null, 2));
    return report;
  } finally { await browser?.close(); await new Promise((done) => server.close(done)); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) console.log(JSON.stringify(await runDailySmoke(), null, 2));
