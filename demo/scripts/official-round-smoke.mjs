/** 考古題輪次驗收使用隔離瀏覽器與暫時服務；預期答案讀題庫並核對建置版本，保留逐案與版面證據。 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { parse } from 'yaml';

const ROUND = 'ipas-official-rounds-v1';
const ATT = 'ipas-attempts-v1';
let BASE = 'http://127.0.0.1';
const NOW = '2026-11-12T10:00:00.000Z';
const SETS = ['114-2-S1', '114-2-S3', '115-1-S1', '115-1-S3'];
const MAIN = '115-1-S3';
const CONTENT_TEXT = ['.question-stem', '.question-code', '.question-image', '.option-content', '.explanation-summary', '.explanation-correct', '.wrong-reasons', '.dispute', '.judgment-rule', '.link-chips']
  .map((selector) => `[data-question] ${selector}`).join(', ');
const wrong = (answer) => answer === 'A' ? 'B' : 'A';
const cards = (page) => page.locator('#official-cards [data-question]:visible');
const snapshot = (page) => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map((key) => [key, localStorage.getItem(key)])));
const store = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{"version":1,"rounds":[]}'), ROUND);
const attempts = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{"version":1,"attempts":[]}').attempts, ATT);
const current = async (page) => (await store(page)).rounds.find((round) => round.id === new URL(page.url()).searchParams.get('round'));
const route = (setId, id) => `${BASE}/official/${setId}/${id ? '?round=' + encodeURIComponent(id) : ''}`;

async function seed(page, values = {}) {
  // 空白頁沒有產品的離頁保存事件，避免造資料時被前一頁覆蓋。
  await page.goto(BASE + '/__seed');
  await page.evaluate((values) => {
    localStorage.clear();
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, JSON.stringify(value));
  }, values);
}

async function listing(page, setId = MAIN) {
  await page.goto(route(setId));
  await page.locator('#official-round-list:visible').waitFor();
  await page.locator('#official-round-action > :visible').waitFor();
}

async function enter(page, setId, id) {
  await page.goto(route(setId, id));
  await page.locator('#official-practice:visible').waitFor();
  await cards(page).waitFor();
}

async function open(page, setId = MAIN) {
  await listing(page, setId);
  await page.locator('#official-round-action button').click();
  await page.waitForURL((url) => url.searchParams.has('round'));
  await cards(page).waitFor();
  return current(page);
}

async function answer(page, answers, correct = true) {
  const qid = await cards(page).getAttribute('data-qid');
  assert.ok(answers.has(qid), `題庫必須有 ${qid} 的官方答案`);
  const choice = correct ? answers.get(qid) : wrong(answers.get(qid));
  await cards(page).locator(`input[value="${choice}"]`).check();
  return choice;
}

async function fill(page, answers, count = 50, isCorrect = () => true) {
  for (let index = 0; index < count; index++) {
    await answer(page, answers, isCorrect(index));
    if (index + 1 < count) await page.locator('#official-next').click();
  }
}

async function submit(page) {
  assert.equal(await page.locator('#official-submit').isEnabled(), true);
  await page.locator('#official-submit').click();
  await page.locator('#official-dialog[open]').waitFor();
  await cleanWords(page, '交卷確認');
  await page.locator('#official-confirm').click();
  await page.locator('#official-score:visible').waitFor();
}

/** 依協調者確認排除教材用語；題卡內的按鈕、結果提示與保存錯誤仍照常掃描。 */
async function cleanWords(page, state) {
  const evidence = await page.evaluate((excluded) => {
    const visible = (element) => element.checkVisibility() && !element.closest('[hidden], dialog:not([open]), script, style') && !element.closest(excluded);
    const visibleText = (root) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const texts = []; let node;
      while ((node = walker.nextNode())) if (node.parentElement && visible(node.parentElement)) texts.push(node.textContent);
      return texts.join(' ');
    };
    const attributes = Array.from(document.querySelectorAll('[aria-label], [title]')).filter(visible)
      .flatMap((element) => [element.getAttribute('aria-label') ?? '', element.getAttribute('title') ?? '']);
    const messages = Array.from(document.querySelectorAll('[role="status"], [role="alert"]')).filter(visible).map(visibleText);
    return [document.title, visibleText(document.body), ...attributes, ...messages].join('\n');
  }, CONTENT_TEXT);
  assert.doesNotMatch(evidence, /輪|再考一次|重新考/, `${state} 不得顯示舊文字`);
}

async function directory(page) {
  await page.goto(BASE + '/official/');
  await page.locator(`#start-${MAIN}:visible, #action-${MAIN}:visible`).waitFor();
}

function completed(catalog, answers, { id, number = 1, status = 'submitted', correct = 50, createdAt = NOW } = {}) {
  const round = synthetic(catalog, answers, { id, answered: 50 });
  Object.assign(round, { number, status, createdAt });
  round.questions = round.questions.map((q, index) => ({ ...q, choice: index < correct ? q.choice : wrong(q.choice), correct: index < correct, ms: 1200 }));
  round.submission = { ts: NOW, total: 50, correct, attempts: round.questions.map((q, index) => ({
    id: `${id}-attempt-${index}`, qid: q.id, rev: q.rev, choice: q.choice, correct: q.correct, ts: NOW, mode: round.attemptMode, ms: q.ms,
  })) };
  return round;
}

async function score(page, correct, total = 50) {
  await page.locator('#official-score:visible').waitFor();
  assert.equal(await page.locator('#official-score-heading').innerText(), `答對 ${correct}／${total} 題`);
  assert.match(await page.locator('#official-score-points').innerText(), new RegExp(`^${correct * 2} 分／${total * 2} 分`));
  assert.equal(await page.locator('#official-submit').isVisible(), false);
  assert.equal(await cards(page).locator('input:enabled').count(), 0);
}

async function deferred(page) {
  assert.equal(await page.locator('[data-explanation]:visible, .dispute:visible, .is-correct:visible, .is-wrong:visible, .option-status:not(:empty):visible, #official-score:visible').count(), 0, '交卷前不得揭露結果');
  assert.doesNotMatch(await page.locator('#official-practice').ariaSnapshot(), /官方答案 [ABCD]|為什麼 [ABCD] 正確|答對了|答錯|正解|爭議說明|其他選項的問題/);
  const live = await page.locator('[aria-live]:visible, [role="status"]:visible, [role="alert"]:visible').allTextContents();
  assert.doesNotMatch(live.join('\n'), /答對|答錯|正解|官方答案 [ABCD]|爭議說明/);
  assert.equal((await attempts(page)).length, 0, '交卷前不得寫入作答紀錄');
}

