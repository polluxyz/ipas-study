/** 多分頁及既有練習的瀏覽器驗收；固定隔離來源，避免碰到使用者的網站與紀錄。 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';

const BASE = 'http://127.0.0.1:4335';
const BOOKLET = 'ipas-daily-draft-v2';
const DRAFT = 'ipas-daily-draft-v1';
const CACHE = 'ipas-daily-v1';
const ATTEMPTS = 'ipas-attempts-v1';
const READING = 'ipas-reading-v1';
const KEYS = [BOOKLET, DRAFT, CACHE, ATTEMPTS, READING];
const DATE = '2026-11-08';
const INSTANT = '2026-11-08T04:00:00.000Z';
const DEFAULT_DIST = 'E:/orca/workspaces/ipas-study/booklet-verify/demo/dist';
const DEFAULT_OUTPUT = fileURLToPath(new URL('../../tmp/demo-shots/booklet-i8b/', import.meta.url));
const card = (page, prefix = 'daily') => page.locator(`#${prefix}-cards [data-question]:visible`);
const raw = (page, key = BOOKLET) => page.evaluate((key) => localStorage.getItem(key), key);
const store = async (page) => JSON.parse(await raw(page));
const attempts = async (page) => JSON.parse(await raw(page, ATTEMPTS) ?? '{"attempts":[]}').attempts;
const snapshot = (page) => page.evaluate((keys) => Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)])), KEYS);
const emptyStore = () => ({ version: 2, migratedAt: null, current: { '1': null, '3': null }, booklets: [] });

async function waitFor(page, predicate, arg) {
  await page.waitForFunction(predicate, arg, { timeout: 10_000 });
}
async function daily(page, query = '') {
  await page.goto(BASE + '/daily/' + query);
  await waitFor(page, () => !document.querySelector('#daily-metrics').hidden || /損壞|未知|失敗|無法|超過/.test(document.querySelector('#daily-status').textContent));
}
async function firstBook(page, total = 50) {
  await page.locator('#daily-open-first').click();
  await page.locator('#daily-practice:visible').waitFor();
  assert.match(await page.locator('#daily-date').innerText(), /第 1 本/);
  assert.equal((await store(page)).booklets.length, 1);
  assert.equal((await store(page)).booklets[0].number, 1);
  assert.equal((await store(page)).booklets[0].questions.length, total);
}
async function choose(page, choice, prefix = 'daily') {
  await card(page, prefix).locator(`input[value="${choice}"]`).check();
}
async function answerAll(page, wrongFirst = false, from = 0) {
  for (let index = from; index < 50; index++) {
    const answer = await card(page).getAttribute('data-answer');
    await choose(page, wrongFirst && index === 0 ? answer === 'A' ? 'B' : 'A' : answer);
    if (index < 49) await page.locator('#daily-next').click();
  }
}
async function submit(page) {
  await page.locator('#daily-submit').click();
  await page.locator('#daily-dialog[open]').waitFor();
  await page.locator('#daily-confirm').click();
  await page.locator('#daily-submitted:visible').waitFor();
}
async function clear(page) {
  await page.evaluate(async () => (await import('/__test/attempts.js')).clearStudyData());
}
async function importBackup(page, backup) {
  await page.locator('#import-attempts').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await page.locator('#import-status').filter({ hasText: '匯入完成' }).waitFor();
}
async function readonly(page) {
  await page.locator('#daily-save-error:visible').waitFor();
  assert.match(await page.locator('#daily-error-message').innerText(), /唯讀.*重新載入/);
  assert.equal(await page.locator('#daily-retry:visible').count(), 0);
  assert.equal(await page.locator('#daily-reload:visible').count(), 1);
  assert.equal(await page.locator('#daily-cards input:not(:disabled)').count(), 0);
  assert.equal(await page.locator('#daily-discard').isVisible(), false);
  assert.equal(await page.locator('#daily-discard').isDisabled(), true);
}
function seedBooklet(questions, answers, submitted = false) {
  const id = 'multi-fixture-S1';
  const mode = `booklet:${id}:S1`;
  const items = questions.slice(0, 2).map((q) => ({ id: q.id, rev: q.rev, choice: submitted ? answers.get(q.id) : null, unsure: false, ms: 1000, ...(submitted ? { correct: true } : {}) }));
  const batch = submitted ? items.map((q, index) => ({ id: `fixture-attempt-${index}`, qid: q.id, rev: q.rev, choice: q.choice, correct: true, ts: INSTANT, mode, ms: q.ms })) : [];
  const booklet = { id, seq: 7, subject: 1, number: 1, createdDate: DATE, attemptMode: mode, origin: 'new', status: submitted ? 'submitted' : 'open', position: 0, assignedQids: items.map((q) => q.id), questions: items,
    ...(submitted ? { submission: { ts: INSTANT, attempts: batch, total: 2, correct: 2 } } : {}) };
  return { booklet, batch, data: { ...emptyStore(), current: { '1': submitted ? null : id, '3': null }, booklets: [booklet] } };
}

export async function runDailyBookletMultiSmoke() {
  const dist = resolve(process.env.DAILY_BOOKLET_DIST ?? DEFAULT_DIST);
  const output = resolve(process.env.DAILY_BOOKLET_OUTPUT ?? DEFAULT_OUTPUT);
  // 即使手動執行時漏設環境變數，也不可把使用者的正式建置當測試來源。
  assert.notEqual(dist.toLowerCase().replaceAll('\\', '/'), 'd:/ipas-study/demo/dist');
  await mkdir(output, { recursive: true });
  const report = { dist, output, origin: BASE, cases: [], errors: [], productIssues: [], screenshots: [], exitCode: 1 };
  const html = await readFile(resolve(dist, 'daily/index.html'), 'utf8');
  const catalog = JSON.parse(html.match(/<script[^>]*id="daily-catalog"[^>]*>([\s\S]*?)<\/script>/)[1]);
  const answerMap = new Map([...html.matchAll(/<article\b[^>]*data-qid="([^"]+)"[^>]*data-answer="([ABCD])"/g)].map((match) => [match[1], match[2]]));
  const mock = catalog.filter((q) => q.subject === 1 && q.source === 'mock' && q.review.status === 'verified').sort((a, b) => a.id.localeCompare(b.id));
  assert.ok(mock.length >= 100 && answerMap.has(mock[0].id), '建置須有足夠模擬題及答案');
  const revisions = await readFile(new URL('../src/data/revisions.json', import.meta.url), 'utf8');
  const source = (await readFile(new URL('../src/lib/attempts.ts', import.meta.url), 'utf8')).replace(/import revisionIndex from .*?;/, `const revisionIndex = ${revisions};`);
  // 儲存層與畫面共用放棄資格；測試模組也載入同一組純函式，避免複製規則。
  const testModules = new Map();
  for (const name of ['attempts', 'daily-exam', 'daily']) {
    const input = name === 'attempts' ? source : await readFile(new URL(`../src/lib/${name}.ts`, import.meta.url), 'utf8');
    const compiled = transpileModule(input, { compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2022 } }).outputText
      .replace(/from '(\.\/[^']+)'/g, "from '$1.js'");
    testModules.set(`/__test/${name}.js`, compiled);
  }
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.ico': 'image/x-icon' };
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, BASE).pathname);
      if (testModules.has(pathname)) { response.setHeader('Content-Type', 'text/javascript'); response.end(testModules.get(pathname)); return; }
      if (pathname === '/__test/blank.html') { response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><title>隔離測試</title>'); return; }
      const file = resolve(dist, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
      if (!file.startsWith(dist + sep)) { response.writeHead(403).end(); return; }
      response.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream'); response.end(await readFile(file));
    } catch { response.writeHead(404).end(); }
  });
  let browser;
  async function seed(ctx, entries) {
    const page = await ctx.newPage(); await page.goto(BASE + '/__test/blank.html');
    await page.evaluate((entries) => { for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value)); }, entries);
    return page;
  }
  async function run(id, name, execute) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Taipei', acceptDownloads: true, reducedMotion: 'reduce' });
    const result = { id, name, success: false, actual: {} };
    await ctx.route('**/*', (route) => route.request().url().startsWith(BASE + '/') ? route.continue() : route.abort());
    ctx.on('page', (page) => {
      page.setDefaultTimeout(10_000);
      page.on('pageerror', (error) => report.errors.push({ case: id, type: 'pageerror', message: String(error) }));
      page.on('console', (message) => { if (message.type() === 'error') report.errors.push({ case: id, type: 'console', message: message.text() }); });
    });
    try { await execute(ctx, result.actual); result.success = true; }
    catch (error) {
      result.failure = String(error.stack ?? error);
      for (const [index, page] of ctx.pages().entries()) {
        const path = resolve(output, `case-${String(id).padStart(2, '0')}-page-${index + 1}.png`);
        try { await page.screenshot({ path }); report.screenshots.push(path); } catch { /* 原始失敗比關頁中的截圖更重要。 */ }
      }
    } finally { await ctx.close(); report.cases.push(result); console.log(`${id}. ${name}: ${result.success ? 'PASS' : 'FAIL'} ${JSON.stringify(result.actual)}`); }
  }
  try {
    await new Promise((done, reject) => { server.once('error', reject); server.listen(4335, '127.0.0.1', done); });
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
    report.browser = browser.version();

    await run(1, '下一本使舊分頁唯讀', async (ctx, actual) => {
      const fixture = seedBooklet(mock, answerMap, true);
      const a = await seed(ctx, { [BOOKLET]: fixture.data, [ATTEMPTS]: { version: 1, attempts: fixture.batch } });
      await daily(a); const b = await ctx.newPage(); await daily(b);
      assert.equal(await b.locator('#daily-submitted:visible').count(), 1);
      await a.locator('#daily-open-next').click();
      await a.locator('#daily-practice:visible').waitFor();
      assert.match(await a.locator('#daily-date').innerText(), /第 2 本/);
      await readonly(b);
      const before = await raw(a);
      // 點擊被停用的控制項及重送事件，確認畫面沒有留下可再次寫入的路徑。
      await b.locator('#daily-open-next').evaluate((button) => { button.click(); button.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
      await b.evaluate(() => window.dispatchEvent(new Event('pagehide')));
      await readonly(b); assert.equal(await raw(a), before);
      const data = await store(a); assert.equal(data.booklets.length, 2); assert.equal(data.booklets[1].questions.length, 50);
      Object.assign(actual, { tabs: 2, booklets: 2, nextNumber: 2, nextQuestions: 50, retryButtons: 0, overwritten: 0 });
    });

    await run(2, '舊 seq 保存被拒', async (ctx, actual) => {
      const fixture = seedBooklet(mock, answerMap);
      const a = await seed(ctx, { [BOOKLET]: fixture.data }); await daily(a);
      const b = await ctx.newPage();
      // 延後通知模擬分頁尚未收到更新；保存仍必須自己檢查 seq，不能只靠 storage 事件。
      await b.addInitScript(() => window.addEventListener('storage', (event) => event.stopImmediatePropagation(), true));
      await daily(b); const stale = (await store(b)).booklets[0].seq;
      await daily(a); await choose(a, 'A');
      const before = await raw(a); const current = (await store(a)).booklets[0].seq;
      assert.ok(current > stale); await choose(b, 'B'); await readonly(b);
      assert.equal(await raw(a), before); assert.equal((await store(a)).booklets[0].questions[0].choice, 'A');
      Object.assign(actual, { tabs: 2, staleSeq: stale, currentSeq: current, savedAnswers: 1, preservedChoice: 'A', retryButtons: 0, rejectedSaves: 1 });
    });

    await run(3, '真實遷移鎖與重開冪等', async (ctx, actual) => {
      const fixture = seedBooklet(mock, answerMap);
      const draft = { id: 'legacy-draft', seq: 10, subject: 1, date: DATE, status: 'open', position: 0, questions: fixture.booklet.questions };
      const old = { [DRAFT]: JSON.stringify({ version: 1, drafts: [draft] }), [CACHE]: JSON.stringify({ version: 1, sets: [{ date: DATE, subject: 1, questions: draft.questions.map(({ id, rev }) => ({ id, rev })) }] }, null, 2), [ATTEMPTS]: '{"version":1,"attempts":[]}', [READING]: '{"version":1,"readings":[]}' };
      const a = await seed(ctx, old);
      await a.evaluate(() => { window.__held = navigator.locks.request('ipas-daily-migration', () => new Promise((done) => { window.__release = done; })); });
      await waitFor(a, () => typeof window.__release === 'function');
      const b = await ctx.newPage(); await b.goto(BASE + '/daily/');
      await waitFor(a, async () => (await navigator.locks.query()).pending.some((lock) => lock.name === 'ipas-daily-migration'));
      assert.equal(await raw(b), null); Object.assign(actual, { heldLocks: 1, queuedLocks: 1, v2WhileWaiting: 0 });
      await a.evaluate(async () => { window.__release(); await window.__held; });
      await b.locator('#daily-practice:visible').waitFor();
      const migrated = await store(b); assert.equal(migrated.booklets.length, 1); assert.equal(migrated.booklets[0].questions.length, 2);
      const changedDraft = JSON.parse(old[DRAFT]); changedDraft.drafts[0].seq = 11;
      assert.equal(await raw(b, DRAFT), JSON.stringify(changedDraft));
      for (const key of [CACHE, ATTEMPTS, READING]) assert.equal(await raw(b, key), old[key], `${key} 逐字不變`);
      assert.deepEqual(migrated.booklets[0].questions.map(({ id, rev, choice, unsure }) => ({ id, rev, choice, unsure })), draft.questions.map(({ id, rev, choice, unsure }) => ({ id, rev, choice, unsure })));
      const before = await raw(b); const c = await ctx.newPage(); await daily(c); const after = await raw(c);
      Object.assign(actual, { tabs: 3, migratedBooklets: 1, migratedQuestions: 2, oldSeqBefore: 10, oldSeqAfter: 11, seqBeforeThirdTab: migrated.booklets[0].seq, seqAfterThirdTab: (await store(c)).booklets[0].seq, unchangedOldKeys: 3 });
      if (after !== before) report.productIssues.push({ case: 3, title: '只開第 3 頁也會保存題本並增加 seq', source: 'demo/src/lib/daily-client.ts:260', relatedSource: 'demo/src/lib/question-set-client.ts:33', reproduction: ['保留 1 份 open 舊草稿並進入 /daily/ 完成遷移', '記下 ipas-daily-draft-v2 的內容及題本 seq', '同一 context 開第 3 頁 /daily/，不操作任何控制項', '題本 seq 增加，先開的作答頁收到衝突而改唯讀'], expected: '第 3 頁只載入，題本內容與 seq 不變', actual: { beforeSeq: actual.seqBeforeThirdTab, afterSeq: actual.seqAfterThirdTab } });
      assert.equal(after, before, '第 3 頁不得改題本內容或 seq');
    });

    await run(4, '清除後舊鍵不復活', async (ctx, actual) => {
      const fixture = seedBooklet(mock, answerMap);
      const a = await seed(ctx, { [BOOKLET]: fixture.data, [DRAFT]: { version: 1, drafts: [] }, [CACHE]: { version: 1, sets: [] }, [ATTEMPTS]: { version: 1, attempts: [] }, [READING]: { version: 1, readings: [] } });
      await daily(a); const stale = await ctx.newPage(); await daily(stale);
      await clear(a); assert.deepEqual(Object.values(await snapshot(a)), [null, null, null, null, null]);
      await readonly(stale);
      await stale.evaluate(() => { const input = document.querySelector('#daily-cards input'); input.dispatchEvent(new Event('change', { bubbles: true })); window.dispatchEvent(new Event('pagehide')); });
      assert.deepEqual(Object.values(await snapshot(a)), [null, null, null, null, null]);
      await daily(a); assert.equal((await store(a)).booklets.length, 0);
      for (const key of [DRAFT, CACHE, ATTEMPTS, READING]) assert.equal(await raw(a, key), null);
      await firstBook(a); assert.equal((await store(a)).booklets[0].number, 1);
      Object.assign(actual, { removedKeys: 5, revivedOldKeys: 0, bookletsAfterReload: 0, firstNumber: 1, rejectedStaleTabs: 1 });
    });

    await run(5, '備份匯出清除匯入往返', async (ctx, actual) => {
      const page = await ctx.newPage(); await daily(page); await firstBook(page); await answerAll(page); await submit(page);
      const original = await attempts(page); assert.equal(original.length, 50);
      const used = new Set(original.map((a) => a.qid));
      await page.goto(BASE + '/wrong-book/');
      const downloaded = page.waitForEvent('download'); await page.locator('#export-attempts').click(); const download = await downloaded;
      const path = resolve(output, 'roundtrip-backup.json'); await download.saveAs(path);
      const backup = JSON.parse(await readFile(path, 'utf8')); assert.deepEqual(Object.keys(backup).sort(), ['attempts', 'readings', 'version']);
      assert.equal(backup.attempts.length, 50); assert.equal(backup.version, 1);
      await clear(page); assert.deepEqual(Object.values(await snapshot(page)), [null, null, null, null, null]);
      await page.locator('#import-attempts').setInputFiles(path); await page.locator('#import-status').filter({ hasText: '新增 50 筆' }).waitFor();
      assert.deepEqual(await attempts(page), original); assert.equal(await raw(page), null);
      await daily(page); assert.equal((await store(page)).booklets.length, 0); await firstBook(page);
      assert.equal((await store(page)).booklets[0].questions.filter((q) => used.has(q.id)).length, 0);
      Object.assign(actual, { exportedAttempts: 50, restoredAttempts: 50, topLevelKeys: Object.keys(backup).sort(), restoredBooklets: 0, nextNumber: 1, repeatedQuestions: 0 });
    });

    await run(6, '匯入不改未交卷題本', async (ctx, actual) => {
      const page = await ctx.newPage();
      // 暫停應用程式計時，讓這一案只量到匯入本身，避免 15 秒自動保存碰巧改 seq。
      await page.clock.install({ time: new Date(INSTANT) }); await page.clock.pauseAt(new Date(INSTANT));
      await daily(page); await firstBook(page);
      for (let i = 0; i < 25; i++) { await choose(page, await card(page).getAttribute('data-answer')); await page.locator('#daily-next').click(); }
      assert.equal((await attempts(page)).length, 0);
      const backupPage = await ctx.newPage(); await backupPage.goto(BASE + '/wrong-book/');
      const before = await raw(page); const booklet = (await store(page)).booklets[0]; const q = booklet.questions[0]; const opposite = q.choice === 'A' ? 'B' : 'A';
      await importBackup(backupPage, { version: 1, readings: [], attempts: [{ id: 'import-same-mode', qid: q.id, rev: q.rev, choice: opposite, correct: false, ts: INSTANT, mode: booklet.attemptMode, ms: 10 }] });
      assert.equal(await raw(page), before, '匯入不更改內容或 seq');
      const afterImport = (await store(page)).booklets[0];
      await answerAll(page, false, 25); await submit(page);
      const data = await store(page); const saved = await attempts(page); const sameMode = saved.filter((a) => a.mode === booklet.attemptMode);
      assert.equal(data.booklets[0].submission.correct, 50); assert.equal(data.booklets[0].questions[0].choice, q.choice);
      assert.equal(data.booklets[0].submission.attempts.length, 50); assert.equal(sameMode.length, 51); assert.equal(new Set(sameMode.map((a) => a.id)).size, 51);
      assert.equal(sameMode.filter((a) => a.qid === q.id && a.choice === q.choice).length, 1);
      Object.assign(actual, { answeredBeforeImport: 25, importedAttempts: 1, changedBooklets: 0, seqBeforeImport: booklet.seq, seqAfterImport: afterImport.seq, submittedAttempts: 50, submittedCorrect: 50, sameModeAttempts: 51, uniqueIds: 51 });
    });

    await run(7, '損壞 JSON 與未知版本', async (ctx, actual) => {
      actual.variants = [];
      for (const value of ['{broken-json', '{"version":999,"current":{"1":null,"3":null},"booklets":[]}']) {
        const page = await seed(ctx, { [BOOKLET]: value }); await daily(page);
        assert.match(await page.locator('#daily-status').innerText(), /損壞或版本未知/);
        assert.equal(await raw(page), value); assert.equal(await page.locator('#daily-cards [data-question]').count(), 0);
        assert.equal(await page.locator('#daily-open-first:visible, #daily-open-next:visible').count(), 0);
        assert.equal((await attempts(page)).length, 0); actual.variants.push({ rawPreserved: true, drawnQuestions: 0, attempts: 0 }); await page.close();
      }
      assert.equal(actual.variants.length, 2);
    });

    await run(8, '官方題 6 份題組回歸', async (ctx, actual) => {
      const page = await ctx.newPage(); await page.goto(BASE + '/official/');
      await page.locator('#official-status').filter({ hasText: '各份題組分開計算進度' }).waitFor();
      const initial = await page.locator('[data-official-set] [id^="progress-"]').allTextContents(); assert.equal(initial.length, 6);
      for (const text of initial) assert.match(text, /^已答 0／\d+ 題・答對 0 題$/);
      await daily(page); await firstBook(page);
      const booklet = (await store(page)).booklets[0]; assert.equal(booklet.questions.length, 50);
      assert.equal(booklet.questions.filter((q) => catalog.find((item) => item.id === q.id)?.source !== 'mock').length, 0);
      await answerAll(page); await submit(page);
      await page.goto(BASE + '/official/'); await page.locator('#official-status').filter({ hasText: '各份題組分開計算進度' }).waitFor();
      assert.deepEqual(await page.locator('[data-official-set] [id^="progress-"]').allTextContents(), initial);
      await page.goto(BASE + '/official/115-1-S3/'); await page.locator('#official-progress').filter({ hasText: '已答 0／50' }).waitFor();
      const officialCard = card(page, 'official'); const qid = await officialCard.getAttribute('data-qid');
      await choose(page, await officialCard.getAttribute('data-answer'), 'official'); await officialCard.locator('button[type="submit"]').click();
      assert.equal(await page.locator('#official-progress').innerText(), '已答 1／50 題・答對 1 題・換算分數 2 分');
      await page.reload(); await page.locator('#official-progress').filter({ hasText: '已答 1／50 題・答對 1 題・換算分數 2 分' }).waitFor();
      await page.goto(BASE + '/official/115-1-S3/?position=1'); assert.equal(await card(page, 'official').getAttribute('data-qid'), qid);
      await card(page, 'official').locator('[data-explanation]:visible').waitFor();
      assert.equal((await attempts(page)).length, 51);
      Object.assign(actual, { officialSets: 6, affectedSetsByBooklet: 0, nonMockBookletQuestions: 0, officialDone: 1, officialCorrect: 1, officialScore: 2, restoredDone: 1, totalAttempts: 51, initialProgress: initial });
    });

    await run(9, '一般測驗及錯題篩選回歸', async (ctx, actual) => {
      const page = await ctx.newPage(); await page.goto(BASE + '/quiz/'); await page.locator('#quiz:visible').waitFor();
      assert.equal(await page.locator('#quiz [data-question]').count(), 10);
      const current = page.locator('#quiz [data-question]:visible'); const answer = await current.getAttribute('data-answer');
      await current.locator(`input[value="${answer === 'A' ? 'B' : 'A'}"]`).check(); await current.locator('button[type="submit"]').click();
      const saved = await attempts(page); assert.equal(saved.length, 1); assert.equal(saved[0].mode, 'quiz'); assert.equal(saved[0].mode.startsWith('booklet:'), false);
      await page.goto(BASE + '/quiz/?wrong=1'); await page.locator('#quiz:visible').waitFor();
      assert.equal(await page.locator('#quiz [data-question]').count(), 1); assert.equal(await page.locator('#filter-wrong').isChecked(), true);
      Object.assign(actual, { quizQuestions: 10, attempts: 1, mode: saved[0].mode, wrongQuestions: 1 });
    });

    await run(10, '單題作答解析及題本排除回歸', async (ctx, actual) => {
      const page = await ctx.newPage(); const qid = mock[0].id; await page.goto(BASE + `/questions/${qid}/`);
      const current = page.locator('[data-question]'); await current.locator(`input[value="${answerMap.get(qid)}"]`).check();
      await current.locator('button[type="submit"]').click(); await current.locator('[data-explanation]:visible').waitFor();
      const saved = await attempts(page); assert.equal(saved.length, 1); assert.equal(saved[0].qid, qid); assert.equal(saved[0].correct, true);
      assert.match(await current.locator('.answer-result').innerText(), new RegExp('參考答案\\s*' + answerMap.get(qid)));
      assert.ok((await current.locator('.explanation-correct').innerText()).length > 0);
      // 限定為包含這題的 50 題，才能證明排除確實生效，而非剛好隨機沒抽到。
      const candidates = mock.slice(0, 50);
      await page.route('**/daily/**', async (route) => {
        const response = await route.fetch();
        const body = (await response.text()).replace(/(<script[^>]*id="daily-catalog"[^>]*>)[\s\S]*?(<\/script>)/, (_, start, end) => start + JSON.stringify(candidates) + end);
        await route.fulfill({ response, body });
      });
      await daily(page); await firstBook(page, 49); assert.equal((await store(page)).booklets[0].questions.filter((q) => q.id === qid).length, 0);
      Object.assign(actual, { questionId: qid, candidateQuestions: 50, attempts: 1, visibleExplanations: 1, correct: 1, bookletQuestions: 49, repeatedQuestions: 0 });
    });

    await run(11, '錯題本只收已交卷答案', async (ctx, actual) => {
      const page = await ctx.newPage(); await daily(page); await firstBook(page);
      const qid = await card(page).getAttribute('data-qid'); const answer = await card(page).getAttribute('data-answer');
      await choose(page, answer === 'A' ? 'B' : 'A'); assert.equal((await attempts(page)).length, 0);
      const wrong = await ctx.newPage(); await wrong.goto(BASE + '/wrong-book/'); assert.equal(await wrong.locator('#wrong-list [data-qid]').count(), 0);
      await page.locator('#daily-next').click(); await answerAll(page, false, 1); await submit(page);
      await wrong.reload(); await wrong.locator(`#wrong-list [data-qid="${qid}"]`).waitFor();
      assert.equal(await wrong.locator('#wrong-list [data-qid]').count(), 1); assert.match(await wrong.locator('#wrong-count').innerText(), /^1\s*題$/);
      assert.equal((await attempts(page)).length, 50);
      Object.assign(actual, { unsubmittedAttempts: 0, unsubmittedWrongRows: 0, submittedAttempts: 50, submittedWrongRows: 1, submittedCorrect: 49 });
    });
    // 兩科各自恢復提交，故障題本的固定作答 ID 必須完整保留。
    const recoveryFixture = (bothSubmitting = false) => {
      const data = emptyStore();
      for (const subject of [1, 3]) {
        const id = `recovery-S${subject}`;
        const mode = `booklet:${id}:S${subject}`;
        const submitting = subject === 3 || bothSubmitting;
        const questions = catalog.filter((q) => q.subject === subject && q.source === 'mock' && q.review.status === 'verified').slice(0, 2)
          .map((q) => ({ id: q.id, rev: q.rev, choice: submitting ? answerMap.get(q.id) : null, unsure: false, ms: 1000, ...(submitting ? { correct: true } : {}) }));
        assert.equal(questions.length, 2);
        const batch = submitting ? questions.map((q, index) => ({ id: `recovery-S${subject}-${index}`, qid: q.id, rev: q.rev, choice: q.choice, correct: true, ts: INSTANT, mode, ms: q.ms })) : [];
        data.current[subject] = id;
        data.booklets.push({ id, seq: 7, subject, number: 1, createdDate: DATE, attemptMode: mode, origin: 'new', status: submitting ? 'submitting' : 'open', position: 0, assignedQids: questions.map((q) => q.id), questions,
          ...(submitting ? { submission: { ts: INSTANT, attempts: batch, total: 2, correct: 2 } } : {}) });
      }
      return data;
    };
    const recoveryShot = async (page, name) => {
      for (const width of [1440, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        const path = resolve(output, `${name}-${width}.png`);
        await page.screenshot({ path, fullPage: true }); report.screenshots.push(path);
      }
    };
    const recoveryDaily = async (page, subject) => {
      await page.goto(BASE + '/daily/?subject=' + subject);
      await waitFor(page, () => !document.querySelector('#daily-practice').hidden || !document.querySelector('#daily-save-error').hidden);
    };

    await run(12, '他科恢復失敗仍可保存本科', async (ctx, actual) => {
      const data = recoveryFixture(); const original = JSON.stringify(data); const failed = JSON.stringify(data.booklets[1]);
      const invalid = '{"version":99,"attempts":[]}';
      const page = await seed(ctx, { [BOOKLET]: original, [ATTEMPTS]: invalid });
      await recoveryDaily(page, 1);
      assert.equal(await page.locator('#daily-practice:visible').count(), 1, '科目 3 恢復失敗不可阻擋科目 1');
      assert.equal(await raw(page), original, '開頁不改失敗題本或本科');
      assert.equal(await page.locator('#daily-save-error:visible').count(), 0);
      await choose(page, 'B');
      const saved = await store(page);
      assert.equal(saved.booklets[0].questions[0].choice, 'B'); assert.ok(saved.booklets[0].seq > data.booklets[0].seq);
      assert.equal(JSON.stringify(saved.booklets[1]), failed); assert.equal(await raw(page, ATTEMPTS), invalid);
      await recoveryShot(page, 'recovery-other-subject');
      Object.assign(actual, { savedSubject: 1, savedAnswers: 1, failedSubject: 3, failedBookletUnchanged: true, attemptsRawUnchanged: true });
    });

    await run(13, '本科恢復失敗顯示錯誤與重試', async (ctx, actual) => {
      const data = recoveryFixture(); const original = JSON.stringify(data); const invalid = '{"version":99,"attempts":[]}';
      const page = await seed(ctx, { [BOOKLET]: original, [ATTEMPTS]: invalid });
      await recoveryDaily(page, 3);
      assert.equal(await page.locator('#daily-save-error:visible').count(), 1);
      assert.ok((await page.locator('#daily-error-message').innerText()).length > 0);
      assert.equal(await page.locator('#daily-status').innerText(), '交卷尚未完成，請重試。');
      assert.equal(await page.locator('#daily-retry:visible').count(), 1);
      assert.equal(await raw(page), original); assert.equal(await raw(page, ATTEMPTS), invalid);
      await page.locator('#daily-retry').click();
      await page.locator('#daily-save-error:visible').waitFor();
      assert.equal(await raw(page), original); assert.equal(await raw(page, ATTEMPTS), invalid);
      await recoveryShot(page, 'recovery-current-subject');
      Object.assign(actual, { failedSubject: 3, retryButtons: 1, retryPreservedBooklet: true, attemptsRawUnchanged: true });
    });

    await run(14, '他科恢復寫入失敗後重開去重', async (ctx, actual) => {
      const data = recoveryFixture(); const original = JSON.stringify(data); const failed = JSON.stringify(data.booklets[1]);
      const initialAttempts = '{"version":1,"attempts":[]}';
      const page = await seed(ctx, { [BOOKLET]: original, [ATTEMPTS]: initialAttempts });
      await page.addInitScript(({ key, flag }) => {
        const originalSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function (name, value) {
          if (this === localStorage && name === key && localStorage.getItem(flag) !== 'disabled') throw new DOMException('科目 3 恢復寫入容量不足', 'QuotaExceededError');
          return originalSetItem.call(this, name, value);
        };
      }, { key: ATTEMPTS, flag: 'test-recovery-quota' });
      await recoveryDaily(page, 1);
      assert.equal(await page.locator('#daily-practice:visible').count(), 1);
      assert.equal(await page.locator('#daily-save-error:visible').count(), 0);
      assert.equal(await raw(page), original);
      await choose(page, 'C');
      assert.equal((await store(page)).booklets[0].questions[0].choice, 'C');
      assert.equal(JSON.stringify((await store(page)).booklets[1]), failed);
      assert.equal(await raw(page, ATTEMPTS), initialAttempts);
      await page.evaluate(() => localStorage.setItem('test-recovery-quota', 'disabled'));
      await page.reload(); await page.locator('#daily-practice:visible').waitFor();
      assert.equal((await store(page)).booklets[1].status, 'submitted');
      await daily(page, '?subject=3');
      await page.locator('#daily-submitted:visible').waitFor();
      const restored = await store(page); const saved = await attempts(page);
      assert.equal(restored.booklets[0].questions[0].choice, 'C'); assert.equal(restored.booklets[1].status, 'submitted'); assert.equal(restored.current[3], null);
      assert.deepEqual(restored.booklets[1].submission, data.booklets[1].submission);
      assert.deepEqual(saved, data.booklets[1].submission.attempts); assert.equal(new Set(saved.map((a) => a.id)).size, 2);
      const completed = await raw(page); const savedRaw = await raw(page, ATTEMPTS);
      await page.reload(); await page.locator('#daily-submitted:visible').waitFor();
      assert.equal(await raw(page), completed); assert.equal(await raw(page, ATTEMPTS), savedRaw);
      Object.assign(actual, { failedSubject: 3, savedSubject: 1, failedBookletUnchanged: true, attemptsBeforeRetry: 0, attemptsAfterRetry: 2, uniqueAttemptIds: 2, duplicateAttempts: 0 });
    });

    await run(15, '兩科提交中皆恢復且不重複作答', async (ctx, actual) => {
      const data = recoveryFixture(true);
      const page = await seed(ctx, { [BOOKLET]: data, [ATTEMPTS]: { version: 1, attempts: [] } });
      await daily(page, '?subject=1');
      await page.locator('#daily-submitted:visible').waitFor();
      const restored = await store(page); const saved = await attempts(page);
      assert.deepEqual(restored.booklets.map((b) => b.status), ['submitted', 'submitted']);
      assert.deepEqual(restored.current, { '1': null, '3': null });
      for (const [index, b] of restored.booklets.entries()) assert.deepEqual(b.submission, data.booklets[index].submission);
      assert.deepEqual(saved, data.booklets.flatMap((b) => b.submission.attempts)); assert.equal(new Set(saved.map((a) => a.id)).size, 4);
      const completed = await raw(page); const savedRaw = await raw(page, ATTEMPTS);
      await daily(page, '?subject=3'); await page.locator('#daily-submitted:visible').waitFor();
      assert.equal(await raw(page), completed); assert.equal(await raw(page, ATTEMPTS), savedRaw);
      Object.assign(actual, { submittedSubjects: [1, 3], attempts: 4, uniqueAttemptIds: 4, duplicateAttempts: 0 });
    });
    await run(16, '先恢復本科失敗仍完成他科', async (ctx, actual) => {
      const data = recoveryFixture(true); const failed = JSON.stringify(data.booklets[0]);
      const page = await seed(ctx, { [BOOKLET]: data, [ATTEMPTS]: { version: 1, attempts: [] } });
      await page.addInitScript((key) => {
        const originalSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function (name, value) {
          if (this === localStorage && name === key && JSON.parse(value).attempts.some((a) => a.mode === 'booklet:recovery-S1:S1')) throw new DOMException('科目 1 恢復寫入容量不足', 'QuotaExceededError');
          return originalSetItem.call(this, name, value);
        };
      }, ATTEMPTS);
      await recoveryDaily(page, 1);
      assert.equal(await page.locator('#daily-save-error:visible').count(), 1);
      assert.equal(await page.locator('#daily-retry:visible').count(), 1);
      assert.equal(await page.locator('#daily-discard').isVisible(), false, '提交中恢復失敗不能放棄');
      const restored = await store(page);
      assert.equal(JSON.stringify(restored.booklets[0]), failed);
      assert.equal(restored.booklets[1].status, 'submitted'); assert.equal(restored.current[3], null);
      assert.deepEqual(restored.booklets[1].submission, data.booklets[1].submission);
      assert.deepEqual(await attempts(page), data.booklets[1].submission.attempts);
      Object.assign(actual, { failedSubject: 1, submittedSubject: 3, failedBookletUnchanged: true, attempts: 2, duplicateAttempts: 0 });
    });
    await run(17, 'B 先保存用時或答案，A 確認放棄時改唯讀', async (ctx, actual) => {
      actual.scenarios = [];
      for (const change of ['time', 'answer']) {
        const fixture = seedBooklet(mock, answerMap);
        // 每種變更各用 2 個新頁；延後通知以測到確認當下的儲存層檢查。
        const a = await seed(ctx, { [BOOKLET]: fixture.data });
        await a.addInitScript(() => window.addEventListener('storage', (event) => event.stopImmediatePropagation(), true));
        await daily(a);
        const b = await ctx.newPage(); await b.clock.install(); await daily(b);
        await a.locator('#daily-discard').click();
        if (change === 'answer') await choose(b, 'A');
        else {
          await b.clock.runFor(16_000);
        }
        const before = await raw(b);
        const updated = (await store(b)).booklets[0];
        assert.ok(updated.seq > fixture.booklet.seq, 'B 必須真的保存');
        if (change === 'time') assert.ok(updated.questions[0].ms > fixture.booklet.questions[0].ms);
        await a.locator('#daily-discard-confirm').click(); await readonly(a);
        assert.equal(await a.locator('#daily-discard-dialog').evaluate((dialog) => dialog.open), false);
        assert.equal(await raw(a), before); assert.equal((await store(a)).booklets.length, 1);
        actual.scenarios.push({ change, savedSeq: updated.seq, deleted: 0, readonly: true });
        // 先關閉已唯讀的 A，再讓 B 正常離頁，避免下一輪造資料被舊生命週期改寫。
        await a.close(); await b.close();
      }
    });

    await run(18, 'A 放棄後，B 保存被拒且不復活題本', async (ctx, actual) => {
      const fixture = seedBooklet(mock, answerMap);
      const a = await seed(ctx, { [BOOKLET]: fixture.data }); await daily(a);
      const b = await ctx.newPage();
      await b.addInitScript(() => window.addEventListener('storage', (event) => event.stopImmediatePropagation(), true));
      await daily(b);
      await a.locator('#daily-discard').click(); await a.locator('#daily-discard-confirm').click();
      await a.locator('#daily-empty:visible').waitFor();
      const before = await raw(a);
      await choose(b, 'B'); await readonly(b);
      await b.evaluate(() => window.dispatchEvent(new Event('pagehide')));
      assert.equal(await raw(a), before); assert.equal((await store(a)).booklets.length, 0);
      assert.notEqual(before, null);
      Object.assign(actual, { tabs: 2, deleted: 1, staleSaveRejected: true, resurrected: 0, newKeyRetained: true });
    });

    report.passed = report.cases.filter((item) => item.success).length;
    report.failed = report.cases.filter((item) => !item.success).length;
    report.exitCode = report.passed === 18 && report.errors.length === 0 ? 0 : 1;
  } catch (error) { report.fatal = String(error.stack ?? error); }
  finally {
    if (browser) await browser.close();
    if (server.listening) await new Promise((done, reject) => server.close((error) => error ? reject(error) : done()));
    report.browserErrors = report.errors.length;
    await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  }
  return report;
}

// 匯入只取得函式，讓協調者能組合其他驗收而不意外啟動服務或瀏覽器。
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runDailyBookletMultiSmoke().then((report) => { console.log(`report: ${resolve(report.output, 'report.json')}; passed=${report.passed ?? 0}/18; browserErrors=${report.browserErrors}; exitCode=${report.exitCode}`); process.exitCode = report.exitCode; })
    .catch((error) => { console.error(error); process.exitCode = 1; });
}
