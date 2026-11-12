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
const BASE = 'http://127.0.0.1:4362';
const NOW = '2026-11-12T10:00:00.000Z';
const SETS = ['114-2-S1', '114-2-S3', '115-1-S1', '115-1-S3'];
const MAIN = '115-1-S3';
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
  await page.locator('#official-confirm').click();
  await page.locator('#official-score:visible').waitFor();
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
  const dist = resolve(process.env.OFFICIAL_ROUND_DIST ?? 'E:/orca/workspaces/ipas-study/official-verify/demo/dist');
  const output = fileURLToPath(new URL('../../tmp/demo-shots/t1/', import.meta.url));
  const report = { dist, output, base: BASE, startedAt: new Date().toISOString(), cases: [], layouts: [], screenshots: [], errors: [], exitCode: 1 };
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
    await new Promise((done, reject) => { server.once('error', reject); server.listen(4362, '127.0.0.1', done); });
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

    await runCase(1, '開頁不寫入，開始建立第 1 輪並帶輪次網址', async (context, actual) => {
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
      const displayed = (await page.locator('#official-time').innerText()).match(/^本輪用時 (\d+):(\d{2})$/);
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

    await runCase(6, '重新考取消暫停保存，確認後清空同編號新輪且作答紀錄不變', async (context, actual) => {
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
      await page.locator('#official-restart').click(); await page.locator('#official-restart-confirm').click();
      await page.waitForURL((url) => url.searchParams.get('round') !== opened.id); await cards(page).waitFor();
      const restarted = await current(page); assert.notEqual(restarted.id, opened.id); assert.equal(restarted.number, opened.number); assert.equal(restarted.position, 0);
      assert.match(await page.locator('#official-position').innerText(), /^第 1 題/);
      assert.ok(restarted.questions.every((q) => q.choice === null && !q.unsure && q.ms === 0));
      assert.equal(await cards(page).locator('input:checked').count(), 0); assert.equal((await store(page)).rounds.length, 1);
      await page.clock.runFor(16_000); assert.equal((await store(page)).rounds.some((round) => round.id === opened.id), false);
      assert.equal((await snapshot(page))[ATT], before[ATT]);
      Object.assign(actual, { pausedMs: 16_000, pausedWrites: 0, resumedSaving: true, number: restarted.number, oldRoundAbsent: true, legacyUnchanged: old.length });
    });

    await runCase(7, '重新考寫入失敗顯示尚未重新開始且資料不變', async (context, actual) => {
      const page = await newPage(context); await seed(page); await open(page); await answer(page, answers); const before = await snapshot(page);
      await page.evaluate((key) => {
        const original = Storage.prototype.setItem; window.smokeFailedWrites = 0;
        Storage.prototype.setItem = function (name, value) {
          if (name === key) { window.smokeFailedWrites++; throw new DOMException('測試輪次寫入失敗', 'QuotaExceededError'); }
          return original.call(this, name, value);
        };
      }, ROUND);
      await page.locator('#official-restart').click(); await page.locator('#official-restart-confirm').click(); await page.locator('#official-save-error:visible').waitFor();
      assert.match(await page.locator('#official-error-message').innerText(), /尚未重新開始/);
      assert.deepEqual(await snapshot(page), before); assert.equal(await page.evaluate(() => window.smokeFailedWrites), 1);
      Object.assign(actual, { failedWrites: 1, storeUnchanged: true });
    });

    await runCase(8, '再考一次建立第 2 輪，第 1 輪分數不變並顯示繼續', async (context, actual) => {
      const page = await newPage(context); await seed(page); const first = await open(page); await fill(page, answers); await submit(page); await score(page, 50);
      const saved = JSON.stringify((await store(page)).rounds.find((round) => round.id === first.id));
      assert.equal(await page.locator('#official-review-action button').innerText(), '再考一次');
      await page.locator('#official-review-action button').click(); await page.waitForURL((url) => url.searchParams.get('round') !== first.id); await cards(page).waitFor();
      const second = await current(page); assert.equal(second.number, 2); assert.equal(second.position, 0);
      await enter(page, MAIN, first.id); await score(page, 50);
      assert.equal(JSON.stringify((await store(page)).rounds.find((round) => round.id === first.id)), saved);
      assert.equal(await page.locator('#official-review-action a').innerText(), '繼續第 2 輪 →');
      assert.equal(new URL(await page.locator('#official-review-action a').getAttribute('href'), BASE).searchParams.get('round'), second.id);
      await listing(page); assert.equal(await page.locator('#official-round-rows .official-round-row').count(), 1);
      fixtures.list = { values: await snapshotValues(page), setId: MAIN };
      Object.assign(actual, { rounds: 2, firstPoints: 100, secondNumber: 2, continueLabel: '繼續第 2 輪 →' });
    });

    await runCase(9, '快速連按開始 3 次只建立 1 輪', async (context, actual) => {
      const page = await newPage(context); await seed(page); await listing(page);
      await page.locator('#official-round-action button').evaluate((button) => { for (let index = 0; index < 3; index++) button.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
      await page.waitForURL((url) => url.searchParams.has('round')); await cards(page).waitFor();
      assert.equal((await store(page)).rounds.length, 1); assert.equal((await current(page)).number, 1);
      Object.assign(actual, { clicks: 3, rounds: 1 });
    });

    await runCase(10, '4 份考古題交錯各答 2 題，只保存各自輪次', async (context, actual) => {
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

    await runCase(11, '舊即時作答經重新考、交卷與再考後逐筆不變', async (context, actual) => {
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

    for (const state of ['answering', 'review', 'restart', 'list']) for (const width of [1440, 390, 320]) for (const theme of ['light', 'dark']) {
      const context = await newContext(); const result = { state, width, theme, status: 'running' }; report.layouts.push(result);
      try {
        const fixture = fixtures[state]; assert.ok(fixture, `${state} 的流程資料必須存在`);
        const page = await newPage(context); await page.setViewportSize({ width, height: width === 1440 ? 900 : 700 }); await seed(page, fixture.values);
        if (fixture.id) await enter(page, fixture.setId, fixture.id); else await listing(page, fixture.setId);
        await page.evaluate((theme) => { document.documentElement.dataset.theme = theme; }, theme); await page.evaluate(() => document.fonts.ready);
        if (state === 'restart') { await page.locator('#official-restart').click(); await page.locator('#official-restart-dialog[open]').waitFor(); }
        if (state === 'review') await page.locator('#official-score').scrollIntoViewIfNeeded();
        await page.waitForTimeout(100);
        result.dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
        assert.ok(result.dimensions.scrollWidth <= result.dimensions.clientWidth, `${state}/${width}/${theme} 不得水平捲動：${JSON.stringify(result.dimensions)}`);
        const file = resolve(output, `${state}-${width}-${theme}.png`); await page.screenshot({ path: file, fullPage: false }); report.screenshots.push(file); result.status = 'passed';
      } catch (error) { result.status = 'failed'; result.failure = String(error.stack ?? error); result.screenshots = await captureFailure(context, `${state}-${width}-${theme}`); console.error(`截圖失敗：${state}/${width}/${theme}\n${result.failure}`); }
      finally { await close(context); }
    }
  } catch (error) { report.fatal = String(error.stack ?? error); console.error(report.fatal); }
  finally {
    for (const context of contexts) await context.close().catch(() => {});
    if (browser) await browser.close();
    if (server?.listening) await new Promise((done) => { server.close(done); server.closeAllConnections(); });
    report.finishedAt = new Date().toISOString();
    report.summary = { casesPassed: report.cases.filter((item) => item.status === 'passed').length, casesTotal: 11,
      layoutsPassed: report.layouts.filter((item) => item.status === 'passed').length, layoutsTotal: 24, screenshots: report.screenshots.length, browserErrors: report.errors.length };
    report.exitCode = !report.fatal && report.summary.casesPassed === 11 && report.summary.layoutsPassed === 24 && report.summary.browserErrors === 0 ? 0 : 1;
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
