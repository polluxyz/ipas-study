/** 以建置產物與隔離瀏覽器驗證每日題本；暫時伺服器在驗證後立即關閉。 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { parse } from 'yaml';
import { waitCatalog, openCatalog, openNewBooklet, enterBooklet } from '../../scripts/daily-nav.mjs';

export async function runDailySmoke() {
  const root = process.env.DAILY_SMOKE_DIST || fileURLToPath(new URL('../../dist/', import.meta.url));
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
  const report = { port: server.address().port, dist: resolve(root), cases: [], errors: [], screenshots: [], additional: {} };
  try {
    browserServer = await chromium.launchServer({ headless: true, channel: 'chrome' });
    browser = await chromium.connect(browserServer.wsEndpoint());
    report.browser = { channel: 'chrome', version: browser.version() };
    const observe = (page) => {
      page.on('pageerror', (error) => report.errors.push(String(error)));
      page.on('console', (message) => { if (message.type() === 'error') report.errors.push(message.text()); });
    };
    const load = async (page, url) => { await page.goto(url); await waitCatalog(page); };
    const idsOnPage = (page) => page.locator('#daily-cards [data-question]').evaluateAll((cards) => cards.map((card) => card.dataset.qid));
    const openFirst = async (page, count, subject = 1) => {
      await openNewBooklet(page, base, subject);
      await page.locator('#daily-position').filter({ hasText: `第 1／${count} 題` }).waitFor();
      assert.equal(await page.locator('#daily-practice').isVisible(), true);
    };
    const readStore = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('ipas-daily-draft-v2')));
    const readAttempts = (page) => page.evaluate(() => localStorage.getItem('ipas-attempts-v1'));
    for (const width of [1440, 375]) for (const subject of [1, 3]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, timezoneId: 'America/Los_Angeles' });
      const page = await context.newPage(); observe(page);
      await load(page, `${base}/daily/?subject=${subject}`);
      assert.equal(await page.locator(`[data-open-subject="${subject}"]`).isVisible(), true);
      assert.deepEqual(await idsOnPage(page), []);
      assert.equal((await readStore(page)).booklets.length, 0);
      await page.reload(); await waitCatalog(page); await page.locator(`[data-open-subject="${subject}"]`).waitFor();
      assert.equal((await readStore(page)).booklets.length, 0);
      const attemptsBefore = await readAttempts(page);
      await openFirst(page, 50, subject);
      const catalog = await page.locator('#daily-catalog').evaluate((element) => JSON.parse(element.textContent));
      const ids = await idsOnPage(page);
      assert.equal(catalog.filter((q) => ids.includes(q.id) && q.source !== 'mock').length, 0);
      assert.equal(catalog.filter((q) => ids.includes(q.id) && q.source === 'mock' && q.subject === subject).length, 50);
      assert.equal(ids.length, 50); assert.equal(new Set(ids).size, 50);
      const specials = catalog.filter((q) => ids.includes(q.id) && ['程式', '圖表'].includes(q.type)).length;
      if (subject === 3) assert.ok(specials >= 10 && specials <= 13);
      const first = page.locator('#daily-cards [data-question]:visible');
      const firstId = await first.getAttribute('data-qid');
      const answer = await first.getAttribute('data-answer');
      if (width === 1440 && subject === 1) await page.waitForFunction(() => document.getElementById('daily-time').textContent !== '累計用時 0:00');
      await first.locator(`input[value="${answer}"]`).check();
      assert.equal(await first.locator('[data-explanation]').isVisible(), false);
      assert.match(await page.locator('#daily-progress').textContent(), /這本已答 1／50/);
      assert.equal(await readAttempts(page), attemptsBefore);
      const saved = (await readStore(page)).booklets[0];
      assert.equal(saved.questions[0].choice, answer);
      await page.reload(); await page.locator('#daily-progress').filter({ hasText: '這本已答 1／50' }).waitFor();
      assert.deepEqual(await idsOnPage(page), ids);
      assert.equal((await readStore(page)).booklets[0].id, saved.id);
      assert.equal(await readAttempts(page), attemptsBefore);
      assert.equal(await page.locator('#daily-position').textContent(), '第 1／50 題');
      await page.locator('#daily-next').click();
      await page.reload(); await page.locator('#daily-position').filter({ hasText: '第 2／50 題' }).waitFor();
      assert.equal((await readStore(page)).booklets[0].position, 1);
      await page.locator('#daily-previous').click();
      assert.equal(await first.getAttribute('data-qid'), firstId);
      assert.equal(await first.locator(`input[value="${answer}"]`).isChecked(), true);
      assert.equal(await first.locator(`input[value="${answer}"]`).isEnabled(), true);
      assert.equal(await first.locator('[data-explanation]').isVisible(), false);
      assert.equal(await readAttempts(page), attemptsBefore);
      if (width === 1440 && subject === 1) assert.ok((await readStore(page)).booklets[0].questions[0].ms >= 1000);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert.ok(overflow <= 0, `width=${width}, overflow=${overflow}`);
      const screenshot = resolve(output, `daily-${width}-S${subject}.png`);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.screenshot({ path: screenshot, fullPage: true }); report.screenshots.push(screenshot);
      report.cases.push({ width, subject, count: ids.length, specials, answered: 1, attemptsAdded: 0, explanationHidden: true, overflow, refreshFixed: true, restored: true, date: await page.locator('#daily-date').textContent(), elapsed: await page.locator('#daily-time').textContent(), sources: Object.fromEntries(['exam', 'guide', 'mock'].map((source) => [source, catalog.filter((q) => ids.includes(q.id) && q.source === source).length])) });
      await context.close();
    }
    const context = await browser.newContext(); const page = await context.newPage(); observe(page);
    await load(page, `${base}/daily/?subject=1`);
    const catalog = await page.locator('#daily-catalog').evaluate((element) => JSON.parse(element.textContent));
    const mock = catalog.filter((q) => q.subject === 1 && q.source === 'mock' && q.review.status === 'verified' && q.codes.length).slice(0, 50).map(({ id, rev }) => ({ id, rev }));
    const oldOfficial = ['exam', 'guide'].map((source) => catalog.find((q) => q.subject === 1 && q.source === source));
    const legacyQuestions = [...mock]; legacyQuestions.splice(1, 2, ...oldOfficial.map(({ id, rev }) => ({ id, rev })));
    const oldAttempt = { id: 'old-official', qid: oldOfficial[0].id, rev: oldOfficial[0].rev, choice: 'A', correct: true, ts: '2026-11-04T00:00:00Z', mode: 'daily:2026-11-05:S1', ms: 500 };
    // 先離開頁面才種資料，避免舊頁的離開保存覆蓋故障樣本。
    const seed = async (values) => {
      await page.goto(base + '/quiz/');
      await page.evaluate((entries) => { localStorage.clear(); for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, JSON.stringify(value)); }, values);
    };
    await seed({ 'ipas-daily-v1': { version: 1, sets: [{ date: '2026-11-05', subject: 1, questions: legacyQuestions }] }, 'ipas-attempts-v1': { version: 1, attempts: [oldAttempt] } });
    const attemptsBeforeMigration = await readAttempts(page);
    await load(page, `${base}/daily/?subject=1`);
    await enterBooklet(page, base, 1);
    const migrated = (await readStore(page)).booklets[0];
    const afterOfficial = migrated.questions.filter((item) => catalog.find((q) => q.id === item.id)?.source !== 'mock').length;
    assert.equal(afterOfficial, 0); assert.equal(migrated.questions.length, 48);
    assert.equal(await page.locator('#daily-cards [data-question]').count(), 48);
    assert.equal(migrated.origin, 'v1-set');
    assert.deepEqual(migrated.assignedQids, legacyQuestions.map((q) => q.id));
    assert.deepEqual(migrated.questions.map(({ id, rev }) => ({ id, rev })), legacyQuestions.filter((_, i) => i !== 1 && i !== 2));
    assert.equal(await readAttempts(page), attemptsBeforeMigration);
    assert.match(await page.locator('#daily-progress').textContent(), /這本已答 0／48/);
    report.additional.cacheMigration = { officialBefore: 2, officialAfter: afterOfficial, count: migrated.questions.length, oldAttemptsUnchanged: true };
    const makeStore = (id, subject, questions) => ({ version: 2, migratedAt: null, current: { '1': subject === 1 ? id : null, '3': subject === 3 ? id : null }, booklets: [{ id, seq: 0, subject, number: 1, createdDate: '2026-11-05', attemptMode: `booklet:${id}:S${subject}`, origin: 'new', status: 'open', position: 0, assignedQids: questions.map((q) => q.id), questions: questions.map(({ id, rev }) => ({ id, rev, choice: null, unsure: false, ms: 0 })) }] });
    // 失效題仍留在已分配清單，驗證略過後不會補新題。
    const invalid = mock.map((q) => ({ ...q })); invalid[0].id = 'removed-question'; invalid[1].rev = 999;
    await seed({ 'ipas-daily-draft-v2': makeStore('invalid-fixture', 1, invalid) });
    await load(page, `${base}/daily/?subject=1`);
    await enterBooklet(page, base, 1, 'invalid-fixture');
    await page.locator('#daily-status').filter({ hasText: '2 題已移除或改版，已略過，不補題。' }).waitFor();
    assert.equal(await page.locator('#daily-cards [data-question]').count(), 48);
    const reconciled = (await readStore(page)).booklets[0];
    assert.deepEqual(reconciled.questions.map((q) => q.id), invalid.slice(2).map((q) => q.id));
    assert.deepEqual(reconciled.assignedQids, invalid.map((q) => q.id));
    report.additional.invalidCacheSkipped = 2;
    const verified = catalog.filter((q) => q.subject === 1 && q.source === 'mock' && q.review.status === 'verified' && q.codes.length);
    const attempts = verified.slice(0, -7).map((q, index) => ({ id: `old-${index}`, qid: q.id, rev: 99, choice: 'A', correct: true, ts: '2026-11-04T00:00:00Z', mode: 'question', ms: 0 }));
    await seed({ 'ipas-attempts-v1': { version: 1, attempts } });
    await load(page, `${base}/daily/?subject=1`);
    assert.equal(await page.locator('[data-open-subject="1"]').textContent(), '開第 1 本（7 題）');
    assert.equal((await readStore(page)).booklets.length, 0);
    await openFirst(page, 7);
    assert.equal(await page.locator('#daily-cards [data-question]').count(), 7);
    assert.equal(await page.locator('#daily-partial-note').isVisible(), true);
    assert.equal(await page.locator('#daily-partial-note').textContent(), '本題本共 7 題。未做題不足 50 題，不換算正式模擬卷分數。');
    const shortIds = await idsOnPage(page); const shortBook = (await readStore(page)).current['1'];
    report.additional.shortage = { missing: 43, count: 7, partialNote: true };
    await openCatalog(page, base, 3); await page.locator('[data-open-subject="3"]').waitFor();
    assert.deepEqual(await idsOnPage(page), []);
    await openFirst(page, 50, 3);
    assert.equal(await page.locator('#daily-cards [data-question]').count(), 50);
    await enterBooklet(page, base, 1, shortBook); await page.locator('#daily-position').filter({ hasText: '第 1／7 題' }).waitFor();
    assert.deepEqual(await idsOnPage(page), shortIds);
    assert.equal((await readStore(page)).current['1'], shortBook);
    report.additional.subjectCachesIndependent = true;
    await page.goto(`${base}/quiz/`); await page.locator('#quiz:not([hidden])').waitFor();
    assert.equal(await page.locator('#quiz [data-question]').count(), 10); assert.equal(await page.locator('a[href="/daily/"]').count() > 0, true);
    report.additional.quizUnchanged = 10;
    // 題庫後段可能超過原比例，另種 14 題程式題驗證原因提示。
    const subjectThree = catalog.filter((q) => q.subject === 3 && q.source === 'mock' && q.review.status === 'verified' && q.codes.length);
    const codeHeavy = [...subjectThree.filter((q) => q.type === '程式').slice(0, 14), ...subjectThree.filter((q) => !['程式', '圖表'].includes(q.type)).slice(0, 36)];
    assert.equal(codeHeavy.length, 50);
    await seed({ 'ipas-daily-draft-v2': makeStore('code-heavy-fixture', 3, codeHeavy) });
    await load(page, `${base}/daily/?subject=3`);
    await enterBooklet(page, base, 3, 'code-heavy-fixture');
    assert.equal(await page.locator('#daily-code-note').isVisible(), true);
    assert.equal(await page.locator('#daily-code-note').textContent(), '這本有 14 題程式題，因為未做的非程式題變少。');
    assert.equal(await page.locator('#daily-cards [data-question]').count(), 50);
    report.additional.programHeavyNotice = { count: 50, programQuestions: 14, notice: true };
    await context.close();
    report.official = [];
    for (const width of [1440, 375]) {
      const officialContext = await browser.newContext({ viewport: { width, height: 1000 } });
      const official = await officialContext.newPage(); observe(official);
      await official.goto(base + '/official/');
      await official.locator('#official-status').filter({ hasText: '各份題組分開記錄' }).waitFor();
      const sets = await official.locator('#official-catalog').evaluate((element) => JSON.parse(element.textContent));
      assert.equal(sets.length, 6);
      assert.deepEqual((await official.locator('[data-official-set]').evaluateAll((cards) => cards.map((card) => card.dataset.officialSet))).sort(), ['114-2-S1', '114-2-S3', '115-1-S1', '115-1-S3', 'guide-S1', 'guide-S3']);
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
        const roundsBefore = await official.evaluate(() => localStorage.getItem('ipas-official-rounds-v1'));
        await official.goto(base + '/official/' + set.id + '/');
        let openedRound;
        if (session === 'guide') {
          await official.locator('#official-status').filter({ hasText: '本份共' }).waitFor();
        } else {
          await official.locator('#official-round-action button').filter({ hasText: '開始作答' }).waitFor();
          assert.equal(await official.evaluate(() => localStorage.getItem('ipas-official-rounds-v1')), roundsBefore);
          await official.locator('#official-round-action button').click();
          await official.locator('#official-position').filter({ hasText: '第 1 題／共' }).waitFor();
          const rounds = await official.evaluate(() => JSON.parse(localStorage.getItem('ipas-official-rounds-v1')).rounds);
          assert.equal(rounds.length, (roundsBefore ? JSON.parse(roundsBefore).rounds.length : 0) + 1);
          assert.equal(rounds.filter((round) => round.setId === set.id).length, 1);
          openedRound = rounds.find((round) => round.setId === set.id);
          assert.equal(openedRound.number, 1);
          assert.equal(openedRound.questions.length, expected.length);
          assert.deepEqual(openedRound.questions.map((q) => q.id).sort(), expected.map((q) => q.id).sort());
        }
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
        if (session === 'guide') await official.waitForFunction(() => !document.getElementById('official-time').textContent.includes('0 分 0 秒'));
        await card.locator('input[value="' + answer + '"]').check();
        if (session === 'guide') {
          await card.locator('button[type="submit"]').click();
          await card.locator('[data-explanation]').waitFor({ state: 'visible' });
          assert.match(await official.locator('#official-progress').textContent(), /已答 1／.*答對 1 題/);
          await official.locator('#official-next').click();
          await official.reload(); await official.locator('#official-position').filter({ hasText: '第 2／' }).waitFor();
          assert.match(await official.locator('#official-progress').textContent(), /已答 1／.*答對 1 題/);
          await official.locator('#official-previous').click();
          assert.equal(await card.locator('input[value="' + answer + '"]').isChecked(), true);
          assert.equal(await card.locator('button[type="submit"]').isDisabled(), true);
          assert.equal(await card.locator('[data-explanation]').isVisible(), true);
          assert.doesNotMatch(await official.locator('#official-time').textContent(), /0 分 0 秒/);
        } else {
          assert.equal(await card.locator('[data-explanation]').isVisible(), false);
          assert.equal(await official.locator('[data-explanation]:visible, .option-status:not(:empty):visible, .is-correct:visible, .is-wrong:visible, #official-score:visible').count(), 0);
          assert.doesNotMatch(await official.locator('#official-practice').ariaSnapshot(), /參考答案|官方答案|為什麼 [ABCD] 正確|答對了|你的答案|其他選項的問題|已答.*答對/);
          assert.equal(await official.locator('#official-progress').textContent(), `已答 1／${expected.length}`);
          await official.reload(); await official.locator('#official-progress').filter({ hasText: `已答 1／${expected.length}` }).waitFor();
          assert.equal(await card.locator('input[value="' + answer + '"]').isChecked(), true);
          assert.equal(await card.locator('[data-explanation]').isVisible(), false);
          const restored = await official.evaluate((id) => JSON.parse(localStorage.getItem('ipas-official-rounds-v1')).rounds.find((round) => round.id === id), openedRound.id);
          assert.equal(restored.status, 'open');
          assert.equal(restored.questions[0].choice, answer);
          assert.deepEqual((await cards.evaluateAll((items) => items.map((item) => item.dataset.qid))).sort(), expected.map((q) => q.id).sort());
        }
        const overflow = await official.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        assert.ok(overflow <= 0);
        await official.goto(base + '/official/');
        await official.locator('#progress-' + set.id).filter({ hasText: session === 'guide' ? '已答 1／' : `作答中・已答 1／${expected.length}` }).waitFor();
        if (session !== 'guide') assert.equal(await official.locator('#action-' + set.id).innerText(), '繼續作答 →');
        report.official.push({ width, id: set.id, count: expected.length, correct: session === 'guide' ? 1 : null, answered: 1, refreshed: true, positionRestored: true, roundsAdded: session === 'guide' ? 0 : 1, explanationHidden: session !== 'guide', overflow });
      }
      await official.goto(base + '/official/guide-S3/?position=2');
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
    await load(denied, `${base}/daily/`);
    const beforeDenied = await readStore(denied);
    // 先完成空資料遷移，再拒絕所有保存，才能單獨驗證開本失敗。
    await denied.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('storage denied'); }; });
    await denied.locator('[data-open-subject="1"]').click();
    await denied.locator('#daily-error-message').filter({ hasText: '題本尚未建立，原本的題本不變。' }).waitFor();
    assert.equal(await denied.locator('#daily-save-error').isVisible(), true);
    assert.equal(await denied.locator('#daily-practice').isVisible(), false);
    assert.deepEqual(await idsOnPage(denied), []);
    assert.deepEqual(await readStore(denied), beforeDenied);
    assert.equal(await denied.locator('[data-open-subject="1"]').isVisible(), true);
    report.additional.storageDenied = true; await blocked.close();
    assert.equal(report.errors.length, 0);
    await writeFile(resolve(output, 'browser-report.json'), JSON.stringify(report, null, 2));
    return report;
  } catch (cause) {
    report.failure = String(cause instanceof Error ? cause.stack : cause);
    throw cause;
  } finally {
    // 關閉這次測試建立的程序樹，避免 Chrome 關閉事件卡住而留下測試服務。
    try {
      // 斷言失敗時也關閉本次建立的全部隔離 context。
      if (browser) await Promise.all(browser.contexts().map((context) => context.close()));
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