function synthetic(catalog, answers, { id, answered = 0, position = 0 } = {}) {
  return { id, seq: 1, setId: catalog.id, subject: catalog.subject, number: 1, createdAt: NOW,
    attemptMode: `official-round:${id}:S${catalog.subject}`, status: 'open', position,
    questions: catalog.questions.map((q, index) => ({ id: q.id, rev: q.rev, choice: index < answered ? answers.get(q.id) : null, unsure: false, ms: 0 })) };
}

function legacy(catalog, answers) {
  return catalog.questions.slice(0, 3).map((q, index) => ({ id: `legacy-${index}`, qid: q.id, rev: q.rev,
    choice: index === 1 ? wrong(answers.get(q.id)) : answers.get(q.id), correct: index !== 1,
    ts: NOW, mode: 'official:115-1:S3', ms: 2000 + index }));
}

export async function runOfficialRoundSmoke() {
  const dist = process.env.OFFICIAL_ROUND_DIST ? resolve(process.env.OFFICIAL_ROUND_DIST) : fileURLToPath(new URL('../dist/', import.meta.url));
  const output = fileURLToPath(new URL('../../tmp/demo-shots/official-v2/', import.meta.url));
  const report = { dist, output, base: BASE, wordScanExcludedSelectors: CONTENT_TEXT.split(', '), startedAt: new Date().toISOString(), cases: [], layouts: [], screenshots: [], errors: [], exitCode: 1 };
  await mkdir(output, { recursive: true });
  let browser; let server;
  const contexts = new Set(); const fixtures = {}; const catalogs = new Map(); const answers = new Map();
  try {
    await readFile(resolve(dist, 'index.html'), 'utf8');
    for (const setId of SETS) {
      const html = await readFile(resolve(dist, `official/${setId}/index.html`), 'utf8');
      const json = html.match(/<script[^>]*id="official-catalog"[^>]*>([\s\S]*?)<\/script>/);
      assert.ok(json, `${setId} 必須有建置題庫`);
      const catalog = JSON.parse(json[1]); catalogs.set(setId, catalog);
      assert.equal(catalog.questions.length, 50);
      for (const q of catalog.questions) {
        const source = parse(await readFile(new URL(`../../content/questions/exam/${catalog.session}/${q.id}.yaml`, import.meta.url), 'utf8'));
        assert.equal(source.id, q.id); assert.equal(source.rev, q.rev, `${q.id} 題庫與建置版本必須相同`);
        assert.match(source.answer, /^[ABCD]$/); answers.set(q.id, source.answer);
      }
      assert.ok(catalog.questions.every((q) => answers.has(q.id)), `${setId} 的答案必須完整`);
    }
    const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
    server = createServer(async (request, response) => {
      try {
        const pathname = decodeURIComponent(new URL(request.url, BASE).pathname);
        if (pathname === '/__seed') { response.setHeader('content-type', 'text/html'); response.end('<!doctype html><title>隔離測試資料</title>'); return; }
        if (pathname === '/favicon.ico') { response.writeHead(204).end(); return; }
        const file = resolve(dist, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
        const child = relative(dist, file);
        if (child === '..' || child.startsWith('..' + sep) || resolve(dist, child) !== file) { response.writeHead(403).end(); return; }
        response.setHeader('content-type', mime[extname(file)] ?? 'application/octet-stream'); response.end(await readFile(file));
      } catch { response.writeHead(404).end(); }
    });
    await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
    BASE = `http://127.0.0.1:${server.address().port}`; report.base = BASE;
    // 允許瀏覽器真的採用返回快取，再以事件證據區分自然恢復與明確觸發的保護分支。
    browser = await chromium.launch({ headless: true, channel: 'chrome', ignoreDefaultArgs: ['--disable-back-forward-cache'] }); report.browser = browser.version();
    const newContext = async () => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Asia/Taipei' }); contexts.add(context);
      context.on('page', (page) => {
        page.setDefaultTimeout(10_000);
        page.on('pageerror', (error) => report.errors.push({ url: page.url(), message: error.message }));
      });
      return context;
    };
    const close = async (context) => { await context.close(); contexts.delete(context); };
    const newPage = async (context) => { const page = await context.newPage(); await page.clock.install({ time: new Date(NOW) }); return page; };
    const captureFailure = async (context, prefix) => {
      const files = [];
      for (const [index, page] of context.pages().entries()) {
        const file = resolve(output, `${prefix}-failure-${index + 1}.png`);
        try { await page.screenshot({ path: file, fullPage: true, timeout: 5000 }); files.push(file); } catch { /* 截圖失敗仍保留原始斷言。 */ }
        try {
          const evidence = { url: page.url(), storage: await snapshot(page), title: await page.title(), visibleText: await page.locator('body').innerText(), accessibility: await page.locator('body').ariaSnapshot() };
          const evidenceFile = resolve(output, `${prefix}-failure-${index + 1}.json`);
          await writeFile(evidenceFile, JSON.stringify(evidence, null, 2)); files.push(evidenceFile);
        } catch { /* 頁面已關閉時，案例堆疊仍在總報告中。 */ }
      }
      return files;
    };
    const runCase = async (id, name, run) => {
      const context = await newContext(); const result = { id, name, status: 'running', actual: {} }; report.cases.push(result);
      try { await run(context, result.actual); result.status = 'passed'; }
      catch (error) { result.status = 'failed'; result.failure = String(error.stack ?? error); result.screenshots = await captureFailure(context, `case-${id}`); }
      finally { await close(context); }
      console.log(`${id}. ${result.status === 'passed' ? '通過' : '失敗'}：${name}`);
      if (result.failure) console.error(result.failure);
    };

    await runCase(1, '開頁不寫入，開始建立第 1 筆並帶作答網址', async (context, actual) => {
      const page = await newPage(context); await seed(page); const before = await snapshot(page);
      await listing(page); assert.deepEqual(await snapshot(page), before);
      await page.locator('#official-round-action button').click(); await page.waitForURL((url) => url.searchParams.has('round')); await cards(page).waitFor();
      const data = await store(page); assert.equal(data.rounds.length, 1); assert.equal(data.rounds[0].number, 1);
      assert.equal(data.rounds[0].id, new URL(page.url()).searchParams.get('round'));
      Object.assign(actual, { openingWrites: 0, rounds: 1, number: 1 });
    });

    await runCase(2, '作答依序開放題號，Enter 與朗讀區域不揭露答案', async (context, actual) => {
      const page = await newPage(context); await seed(page); await open(page);
      assert.equal(await page.locator('#official-next').isDisabled(), true);
      assert.deepEqual(await page.locator('#official-numbers button').allTextContents(), ['1']); await deferred(page);
      for (let index = 0; index < 3; index++) {
        await answer(page, answers, index !== 1);
        await cards(page).locator('input:checked').press('Enter'); await deferred(page);
        assert.deepEqual(await page.locator('#official-numbers button').allTextContents(), Array.from({ length: index + 2 }, (_, i) => String(i + 1)));
        assert.equal(await page.locator('#official-submit').isDisabled(), true);
        await page.locator('#official-next').click(); assert.equal(await page.locator('#official-next').isDisabled(), true);
      }
      fixtures.answering = { values: await snapshotValues(page), setId: MAIN, id: (await current(page)).id };
      Object.assign(actual, { answered: 3, numbers: 4, revealedResults: 0, prematureAttempts: 0 });
    });

    await runCase(3, '爭議題交卷前只顯示中性標籤，交卷後依官方答案計分', async (context, actual) => {
      const catalog = [...catalogs.values()].find((item) => item.questions.some((q) => q.review.status === 'disputed'));
      assert.ok(catalog, '至少 1 題爭議考古題');
      const position = catalog.questions.findIndex((q) => q.review.status === 'disputed');
      const round = synthetic(catalog, answers, { id: 'disputed-round', answered: 50, position });
      const page = await newPage(context); await seed(page, { [ROUND]: { version: 1, rounds: [round] } }); await enter(page, catalog.id, round.id);
      await deferred(page); assert.equal(await cards(page).locator('.tag.amber').innerText(), '有爭議・依官方答案計分');
      await submit(page); await score(page, 50);
      assert.equal(await cards(page).locator('.dispute').isVisible(), true); assert.match(await cards(page).locator('.dispute').innerText(), /爭議說明/);
      const saved = (await attempts(page)).find((item) => item.qid === catalog.questions[position].id);
      assert.equal(saved.choice, answers.get(saved.qid)); assert.equal(saved.correct, true);
      Object.assign(actual, { setId: catalog.id, qid: saved.qid, officialAnswer: saved.choice, points: 100 });
    });

    await runCase(4, '離開再回來保留 3 答案、1 標記、第 3 題與用時', async (context, actual) => {
      const page = await newPage(context); await seed(page); const opened = await open(page);
      await fill(page, answers, 3); await page.locator('#official-unsure').click();
      const beforeTick = await current(page); await page.clock.runFor(16_000);
      const before = await current(page); const beforeMs = before.questions.reduce((sum, q) => sum + q.ms, 0);
      Object.assign(actual, { beforeMs, beforeTickSeq: beforeTick.seq, afterTickSeq: before.seq });
      assert.ok(before.seq > beforeTick.seq, '定時保存必須增加寫入次數'); assert.ok(beforeMs > 0, '定時保存必須保留正用時');
      await page.goto(BASE + '/'); await enter(page, MAIN, opened.id); const after = await current(page);
      assert.deepEqual(after.questions.map((q) => q.choice), before.questions.map((q) => q.choice));
      assert.deepEqual(after.questions.map((q) => q.unsure), before.questions.map((q) => q.unsure));
      assert.equal(after.position, 2); assert.match(await page.locator('#official-position').innerText(), /^第 3 題/);
      assert.equal(await page.locator('#official-unsure').getAttribute('aria-pressed'), 'true');
      const afterMs = after.questions.reduce((sum, q) => sum + q.ms, 0); assert.ok(afterMs >= beforeMs);
      const displayed = (await page.locator('#official-time').innerText()).match(/^本次用時 (\d+):(\d{2})$/);
      assert.ok(displayed); assert.ok(Number(displayed[1]) * 60 + Number(displayed[2]) >= Math.floor(beforeMs / 1000));
      assert.equal(await cards(page).locator('input:checked').inputValue(), after.questions[2].choice);
      Object.assign(actual, { answers: 3, unsure: 1, position: 3, beforeMs, afterMs });
    });

    await runCase(5, '混合對錯交卷計分、焦點、重整與返回快取均為唯讀', async (context, actual) => {
      const restoredEvents = [];
      await context.exposeBinding('recordOfficialPageShow', (_, event) => { restoredEvents.push(event); });
      const page = await newPage(context); await page.addInitScript(() => {
        window.addEventListener('pageshow', (event) => { void window.recordOfficialPageShow({ persisted: event.persisted, url: location.href }); });
      });
      await seed(page); const opened = await open(page);
      const expected = Array.from({ length: 50 }, (_, index) => index % 3 !== 0).filter(Boolean).length;
      await fill(page, answers, 50, (index) => index % 3 !== 0);
      // 先讓歷史記錄保留未交卷頁，另次載入交卷後再返回舊頁。
      await page.goto(BASE + '/'); await enter(page, MAIN, opened.id);
      await submit(page); await score(page, expected);
      assert.equal(await page.locator('#official-score').evaluate((element) => element === document.activeElement), true);
      const written = await attempts(page); assert.equal(written.length, 50); assert.equal(new Set(written.map((item) => item.id)).size, 50);
      assert.ok(written.every((item) => item.mode === `official-round:${opened.id}:S3`));
      assert.ok(written.every((item) => item.correct === (item.choice === answers.get(item.qid))));
      const submitted = await snapshot(page); fixtures.review = { values: await snapshotValues(page), setId: MAIN, id: opened.id };
      await page.reload(); await score(page, expected); assert.deepEqual(await snapshot(page), submitted);
      const eventStart = restoredEvents.length;
      await page.goBack({ waitUntil: 'commit' }); await page.waitForURL(BASE + '/', { waitUntil: 'commit' });
      await page.goBack({ waitUntil: 'commit' }); await score(page, expected); assert.deepEqual(await snapshot(page), submitted);
      const naturalEvents = restoredEvents.slice(eventStart);
      // 真實返回之外，也明確觸發快取恢復分支，避免環境未採快取時漏測保護。
      await Promise.all([page.waitForEvent('load'), page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })))]);
      await score(page, expected); assert.deepEqual(await snapshot(page), submitted);
      Object.assign(actual, { correct: expected, points: expected * 2, attempts: 50, uniqueIds: 50, scoreFocused: true, naturalEvents, naturalPersisted: naturalEvents.some((event) => event.persisted), persistedGuard: true });
    });

    await runCase(6, '重新開始暫停保存，保留舊答案並建立新紀錄', async (context, actual) => {
      const page = await newPage(context); const old = legacy(catalogs.get(MAIN), answers);
      await seed(page, { [ATT]: { version: 1, attempts: old } }); const opened = await open(page); await fill(page, answers, 3); await page.locator('#official-unsure').click();
      const before = await snapshot(page); const writes = [];
      await context.exposeBinding('recordRoundWrite', (_, key) => { writes.push(key); });
      await page.evaluate(() => {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) { void window.recordRoundWrite(key); return original.call(this, key, value); };
      });
      await page.locator('#official-restart').click(); await page.locator('#official-restart-dialog[open]').waitFor();
      fixtures.restart = { values: await snapshotValues(page), setId: MAIN, id: opened.id };
      await page.clock.runFor(16_000); assert.deepEqual(await snapshot(page), before); assert.deepEqual(writes, []);
      await page.locator('#official-restart-cancel').click(); assert.deepEqual(await snapshot(page), before);
      await page.clock.runFor(16_000); assert.ok(writes.includes(ROUND), '取消後恢復定時保存');
      const latest = await current(page);
      const displayedChoice = await cards(page).locator('input:checked').inputValue();
      const displayedPosition = await page.locator('#official-position').innerText();
      await page.locator('#official-restart').click(); await cleanWords(page, '重新開始確認'); await page.locator('#official-restart-confirm').click();
      await page.waitForURL((url) => url.searchParams.get('round') !== opened.id); await cards(page).waitFor();
      const restarted = await current(page); assert.notEqual(restarted.id, opened.id); assert.equal(restarted.number, opened.number + 1); assert.equal(restarted.status, 'open'); assert.equal(restarted.position, 0);
      assert.match(await page.locator('#official-position').innerText(), /^第 1 題/);
      assert.ok(restarted.questions.every((q) => q.choice === null && !q.unsure && q.ms === 0));
      assert.equal(await cards(page).locator('input:checked').count(), 0); assert.equal((await store(page)).rounds.length, 2);
      const retired = (await store(page)).rounds.find((round) => round.id === opened.id);
      assert.equal(retired.status, 'retired'); assert.equal(retired.position, latest.position);
      assert.deepEqual(retired.questions.map(({ id, rev, choice, unsure }) => ({ id, rev, choice, unsure })), latest.questions.map(({ id, rev, choice, unsure }) => ({ id, rev, choice, unsure })));
      assert.ok(retired.questions.every((q, index) => q.ms >= latest.questions[index].ms));
      assert.equal(retired.questions[retired.position].choice, displayedChoice);
      assert.match(displayedPosition, new RegExp(`^第 ${retired.position + 1} 題`));
      const retiredBytes = JSON.stringify(retired);
      await page.clock.runFor(16_000);
      assert.equal(JSON.stringify((await store(page)).rounds.find((round) => round.id === opened.id)), retiredBytes);
      fixtures.retired = { values: await snapshotValues(page), setId: MAIN, id: opened.id };
      await enter(page, MAIN, opened.id); await cleanWords(page, '舊網址未交卷紀錄');
      const retiredStore = await snapshot(page);
      await page.evaluate(() => { window.dispatchEvent(new PageTransitionEvent('pagehide')); document.dispatchEvent(new Event('visibilitychange')); });
      await page.clock.runFor(16_000); assert.deepEqual(await snapshot(page), retiredStore);
      assert.equal((await snapshot(page))[ATT], before[ATT]);
      Object.assign(actual, { pausedMs: 16_000, pausedWrites: 0, resumedSaving: true, number: restarted.number, oldRoundRetired: true, legacyUnchanged: old.length });
    });

    await runCase(7, '重新開始寫入失敗顯示尚未重新開始且資料不變', async (context, actual) => {
      const page = await newPage(context); await seed(page); await open(page); await answer(page, answers); const before = await snapshot(page);
      await page.evaluate((key) => {
        const original = Storage.prototype.setItem; window.smokeFailedWrites = 0;
        Storage.prototype.setItem = function (name, value) {
          if (name === key && window.smokeFailedWrites === 0) { window.smokeFailedWrites++; throw new DOMException('測試寫入失敗', 'QuotaExceededError'); }
          return original.call(this, name, value);
        };
      }, ROUND);
      await page.locator('#official-restart').click(); await page.locator('#official-restart-confirm').click(); await page.locator('#official-save-error:visible').waitFor();
      assert.match(await page.locator('#official-error-message').innerText(), /尚未重新開始/);
      assert.deepEqual(await snapshot(page), before); assert.equal(await page.evaluate(() => window.smokeFailedWrites), 1);
      await cleanWords(page, '重新開始錯誤');
      Object.assign(actual, { failedWrites: 1, storeUnchanged: true });
    });

    await runCase(8, '交卷後重新開始，第 1 次分數不變並顯示繼續作答', async (context, actual) => {
      const page = await newPage(context); await seed(page); const first = await open(page); await fill(page, answers); await submit(page); await score(page, 50);
      const saved = JSON.stringify((await store(page)).rounds.find((round) => round.id === first.id));
      assert.equal(await page.locator('#official-review-action button').innerText(), '重新開始');
      await page.locator('#official-review-action button').click(); await page.waitForURL((url) => url.searchParams.get('round') !== first.id); await cards(page).waitFor();
      const second = await current(page); assert.equal(second.number, 2); assert.equal(second.position, 0);
      await enter(page, MAIN, first.id); await score(page, 50);
      assert.equal(JSON.stringify((await store(page)).rounds.find((round) => round.id === first.id)), saved);
      assert.equal(await page.locator('#official-review-action a').first().innerText(), '繼續作答 →');
      assert.equal(new URL(await page.locator('#official-review-action a').first().getAttribute('href'), BASE).searchParams.get('round'), second.id);
      await listing(page); assert.equal(await page.locator('#official-round-rows .official-round-row').count(), 1);
      fixtures.list = { values: await snapshotValues(page), setId: MAIN };
      Object.assign(actual, { rounds: 2, firstPoints: 100, secondNumber: 2, continueLabel: '繼續作答 →' });
    });

    await runCase(9, '快速連按開始 3 次只建立 1 筆', async (context, actual) => {
      const page = await newPage(context); await seed(page); await listing(page);
      await page.locator('#official-round-action button').evaluate((button) => { for (let index = 0; index < 3; index++) button.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
      await page.waitForURL((url) => url.searchParams.has('round')); await cards(page).waitFor();
      assert.equal((await store(page)).rounds.length, 1); assert.equal((await current(page)).number, 1);
      Object.assign(actual, { clicks: 3, rounds: 1 });
    });

    await runCase(10, '4 份考古題交錯各答 2 題，只保存各自紀錄', async (context, actual) => {
      const page = await newPage(context); await seed(page); const ids = new Map();
      for (const setId of SETS) { ids.set(setId, (await open(page, setId)).id); await page.goto(BASE + '/'); }
      for (let pass = 0; pass < 2; pass++) for (const setId of SETS) {
        const before = (await store(page)).rounds.filter((round) => round.setId !== setId).map((round) => JSON.stringify(round));
        await enter(page, setId, ids.get(setId)); if (pass === 1) await page.locator('#official-next').click();
        await answer(page, answers, pass === 0); await page.clock.runFor(16_000); await page.goto(BASE + '/');
        const after = (await store(page)).rounds;
        assert.deepEqual(after.filter((round) => round.setId !== setId).map((round) => JSON.stringify(round)), before);
        const saved = after.find((round) => round.setId === setId);
        assert.equal(saved.questions.filter((q) => q.choice).length, pass + 1);
        assert.ok(saved.questions.every((q) => catalogs.get(setId).questions.some((own) => own.id === q.id)));
        assert.equal(saved.questions[0].choice, answers.get(saved.questions[0].id));
        if (pass === 1) assert.equal(saved.questions[1].choice, wrong(answers.get(saved.questions[1].id)));
      }
      assert.equal((await store(page)).rounds.length, 4); Object.assign(actual, { rounds: 4, answersPerRound: 2, interleavedSaves: 8, otherRoundsUnchanged: true });
    });

    await runCase(11, '舊即時作答經重新開始與交卷後逐筆不變', async (context, actual) => {
      const page = await newPage(context); const old = legacy(catalogs.get(MAIN), answers); const serialized = old.map((item) => JSON.stringify(item));
      await seed(page, { [ATT]: { version: 1, attempts: old } }); const first = await open(page); await answer(page, answers);
      await page.locator('#official-restart').click(); await page.locator('#official-restart-confirm').click();
      await page.waitForURL((url) => url.searchParams.has('round') && url.searchParams.get('round') !== first.id); await cards(page).waitFor();
      await fill(page, answers); await submit(page); await score(page, 50);
      await page.locator('#official-review-action button').click(); await page.locator('#official-score').waitFor({ state: 'hidden' }); await cards(page).waitFor();
      const saved = await attempts(page); assert.equal(saved.length, 53);
      assert.deepEqual(saved.filter((item) => item.mode === 'official:115-1:S3').map((item) => JSON.stringify(item)), serialized);
      const raw = (await snapshot(page))[ATT]; assert.ok(serialized.every((item) => raw.includes(item)));
      Object.assign(actual, { oldAttempts: 3, totalAttempts: 53, legacyBytesUnchanged: true });
    });

    // 每種目錄狀態各有獨立案例，方便直接定位按鈕與連結的差異。
    const catalog = catalogs.get(MAIN);
    const past = completed(catalog, answers, { id: 'past', number: 2, correct: 38 });
    const active = { ...synthetic(catalog, answers, { id: 'active', answered: 3, position: 2 }), number: 3 };
    const retired = { ...synthetic(catalog, answers, { id: 'retired', answered: 3, position: 2 }), number: 4, status: 'retired' };
    retired.questions[2].unsure = true; retired.questions[2].ms = 23_000;
    const directoryStates = [
      { name: '沒紀錄', rounds: [], button: '開始作答', links: [] },
      { name: '作答中', rounds: [active], progress: '作答中・已答 3／50', links: [['action', '繼續作答 →', active.id]] },
      { name: '有交卷沒作答中', rounds: [past], button: '重新開始', history: '已交卷 1 次・最近 76 分', links: [['latest', '查看上次作答 →', past.id], ['records', '全部紀錄 →', null]] },
      { name: '有交卷也有作答中', rounds: [past, active], progress: '作答中・已答 3／50', history: '已交卷 1 次・最近 76 分', links: [['action', '繼續作答 →', active.id], ['latest', '查看上次作答 →', past.id], ['records', '全部紀錄 →', null]] },
      { name: '只有未交卷紀錄', rounds: [retired], button: '重新開始', links: [['records', '全部紀錄 →', null]] },
    ];
    for (const [index, state] of directoryStates.entries()) await runCase(12 + index, `目錄狀態：${state.name}`, async (context, actual) => {
      const page = await newPage(context); await seed(page, { [ROUND]: { version: 1, rounds: state.rounds } });
      const before = await snapshot(page); await directory(page); await cleanWords(page, state.name);
      const card = page.locator(`[data-official-set="${MAIN}"]`);
      assert.equal(await page.locator(`#start-${MAIN}`).isVisible(), Boolean(state.button));
      if (state.button) assert.equal(await page.locator(`#start-${MAIN}`).innerText(), state.button);
      for (const prefix of ['action', 'latest', 'records']) {
        const expected = state.links.find(([key]) => key === prefix); const link = page.locator(`#${prefix}-${MAIN}`);
        assert.equal(await link.isVisible(), Boolean(expected), `${prefix} 顯示狀態`);
        if (expected) { assert.equal(await link.innerText(), expected[1]); assert.equal(new URL(await link.getAttribute('href'), BASE).href, route(MAIN, expected[2])); }
      }
      for (const [prefix, expected] of [['progress', state.progress], ['history', state.history]]) {
        const element = page.locator(`#${prefix}-${MAIN}`); assert.equal(await element.isVisible(), Boolean(expected));
        if (expected) assert.equal(await element.innerText(), expected);
      }
      await page.clock.runFor(16_000); assert.deepEqual(await snapshot(page), before);
      Object.assign(actual, { state: state.name, text: await card.innerText(), unchanged: true });
      if (state.history && state.progress) fixtures.directory = { values: await snapshotValues(page), path: '/official/' };
    });

    await runCase(17, '目錄不恢復 submitting，所有儲存字串逐字不變', async (context, actual) => {
      const pending = completed(catalog, answers, { id: 'pending-directory', status: 'submitting' });
      const page = await newPage(context); await seed(page, { [ROUND]: { version: 1, rounds: [pending, { ...retired, number: 2 }] } });
      // 刻意保留空白與換行，避免只比對解析後的物件而漏掉隱性重寫。
      await page.evaluate((key) => localStorage.setItem(key, JSON.stringify(JSON.parse(localStorage.getItem(key)), null, 2)), ROUND);
      const before = await snapshot(page); await directory(page); await page.clock.runFor(16_000);
      assert.deepEqual(await snapshot(page), before); assert.equal((await attempts(page)).length, 0);
      await listing(page); await page.clock.runFor(16_000); assert.deepEqual(await snapshot(page), before);
      Object.assign(actual, { directoryAndListUnchanged: true, recoveredAttempts: 0 });
    });

    await runCase(18, '查看上次作答略過較新的未交卷紀錄', async (context, actual) => {
      const earlier = completed(catalog, answers, { id: 'earlier', number: 1, correct: 12 });
      const page = await newPage(context); await seed(page, { [ROUND]: { version: 1, rounds: [earlier, retired, past] } });
      const before = await snapshot(page); await directory(page); const link = page.locator(`#latest-${MAIN}`);
      assert.equal(new URL(await link.getAttribute('href'), BASE).href, route(MAIN, past.id));
      await link.click(); await score(page, 38); assert.equal((await current(page)).id, past.id);
      await cleanWords(page, '上次作答檢討'); assert.deepEqual(await snapshot(page), before);
      await enter(page, MAIN, earlier.id); await score(page, 12); assert.deepEqual(await snapshot(page), before);
      Object.assign(actual, { reviewed: past.id, newestRetired: retired.id, points: [76, 24] });
    });

    await runCase(19, '目錄重新開始直接到第 1 題，連按只新增 1 筆', async (context, actual) => {
      const page = await newPage(context); await seed(page, { [ROUND]: { version: 1, rounds: [past, retired] } }); await directory(page);
      let dialogs = 0; page.on('dialog', async (dialog) => { dialogs++; await dialog.dismiss(); });
      await page.locator(`#start-${MAIN}`).evaluate((button) => { for (let index = 0; index < 3; index++) button.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
      await page.waitForURL((url) => url.searchParams.has('round')); await cards(page).waitFor();
      const data = await store(page); const next = await current(page);
      assert.equal(data.rounds.length, 3); assert.equal(next.number, 5); assert.equal(next.status, 'open'); assert.equal(next.position, 0);
      assert.ok(next.questions.every((q) => q.choice === null && !q.unsure && q.ms === 0));
      assert.equal(await page.locator('dialog[open]').count(), 0); assert.equal(dialogs, 0);
      assert.deepEqual(data.rounds.filter((q) => q.id !== next.id), [past, retired]);
      assert.match(await page.locator('#official-position').innerText(), /^第 1 題/);
      Object.assign(actual, { clicks: 3, newRecords: 1, number: next.number, dialogs });
    });

    await runCase(20, '未交卷紀錄唯讀、任意跳題、保留選擇標記與用時', async (context, actual) => {
      const page = await newPage(context); await seed(page, { [ROUND]: { version: 1, rounds: [retired] } }); const before = await snapshot(page);
      await listing(page); await page.locator('#official-round-rows a').click(); await cards(page).waitFor();
      assert.equal((await current(page)).id, retired.id); assert.equal(await page.locator('#official-retired-summary').innerText(), '未交卷・已答 3／50・不計分');
      assert.equal(await page.locator('#official-numbers button').count(), 50);
      assert.equal(await cards(page).locator('input:enabled').count(), 0);
      assert.equal(await cards(page).locator('input:checked').inputValue(), retired.questions[2].choice);
      assert.match(await page.locator('#official-numbers button').nth(2).getAttribute('aria-label'), /曾標記不確定/);
      assert.equal(await page.locator('#official-numbers button').nth(2).getAttribute('data-unsure'), 'true');
      const time = await page.locator('#official-retired-time').innerText(); assert.equal(time, '本次用時 0:23');
      for (const number of [50, 1, 37, 3]) {
        await page.locator('#official-numbers button').nth(number - 1).click();
        assert.match(await page.locator('#official-position').innerText(), new RegExp(`^第 ${number} 題`));
        await deferred(page); assert.equal(await cards(page).locator('input:enabled').count(), 0);
      }
      await cleanWords(page, '未交卷紀錄'); await page.clock.runFor(16_000);
      assert.equal(await page.locator('#official-retired-time').innerText(), time); assert.deepEqual(await snapshot(page), before);
      const other = await newPage(context); await other.goto(BASE + '/__seed'); await other.bringToFront();
      await page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new PageTransitionEvent('pagehide')); });
      assert.deepEqual(await snapshot(page), before);
      Object.assign(actual, { selectableNumbers: 50, visited: [50, 1, 37, 3], unchanged: true, elapsed: time });
    });

    await runCase(21, '0 題及全部版本失效的未交卷紀錄不出錯不寫入', async (context, actual) => {
      const empty = { ...retired, id: 'empty-retired', attemptMode: 'official-round:empty-retired:S3', number: 1, position: 0, questions: [] };
      const invalid = { ...retired, id: 'invalid-retired', attemptMode: 'official-round:invalid-retired:S3', number: 2, questions: retired.questions.map((q) => ({ ...q, rev: q.rev + 1 })) };
      const page = await newPage(context); await seed(page, { [ROUND]: { version: 1, rounds: [empty, invalid] } }); const before = await snapshot(page);
      for (const record of [empty, invalid]) {
        await page.goto(route(MAIN, record.id)); await page.locator('#official-retired:visible').waitFor();
        assert.equal(await page.locator('#official-save-error').isVisible(), false);
        assert.equal(await page.locator('#official-retired-summary').innerText(), `未交卷・已答 ${record.questions.filter((q) => q.choice).length}／${record.questions.length}・不計分`);
        if (record.questions.length) {
          assert.equal(await page.locator('.exam-unavailable:visible').innerText(), '題目已更新，無法顯示。');
          await page.locator('#official-numbers button').last().click(); assert.match(await page.locator('#official-position').innerText(), /^第 50 題/);
        } else assert.equal(await page.locator('#official-practice').isVisible(), false);
        await page.clock.runFor(16_000); await cleanWords(page, record.id); assert.deepEqual(await snapshot(page), before);
      }
      Object.assign(actual, { emptyQuestions: 0, invalidQuestions: 50, unchanged: true });
    });

    await runCase(22, '全部紀錄時間含秒、狀態結果與朗讀標籤，新的在上', async (context, actual) => {
      const tied = { ...retired, id: 'retired-tied', attemptMode: 'official-round:retired-tied:S3', number: 5 };
      const page = await newPage(context); await seed(page); await listing(page);
      assert.equal(await page.locator('#official-round-rows').innerText(), '還沒有作答紀錄。');
      await seed(page, { [ROUND]: { version: 1, rounds: [past, active, retired, tied] } }); const before = await snapshot(page); await listing(page);
      const rows = page.locator('#official-round-rows .official-round-row'); assert.equal(await rows.count(), 3);
      for (const [index, record] of [tied, retired, past].entries()) {
        const row = rows.nth(index); const time = row.locator('time');
        assert.equal(await time.getAttribute('datetime'), record.createdAt);
        assert.equal(await time.innerText(), `2026-11-12 18:00:00・同時間第 ${3 - index} 筆`);
        const status = record.status === 'submitted' ? '已交卷' : '未交卷'; const result = record.status === 'submitted' ? '76 分' : '已答 3／50';
        assert.equal(await row.locator('span').innerText(), `${status}・${result}`);
        assert.equal(await row.locator('a').innerText(), '查看 →');
        assert.equal(new URL(await row.locator('a').getAttribute('href'), BASE).href, route(MAIN, record.id));
        assert.equal(await row.locator('a').getAttribute('aria-label'), `查看 ${await time.innerText()} ${status} ${result}`);
      }
      await cleanWords(page, '全部紀錄'); assert.deepEqual(await snapshot(page), before);
      fixtures.list = { values: await snapshotValues(page), setId: MAIN };
      Object.assign(actual, { rows: 3, order: [tied.id, retired.id, past.id], includesSeconds: true, excludesOpen: true });
    });

    await runCase(23, 'v1 混合資料不轉換，續答、恢復交卷與回看皆可用', async (context, actual) => {
      const openRecord = synthetic(catalogs.get('114-2-S1'), answers, { id: 'v1-open', answered: 2, position: 1 });
      const pending = completed(catalogs.get('114-2-S3'), answers, { id: 'v1-pending', status: 'submitting', correct: 41 });
      const submitted = completed(catalogs.get('115-1-S1'), answers, { id: 'v1-submitted', correct: 32 });
      const page = await newPage(context); await seed(page, { [ROUND]: { version: 1, rounds: [openRecord, pending, submitted] } });
      const before = await snapshot(page); await directory(page); await page.clock.runFor(16_000); assert.deepEqual(await snapshot(page), before);
      await page.locator(`#action-${openRecord.setId}`).click(); await cards(page).waitFor();
      assert.equal(await cards(page).locator('input:checked').inputValue(), openRecord.questions[1].choice); await answer(page, answers, false);
      await page.goto(BASE + '/__seed'); await enter(page, pending.setId, pending.id); await score(page, 41);
      const saved = await attempts(page); assert.equal(saved.length, 50); assert.equal(new Set(saved.map((q) => q.id)).size, 50);
      assert.deepEqual(saved, pending.submission.attempts);
      await page.reload(); await score(page, 41); assert.deepEqual(await attempts(page), saved);
      await enter(page, submitted.setId, submitted.id); await score(page, 32);
      assert.deepEqual((await store(page)).rounds.find((q) => q.id === submitted.id), submitted);
      assert.equal((await store(page)).version, 1);
      Object.assign(actual, { version: 1, resumed: true, recoveredAttempts: 50, recoveredPoints: 82, reviewedPoints: 64 });
    });

    await runCase(24, '指引練習題確認後立即解析，重新整理保留與逐題開放', async (context, actual) => {
      const page = await newPage(context); await seed(page); await page.goto(BASE + '/official/guide-S3/'); await cards(page).waitFor();
      assert.equal(await page.locator('#official-numbers button').count(), 1); assert.equal(await page.locator('#official-next').isDisabled(), true);
      await cards(page).locator('input').first().check(); assert.equal(await page.locator('#official-next').isDisabled(), true);
      assert.equal(await cards(page).locator('[data-explanation]:visible').count(), 0);
      await cards(page).locator('button[type="submit"]').click(); await cards(page).locator('[data-explanation]:visible').waitFor();
      assert.equal(await page.locator('#official-next').isEnabled(), true); assert.equal(await page.locator('#official-numbers button').count(), 2);
      assert.match(await page.locator('#official-numbers button').first().getAttribute('data-status'), /correct|wrong/);
      const selected = await cards(page).locator('input:checked').inputValue(); await page.reload(); await cards(page).waitFor();
      assert.equal(await cards(page).locator('input:checked').inputValue(), selected); assert.equal(await cards(page).locator('[data-explanation]:visible').count(), 1);
      await cleanWords(page, '指引練習題'); fixtures.guide = { values: await snapshotValues(page), path: '/official/guide-S3/' };
      const guide = JSON.parse(await page.locator('#official-catalog').textContent()); const savedGuide = await attempts(page);
      const noncontiguous = [2, 4].map((index) => ({ ...savedGuide[0], id: `guide-old-${index}`, qid: guide.questions[index].id, rev: guide.questions[index].rev }));
      await seed(page, { [ATT]: { version: 1, attempts: [...savedGuide, ...noncontiguous] } });
      await page.goto(BASE + '/official/guide-S3/?position=999'); await cards(page).waitFor();
      assert.equal(new URL(page.url()).searchParams.get('position'), '2');
      assert.deepEqual(await page.locator('#official-numbers button').allTextContents(), ['1', '2', '3', '5']);
      await page.locator('#official-numbers button').last().click(); assert.equal(new URL(page.url()).searchParams.get('position'), '5');
      assert.equal(await cards(page).locator('[data-explanation]:visible').count(), 1);
      await page.reload(); await cards(page).waitFor(); assert.equal(new URL(page.url()).searchParams.get('position'), '5');
      await page.goto(BASE + '/wrong-book/'); await page.locator('main').waitFor();
      assert.match(await page.locator('body').innerText(), /不含.*紀錄清單與未交卷答案/); await cleanWords(page, '錯題本備份說明');
      Object.assign(actual, { guideImmediateExplanation: true, numberCount: 2, noncontiguousNumbers: [1, 2, 3, 5], outOfRangePosition: 2, restored: true, backupWordsChecked: true });
    });

    await runCase(25, '錯誤提示與輔助文字不含舊用語', async (context, actual) => {
      const page = await newPage(context); await seed(page, { [ROUND]: { version: 999, rounds: [] } });
      await page.goto(BASE + '/official/'); await page.locator(`#error-${MAIN}:visible`).waitFor(); await cleanWords(page, '目錄錯誤');
      await page.goto(route(MAIN)); await page.locator('#official-save-error:visible').waitFor(); await cleanWords(page, '全部紀錄錯誤');
      await seed(page, { [ROUND]: { version: 1, rounds: [past] } }); await directory(page);
      await page.evaluate((key) => {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (name, value) { if (name === key) throw new DOMException('測試容量不足', 'QuotaExceededError'); return original.call(this, name, value); };
      }, ROUND);
      await page.locator(`#start-${MAIN}`).click(); await page.locator(`#error-${MAIN}:visible`).waitFor(); await cleanWords(page, '目錄開始失敗');
      // 掃描本身也驗證正反例，避免排除教材時一併漏掉題卡內的操作提示。
      await page.evaluate(() => {
        const card = document.createElement('article'); card.id = 'scan-fixture'; card.dataset.question = '';
        card.innerHTML = '<div class="question-stem">訓練一輪</div><section data-explanation><div class="explanation-summary">本輪梯度</div><p role="status" id="scan-message">已交卷</p></section>';
        document.body.append(card);
      });
      await cleanWords(page, '教材用語排除正例');
      await page.locator('#scan-message').evaluate((element) => { element.textContent = '本輪結果'; });
      await assert.rejects(() => cleanWords(page, '結果提示反例'), /不得顯示舊文字/);
      await page.locator('#scan-message').evaluate((element) => { element.textContent = '已交卷'; element.setAttribute('aria-label', '本輪結果'); });
      await assert.rejects(() => cleanWords(page, '朗讀文字反例'), /不得顯示舊文字/);
      await page.locator('#scan-message').evaluate((element) => { element.removeAttribute('aria-label'); element.title = '本輪結果'; });
      await assert.rejects(() => cleanWords(page, '提示文字反例'), /不得顯示舊文字/);
      await page.locator('#scan-fixture').evaluate((element) => element.remove());
      Object.assign(actual, { checkedErrors: ['目錄資料損壞', '全部紀錄資料損壞', '目錄開始容量不足'], scanPositiveFixtures: 1, scanNegativeFixtures: 3 });
    });

    await runCase(26, '4 份考古題皆可交卷回看，失效題不改既有分數', async (context, actual) => {
      const page = await newPage(context); const points = {};
      for (const [index, setId] of SETS.entries()) {
        const record = synthetic(catalogs.get(setId), answers, { id: `complete-${setId}`, answered: 50 });
        await seed(page, { [ROUND]: { version: 1, rounds: [record] } }); await enter(page, setId, record.id);
        await submit(page); await score(page, 50); await cleanWords(page, `${setId} 檢討`);
        const submitted = await current(page); submitted.questions[0].rev++;
        // 失效題的 Attempt 必須與固定交卷內容一致，才是合法的舊版資料。
        submitted.submission.attempts[0].rev++;
        await seed(page, { [ROUND]: { version: 1, rounds: [submitted] } }); const before = await snapshot(page);
        await page.goto(route(setId, record.id)); await score(page, 50); assert.deepEqual(await snapshot(page), before);
        points[setId] = 100; assert.equal(index + 1, Object.keys(points).length);
      }
      Object.assign(actual, { sets: SETS.length, points, invalidQuestionScorePreserved: true });
    });

    await runCase(27, '開始作答後返回目錄顯示繼續作答，保留同一筆', async (context, actual) => {
      const events = [];
      await context.exposeBinding('recordDirectoryPageShow', (_, event) => { events.push(event); });
      const page = await newPage(context);
      await page.addInitScript(() => {
        window.addEventListener('pageshow', (event) => { void window.recordDirectoryPageShow({ persisted: event.persisted, path: location.pathname }); });
      });
      await seed(page); await directory(page);
      assert.equal(await page.locator(`#start-${MAIN}`).innerText(), '開始作答');
      await page.locator(`#start-${MAIN}`).click(); await page.waitForURL((url) => url.searchParams.has('round')); await cards(page).waitFor();
      const opened = await current(page); const eventStart = events.length;
      await page.goBack(); await page.waitForURL(BASE + '/official/'); await page.locator(`#action-${MAIN}:visible`).waitFor();
      const link = page.locator(`#action-${MAIN}`);
      assert.equal(await link.innerText(), '繼續作答 →'); assert.equal(new URL(await link.getAttribute('href'), BASE).href, route(MAIN, opened.id));
      assert.equal(await page.locator(`#start-${MAIN}`).isVisible(), false);
      const data = await store(page); assert.equal(data.rounds.length, 1); assert.equal(data.rounds[0].id, opened.id);
      await cleanWords(page, '返回目錄');
      const returnedEvents = events.slice(eventStart).filter((event) => event.path === '/official/');
      assert.ok(returnedEvents.length > 0, '返回目錄必須留下 pageshow 事件證據');
      Object.assign(actual, { records: 1, resumedId: opened.id, returnedEvents, naturalPersisted: returnedEvents.some((event) => event.persisted) });
    });

    const states = ['directory', 'answering', 'review', 'restart', 'retired', 'list', 'guide'];
    for (const state of states) for (const width of [1440, 390, 320]) for (const theme of ['light', 'dark']) {
      const context = await newContext(); const result = { state, width, theme, status: 'running' }; report.layouts.push(result);
      try {
        const fixture = fixtures[state]; assert.ok(fixture, `${state} 的流程資料必須存在`);
        const page = await newPage(context); await page.setViewportSize({ width, height: width === 1440 ? 900 : 700 }); await seed(page, fixture.values);
        if (fixture.path) { await page.goto(BASE + fixture.path); if (state === 'guide') await cards(page).waitFor(); else await page.locator(`#action-${MAIN}:visible`).waitFor(); }
        else if (fixture.id) await enter(page, fixture.setId, fixture.id); else await listing(page, fixture.setId);
        await page.evaluate((theme) => { document.documentElement.dataset.theme = theme; }, theme); await page.evaluate(() => document.fonts.ready);
        if (state === 'restart') { await page.locator('#official-restart').click(); await page.locator('#official-restart-dialog[open]').waitFor(); }
        if (state === 'review') await page.locator('#official-score').scrollIntoViewIfNeeded();
        await cleanWords(page, `${state}/${width}/${theme}`);
        await page.waitForTimeout(100);
        result.dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
        assert.ok(result.dimensions.scrollWidth <= result.dimensions.clientWidth, `${state}/${width}/${theme} 不得水平捲動：${JSON.stringify(result.dimensions)}`);
        // 完整頁面保留目錄狀態與選項；確認視窗則保留實際視窗內的遮罩位置。
        const file = resolve(output, `${state}-${width}-${theme}.png`); await page.screenshot({ path: file, fullPage: state !== 'restart' }); report.screenshots.push(file); result.status = 'passed';
      } catch (error) { result.status = 'failed'; result.failure = String(error.stack ?? error); result.screenshots = await captureFailure(context, `${state}-${width}-${theme}`); console.error(`截圖失敗：${state}/${width}/${theme}\n${result.failure}`); }
      finally { await close(context); }
    }
  } catch (error) { report.fatal = String(error.stack ?? error); console.error(report.fatal); }
  finally {
    for (const context of contexts) await context.close().catch(() => {});
    if (browser) await browser.close();
    if (server?.listening) await new Promise((done) => { server.close(done); server.closeAllConnections(); });
    report.finishedAt = new Date().toISOString();
    report.summary = { casesPassed: report.cases.filter((item) => item.status === 'passed').length, casesTotal: 27,
      layoutsPassed: report.layouts.filter((item) => item.status === 'passed').length, layoutsTotal: 42, screenshots: report.screenshots.length, browserErrors: report.errors.length };
    report.exitCode = !report.fatal && report.summary.casesPassed === 27 && report.summary.layoutsPassed === 42 && report.summary.browserErrors === 0 ? 0 : 1;
    await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
  }
  return report;
}

async function snapshotValues(page) {
  return Object.fromEntries(Object.entries(await snapshot(page)).map(([key, value]) => [key, JSON.parse(value)]));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = await runOfficialRoundSmoke();
  console.log(`通過 ${report.summary.casesPassed}／${report.summary.casesTotal}；版面通過 ${report.summary.layoutsPassed}／${report.summary.layoutsTotal}；截圖 ${report.summary.screenshots} 張`);
  console.log(`報告：${resolve(report.output, 'report.json')}`);
  process.exitCode = report.exitCode;
}
