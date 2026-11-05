/** 以建置產物與隔離瀏覽器驗證每日題組；暫時伺服器在驗證後立即關閉。 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { parse } from 'yaml';

export async function runDailySmoke() {
  const root = fileURLToPath(new URL('../../dist/', import.meta.url));
  const output = process.env.DAILY_SMOKE_OUTPUT ?? 'D:/ipas-study/tmp/question-bank/daily-official/';
  const contentRoot = fileURLToPath(new URL('../../../content/questions/', import.meta.url));
  const content = await Promise.all((await readdir(contentRoot, { recursive: true })).filter((name) => name.endsWith('.yaml')).map(async (name) => parse(await readFile(resolve(contentRoot, name), 'utf8'))));
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
  let browserServer;
  const report = { port: server.address().port, cases: [], errors: [], screenshots: [], additional: {} };
  try {
    browserServer = await chromium.launchServer({ headless: true, channel: 'chrome' });
    browser = await chromium.connect(browserServer.wsEndpoint());
    report.browser = { channel: 'chrome', version: browser.version() };
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
      assert.equal(catalog.filter((q) => ids.includes(q.id) && q.source !== 'mock').length, 0);
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
      assert.equal(await page.locator('#daily-position').textContent(), '第 1／50 題');
      await page.locator('#daily-next').click();
      await page.reload(); await page.locator('#daily-position').filter({ hasText: '第 2／50 題' }).waitFor();
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
    const officialBefore = 2;
    await page.evaluate(() => {
      const catalog = JSON.parse(document.getElementById('daily-catalog').textContent);
      const cache = JSON.parse(localStorage.getItem('ipas-daily-v1'));
      const old = [catalog.find((q) => q.subject === 1 && q.source === 'exam'), catalog.find((q) => q.subject === 1 && q.source === 'guide')];
      cache.sets[0].questions.splice(1, 2, ...old.map(({ id, rev }) => ({ id, rev })));
      localStorage.setItem('ipas-daily-v1', JSON.stringify(cache));
      localStorage.setItem('ipas-attempts-v1', JSON.stringify({ version: 1, attempts: [{ id: 'old-official', qid: old[0].id, rev: old[0].rev, choice: 'A', correct: true, ts: new Date().toISOString(), mode: 'daily:' + cache.sets[0].date + ':S1', ms: 500 }] }));
    });
    const beforeMigration = await page.evaluate(() => JSON.parse(localStorage.getItem('ipas-daily-v1')).sets[0].questions);
    await page.reload(); await page.locator('#daily-status').filter({ hasText: '已替換 2 題官方題' }).waitFor();
    const afterMigration = await page.evaluate(() => JSON.parse(localStorage.getItem('ipas-daily-v1')).sets[0].questions);
    const afterOfficial = afterMigration.filter((item) => snapshot.catalog.find((q) => q.id === item.id)?.source !== 'mock').length;
    assert.equal(afterOfficial, 0); assert.equal(afterMigration.length, 50);
    assert.match(await page.locator('#daily-progress').textContent(), /已答 0／50 題・答對 0 題/);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('ipas-attempts-v1')).attempts[0].id), 'old-official');
    assert.deepEqual(afterMigration.filter((_, i) => i !== 1 && i !== 2), beforeMigration.filter((_, i) => i !== 1 && i !== 2));
    report.additional.cacheMigration = { officialBefore, officialAfter: afterOfficial, count: afterMigration.length };
    // 瀏覽器中的隔離快取故障，不修改實際題庫。
    await page.evaluate(() => { const cache = JSON.parse(localStorage.getItem('ipas-daily-v1')); cache.sets[0].questions[0].id = 'removed-question'; cache.sets[0].questions[1].rev = 999; localStorage.setItem('ipas-daily-v1', JSON.stringify(cache)); });
    await page.reload(); await page.locator('#daily-status').filter({ hasText: '2 題已移除' }).waitFor();
    assert.equal(await page.locator('#daily-cards [data-question]').count(), 48);
    report.additional.invalidCacheSkipped = 2;
    await page.evaluate((catalog) => {
      localStorage.clear();
      const verified = catalog.filter((q) => q.subject === 1 && q.source === 'mock' && q.review.status === 'verified');
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
    report.official = [];
    for (const width of [1440, 375]) {
      const officialContext = await browser.newContext({ viewport: { width, height: 1000 } });
      const official = await officialContext.newPage(); observe(official);
      await official.goto(base + '/official/');
      await official.locator('#official-status').filter({ hasText: '各份題組分開' }).waitFor();
      const sets = await official.locator('#official-catalog').evaluate((element) => JSON.parse(element.textContent));
      assert.equal(sets.length, 6);
      assert.ok(await official.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      const indexShot = resolve(output, 'official-index-' + width + '.png');
      await official.screenshot({ path: indexShot, fullPage: true }); report.screenshots.push(indexShot);
      for (const set of sets) {
        const subject = Number(set.id.slice(-1));
        const session = set.id.slice(0, -3);
        const expected = content.filter((q) => q.subject === subject && (session === 'guide' ? q.source === 'guide' : q.source === 'exam' && q.session === session));
        assert.equal(set.questions.length, expected.length);
        // 同題在其他模式作答，不可預先增加官方題組進度。
        await official.evaluate((qid) => {
          const value = JSON.parse(localStorage.getItem('ipas-attempts-v1') ?? '{"version":1,"attempts":[]}');
          value.attempts.push({ id: 'other-' + qid, qid, rev: 1, choice: 'A', correct: true, ts: new Date().toISOString(), mode: 'quiz', ms: 800 });
          localStorage.setItem('ipas-attempts-v1', JSON.stringify(value));
        }, expected[0].id);
        await official.goto(base + '/official/' + set.id + '/');
        await official.locator('#official-status').filter({ hasText: '本份共' }).waitFor();
        const cards = official.locator('#official-cards [data-question]');
        assert.equal(await cards.count(), expected.length);
        assert.deepEqual((await cards.evaluateAll((items) => items.map((item) => item.dataset.qid))).sort(), expected.map((q) => q.id).sort());
        assert.match(await official.locator('#official-progress').textContent(), /已答 0／/);
        if (set.id === '115-1-S3') {
          const shot = resolve(output, 'official-115-1-S3-' + width + '.png');
          await official.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
          await official.screenshot({ path: shot, fullPage: true }); report.screenshots.push(shot);
        }
        const card = official.locator('#official-cards [data-question]:visible');
        const answer = await card.getAttribute('data-answer');
        if (width === 1440 && set.id === '114-2-S1') await official.waitForFunction(() => !document.getElementById('official-time').textContent.includes('0 分 0 秒'));
        await card.locator('input[value="' + answer + '"]').check();
        await card.locator('button[type="submit"]').click();
        await card.locator('[data-explanation]').waitFor({ state: 'visible' });
        const progress = await official.locator('#official-progress').textContent();
        assert.match(progress, /已答 1／.*答對 1 題/);
        if (session !== 'guide') assert.match(progress, /換算分數 2 分/);
        await official.locator('#official-next').click();
        await official.reload(); await official.locator('#official-position').filter({ hasText: '第 2／' }).waitFor();
        assert.match(await official.locator('#official-progress').textContent(), /已答 1／.*答對 1 題/);
        await official.locator('#official-previous').click();
        assert.equal(await card.locator('input[value="' + answer + '"]').isChecked(), true);
        assert.equal(await card.locator('button[type="submit"]').isDisabled(), true);
        assert.equal(await card.locator('[data-explanation]').isVisible(), true);
        if (width === 1440 && set.id === '114-2-S1') assert.doesNotMatch(await official.locator('#official-time').textContent(), /0 分 0 秒/);
        const overflow = await official.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        assert.ok(overflow <= 0);
        await official.goto(base + '/official/');
        await official.locator('#progress-' + set.id).filter({ hasText: '已答 1／' }).waitFor();
        report.official.push({ width, id: set.id, count: expected.length, correct: 1, answered: 1, refreshed: true, positionRestored: true, overflow });
      }
      await official.goto(base + '/official/115-1-S3/?position=2');
      await official.locator('#official-position').filter({ hasText: '第 2／' }).waitFor();
      const wrongCard = official.locator('#official-cards [data-question]:visible');
      const wrongId = await wrongCard.getAttribute('data-qid');
      const correctChoice = await wrongCard.getAttribute('data-answer');
      await wrongCard.locator('input[value="' + (correctChoice === 'A' ? 'B' : 'A') + '"]').check();
      await wrongCard.locator('button[type="submit"]').click();
      await official.goto(base + '/wrong-book/');
      await official.locator('a[href="/questions/' + wrongId + '/"]').first().waitFor();
      report.additional.officialWrongBook = true;
      await officialContext.close();
    }
    const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 1000 } });
    const plain = await noJs.newPage(); observe(plain); await plain.goto(`${base}/daily/`);
    assert.equal(await plain.locator('noscript').isVisible(), true); report.additional.noJavaScript = true;
    await plain.goto(base + '/official/'); assert.equal(await plain.locator('noscript').isVisible(), true);
    await plain.goto(base + '/official/115-1-S3/'); assert.equal(await plain.locator('noscript').isVisible(), true);
    report.additional.officialNoJavaScript = true; await noJs.close();
    const blocked = await browser.newContext(); const denied = await blocked.newPage(); observe(denied);
    await denied.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error('storage denied'); }; });
    await denied.goto(`${base}/daily/`); await denied.locator('#daily-status').filter({ hasText: '無法載入每日題組' }).waitFor();
    assert.equal(await denied.locator('#daily-practice').isVisible(), false); report.additional.storageDenied = true; await blocked.close();
    assert.equal(report.errors.length, 0);
    await writeFile(resolve(output, 'browser-report.json'), JSON.stringify(report, null, 2));
    return report;
  } finally {
    // 關閉這次測試建立的程序樹，避免 Chrome 關閉事件卡住而留下測試服務。
    try {
      if (browserServer) {
        const closing = browserServer.kill();
        // Windows 可能保留已結束程序的管線；釋放本次瀏覽器的管線後等待收尾。
        for (const stream of browserServer.process().stdio) stream?.destroy();
        let timeout;
        const closed = await Promise.race([closing.then(() => true), new Promise((done) => { timeout = setTimeout(() => done(false), 3000); })]);
        clearTimeout(timeout);
        if (!closed) {
          if (process.platform !== 'win32') throw new Error('測試瀏覽器未完成收尾。');
          const pid = browserServer.process().pid;
          assert.ok(Number.isInteger(pid));
          // 已結束的 Windows 程序仍可能不送出 close；確認程序已停止才允許 CLI 結束。
          execFileSync('powershell.exe', ['-NoProfile', '-Command', `$testBrowser = Get-Process -Id ${pid} -ErrorAction SilentlyContinue; if ($testBrowser -and -not $testBrowser.HasExited) { exit 1 }`], { windowsHide: true });
        }
        report.cleanup = { browserStopped: true, closeEventReceived: Boolean(closed) };
      }
    }
    finally {
      server.closeAllConnections(); await new Promise((done) => server.close(done));
      await writeFile(resolve(output, 'browser-report.json'), JSON.stringify(report, null, 2));
    }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = await runDailySmoke();
  process.stdout.write(JSON.stringify(report, null, 2) + '\n', () => process.exit(0));
}
