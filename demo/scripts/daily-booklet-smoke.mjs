/** 題本驗收只讀指定建置，使用隔離瀏覽器與暫時服務，保留失敗及目前視窗的版面證據。 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { parse } from 'yaml';
import { waitCatalog, waitBooklet, openCatalog, gotoBooklet, enterBooklet, openNewBooklet, backToCatalog } from './daily-nav.mjs';

const BOOK = 'ipas-daily-draft-v2';
const ATT = 'ipas-attempts-v1';
const CACHE = 'ipas-daily-v1';
const DRAFT = 'ipas-daily-draft-v1';
const BASE = 'http://127.0.0.1:4334';
const TODAY = '2026-11-08';
const YESTERDAY = '2026-11-07';
const NOW = '2026-11-08T04:00:00.000Z';
const TOMORROW = '2026-11-09T04:00:00.000Z';
const emptyStore = () => ({ version: 2, migratedAt: null, current: { '1': null, '3': null }, booklets: [] });
const card = (page) => page.locator('#daily-cards [data-question]:visible');
const readStore = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), BOOK);
const readAttempts = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{"attempts":[]}').attempts, ATT);
const currentBook = async (page, subject = 1) => { const store = await readStore(page); return store.booklets.find((b) => b.id === store.current[subject]); };
const snapshot = (page) => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map((key) => [key, localStorage.getItem(key)])));
const ready = (page) => new URL(page.url()).searchParams.has('book') ? waitBooklet(page) : waitCatalog(page);
const reload = async (page) => { await page.reload(); await ready(page); };
const section = (page, subject = 1) => page.locator('#daily-directory-' + subject);
const rows = (page, subject = 1) => section(page, subject).locator('.booklet-row:not(.booklet-table-head)');
const rowCells = (page, subject = 1) => rows(page, subject).evaluateAll((elements) => elements.map((row) => [...row.children].map((cell) => cell.innerText.trim().replace(/\s+/g, ' '))));
const eligible = (catalog, subject) => catalog.filter((q) => q.subject === subject && q.source === 'mock' && q.review.status === 'verified' && q.codes.length > 0).sort((a, b) => a.id.localeCompare(b.id));
const wrongChoice = (answer) => answer === 'A' ? 'B' : 'A';

async function seed(page, values) {
  // 在沒有產品生命週期的空白頁造資料，避免舊頁離開時保存並覆蓋測試前置資料。
  await page.goto(BASE + '/__seed');
  await page.evaluate((values) => {
    localStorage.clear();
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, JSON.stringify(value));
  }, values);
}

async function changeCatalog(page, transform) {
  await page.route('**/daily/**', async (route) => {
    const response = await route.fetch();
    let replaced = false;
    const body = (await response.text()).replace(/(<script[^>]*id="daily-catalog"[^>]*>)([\s\S]*?)(<\/script>)/, (_, start, json, end) => {
      replaced = true;
      return start + JSON.stringify(transform(JSON.parse(json))).replace(/</g, '\\u003c') + end;
    });
    assert.equal(replaced, true, '必須確實替換建置頁面的題庫');
    await route.fulfill({ response, body });
  });
}

async function answer(page, correct = true) {
  // 操作真正的選項事件；答案只供選擇輸入，預期成績由案例明寫。
  const choice = await card(page).getAttribute('data-answer');
  await card(page).locator(`input[value="${correct ? choice : wrongChoice(choice)}"]`).evaluate((input) => input.click());
}

async function answerThrough(page, count) {
  for (let index = 0; index < count; index++) {
    await answer(page);
    if (index < count - 1) await page.locator('#daily-next').click();
  }
}

async function submit(page) {
  await page.locator('#daily-submit').click();
  await page.locator('#daily-dialog[open]').waitFor();
  await page.locator('#daily-confirm').click();
}

async function expectScore(page, correct, total) {
  await page.locator('#daily-readonly:not([hidden])').waitFor();
  await page.locator('#daily-score:not([hidden])').waitFor();
  assert.equal(await page.locator('#daily-score-heading').innerText(), `答對 ${correct}／${total} 題`);
  assert.match(await page.locator('#daily-score-points').innerText(), new RegExp(`^${correct * 2} 分／${total * 2} 分`));
  assert.equal(await page.locator('#daily-discard').isVisible(), false);
}

async function expectDeferred(page) {
  assert.equal(await page.locator('[data-explanation]:visible, .option-status:not(:empty):visible, #daily-score:visible, .is-correct:visible, .is-wrong:visible').count(), 0, '交卷前不顯示結果');
  assert.doesNotMatch(await page.locator('.daily-toolbar').innerText(), /答對|答錯|分數|答案|解析/);
  assert.doesNotMatch(await page.locator('.daily-exam').ariaSnapshot(), /參考答案|官方答案|為什麼 [ABCD] 正確|答對了|你的答案|其他選項的問題/);
}

async function expectAnswerFocus(page) {
  assert.equal(await page.locator('#daily-directory').isVisible(), false, '作答只顯示這本');
  assert.equal(await page.locator('#daily-legacy-records').isVisible(), false, '作答中隱藏舊紀錄');
  for (const selector of ['#daily-date', '#daily-back', '#daily-practice']) {
    assert.equal(await page.locator(selector).isVisible(), true, `作答中保留 ${selector}`);
  }
  assert.equal(await page.locator('[data-open-subject]').count(), 0);
}

function booklet(questions, answers, { id, number, subject = 1, status = 'open', answered = 0, correct = answered, createdDate = TODAY, submittedAt = NOW }) {
  const attemptMode = `booklet:${id}:S${subject}`;
  const submitted = status === 'submitted' || status === 'submitting';
  const items = questions.map((q, index) => ({
    id: q.id, rev: q.rev, choice: index < answered ? index < correct ? answers.get(q.id) : wrongChoice(answers.get(q.id)) : null,
    unsure: index < answered && index % 7 === 0, ms: 1000,
    ...(submitted ? { correct: index < correct } : {}),
  }));
  const attempts = items.filter((q) => q.choice).map((q, index) => ({ id: `${id}-attempt-${index}`, qid: q.id, rev: q.rev, choice: q.choice, correct: Boolean(q.correct), ts: submittedAt, mode: attemptMode, ms: q.ms }));
  return {
    id, seq: 1, subject, number, createdDate, attemptMode, origin: 'new', status, position: Math.min(answered, Math.max(0, items.length - 1)),
    assignedQids: items.map((q) => q.id), questions: items,
    ...(submitted ? { submission: { ts: submittedAt, attempts, total: items.length, correct } } : {}),
  };
}

async function armWriteFailure(page, stage) {
  await page.evaluate(({ stage, BOOK, ATT }) => {
    const original = Storage.prototype.setItem;
    window.bookletFault = { armed: true, throws: 0, attemptIds: [] };
    Storage.prototype.setItem = function (key, raw) {
      if (this === localStorage && window.bookletFault.armed) {
        const value = key === BOOK ? JSON.parse(raw) : null;
        const b = value?.booklets.find((item) => item.subject === 1);
        if (b?.submission) window.bookletFault.attemptIds = b.submission.attempts.map((a) => a.id);
        if ((stage === 'prepare' && b?.status === 'submitting') || (stage === 'attempts' && key === ATT) || (stage === 'finalize' && b?.status === 'submitted')) {
          window.bookletFault.throws++;
          throw new DOMException(`injected-${stage}`, 'QuotaExceededError');
        }
      }
      return original.call(this, key, raw);
    };
  }, { stage, BOOK, ATT });
}

async function measureActions(page) {
  return page.evaluate(() => {
    const box = (selector) => {
      const element = document.querySelector(selector); const r = element.getBoundingClientRect();
      const points = [[r.left + 3, r.top + 3], [r.right - 3, r.bottom - 3], [r.left + r.width / 2, r.top + r.height / 2]];
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height,
        scrollWidth: element.scrollWidth, clientWidth: element.clientWidth,
        unobscured: points.every(([x, y]) => { const hit = document.elementFromPoint(x, y); return hit === element || element.contains(hit); }) };
    };
    const toolbar = box('.daily-toolbar'); const actions = box('.daily-actions');
    return { viewport: { width: innerWidth, height: innerHeight }, scrollY, toolbar, actions,
      submit: box('#daily-submit'), previous: box('#daily-previous'), unsure: box('#daily-unsure'), next: box('#daily-next'),
      readingSpace: actions.top - toolbar.bottom, overflow: document.documentElement.scrollWidth - innerWidth };
  });
}

function assertActions(measurement) {
  const { viewport, toolbar, actions, submit: send, previous, unsure, next } = measurement;
  for (const [name, bounds] of Object.entries({ submit: send, previous, unsure, next })) {
    assert.ok(bounds.left >= 0 && bounds.top >= 0 && bounds.right <= viewport.width && bounds.bottom <= viewport.height,
      `${name} 在目前視窗內：${JSON.stringify(bounds)}`);
    assert.equal(bounds.unobscured, true, `${name} 沒有被其他元素遮住`);
    assert.ok(bounds.scrollWidth <= bounds.clientWidth, `${name} 文字不截斷`);
  }
  for (const bounds of [previous, unsure, next]) assert.ok(bounds.top >= toolbar.bottom, '底部操作列與上方工具列不重疊');
  assert.ok(send.top >= toolbar.top && send.bottom <= toolbar.bottom, '交卷位於工具列內');
  assert.ok(actions.top >= toolbar.bottom, '2 條操作列不重疊');
  assert.ok(Math.max(previous.top, unsure.top, next.top) - Math.min(previous.top, unsure.top, next.top) <= 1, '底部按鈕上緣差不超過 1px');
  assert.ok(next.left - unsure.right >= 0 && next.left - unsure.right <= 16, '不確定與下一題間距為 0–16px');
  assert.ok(measurement.overflow <= 0, '作答畫面不可水平溢出');
}

export async function runDailyBookletSmoke() {
  const dist = resolve(process.env.DAILY_BOOKLET_DIST ?? 'E:/orca/workspaces/ipas-study/booklet-verify/demo/dist');
  const output = resolve(process.env.DAILY_BOOKLET_OUTPUT ?? fileURLToPath(new URL('../../tmp/demo-shots/booklet-i8a/', import.meta.url)));
  const report = { dist, output, base: BASE, startedAt: new Date().toISOString(), cases: [], screenshots: [], measurements: [], actionMeasurements: [], errors: [], requestFailures: [], productIssues: [], specGaps: [], exitCode: 1 };
  await mkdir(output, { recursive: true });
  let browser; let server;
  const contexts = new Set();
  const fixtures = {};
  try {
    // 從被測建置讀題庫，避免工作樹與建置版本不同而產生錯誤證據。
    const html = await readFile(resolve(dist, 'daily/index.html'), 'utf8');
    const catalog = JSON.parse(html.match(/<script[^>]*id="daily-catalog"[^>]*>([\s\S]*?)<\/script>/)[1]);
    const answers = new Map([...html.matchAll(/<article[^>]*data-question[^>]*data-qid="([^"]+)"[^>]*data-rev="[^"]+"[^>]*data-answer="([^"]+)"/g)].map((m) => [m[1], m[2]]));
    const duplicateSource = parse(await readFile(new URL('../../content/question-duplicates.yaml', import.meta.url), 'utf8'));
    const [duplicate1, duplicate3] = duplicateSource.groups[0].ids;
    const grouped = new Set(duplicateSource.groups.flatMap((g) => g.ids));
    const pool = (subject) => eligible(catalog, subject).filter((q) => !grouped.has(q.id));
    assert.ok(pool(1).length >= 180 && pool(3).length >= 50, '測試需足夠的非同題群組題');
    assert.equal(answers.size >= 1000, true, '建置必須含真實題卡答案');
    report.catalog = { subject1: eligible(catalog, 1).length, subject3: eligible(catalog, 3).length, duplicatePair: [duplicate1, duplicate3] };
    const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.ico': 'image/x-icon' };
    server = createServer(async (request, response) => {
      try {
        const pathname = decodeURIComponent(new URL(request.url, BASE).pathname);
        if (pathname === '/__seed') { response.setHeader('content-type', 'text/html'); response.end('<!doctype html><title>isolated fixture</title>'); return; }
        if (pathname === '/favicon.ico') { response.writeHead(204).end(); return; }
        const file = resolve(dist, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
        const child = relative(dist, file);
        if (child.startsWith('..' + sep) || child === '..' || resolve(dist, child) !== file) { response.writeHead(403).end(); return; }
        const data = await readFile(file);
        response.setHeader('content-type', mime[extname(file)] ?? 'application/octet-stream'); response.end(data);
      } catch { response.writeHead(404).end(); }
    });
    await new Promise((done, reject) => { server.once('error', reject); server.listen(4334, '127.0.0.1', done); });
    browser = await chromium.launch({ headless: true, channel: 'chrome' }); report.browser = browser.version();
    const newContext = async () => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Asia/Taipei' });
      contexts.add(context);
      await context.route('**/*', (route) => route.request().url().startsWith(BASE + '/') ? route.continue() : route.abort());
      context.on('page', (page) => {
        page.setDefaultTimeout(10_000);
        page.on('pageerror', (error) => report.errors.push({ type: 'pageerror', message: error.message, url: page.url() }));
        page.on('console', (message) => { if (message.type() === 'error') report.errors.push({ type: 'console', message: message.text(), url: page.url() }); });
        page.on('requestfailed', (request) => {
          const message = request.failure()?.errorText;
          if (request.url().startsWith(BASE) && message !== 'net::ERR_ABORTED') report.requestFailures.push({ url: request.url(), message });
        });
      });
      return context;
    };
    const closeContext = async (context) => { await context.close(); contexts.delete(context); };
    const newPage = async (context) => { const page = await context.newPage(); await page.clock.install({ time: new Date(NOW) }); return page; };
    const runCase = async (id, name, run) => {
      const context = await newContext(); const result = { id, name, status: 'running', actual: {} }; report.cases.push(result);
      try { await run(context, result.actual); result.status = 'passed'; }
      catch (error) {
        result.status = 'failed'; result.failure = String(error.stack ?? error);
        report.productIssues.push({ caseId: id, name, failure: result.failure });
      }
      finally { await closeContext(context); }
      await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
      console.log(`${id}: ${result.status} ${name}`);
    };

    await runCase(1, '全新目錄兩科只有開第 1 本且沒有題本列', async (context, actual) => {
      const page = await newPage(context); await openCatalog(page, BASE);
      const counts = [];
      for (const subject of [undefined, 3, 1]) {
        if (subject) await openCatalog(page, BASE, subject);
        for (const target of [1, 3]) {
          assert.equal(await section(page, target).isVisible(), true);
          assert.equal(await rows(page, target).count(), 0);
          assert.deepEqual(await section(page, target).locator('button').allTextContents(), ['開第 1 本']);
        }
        assert.equal(await page.locator('#daily-practice').isVisible(), false);
        assert.equal(new URL(page.url()).searchParams.has('book'), false);
        counts.push((await readStore(page)).booklets.length);
      }
      await reload(page); counts.push((await readStore(page)).booklets.length);
      assert.deepEqual(counts, [0, 0, 0, 0]);
      fixtures.first = { values: { [BOOK]: await readStore(page) }, target: '#daily-directory' };
      await openNewBooklet(page, BASE, 1);
      const opened = await currentBook(page);
      assert.equal((await readStore(page)).booklets.length, 1); assert.equal(opened.number, 1); assert.equal(opened.questions.length, 50); assert.equal(opened.position, 0);
      assert.equal(await page.locator('#daily-position').innerText(), '第 1／50 題');
      assert.equal(await page.locator('#daily-numbers button').count(), 1); await expectDeferred(page);
      assert.equal((await readAttempts(page)).length, 0);
      Object.assign(actual, { bookletsBeforeClick: counts, subjectButtons: [1, 3], rowsBeforeClick: [0, 0], bookletsAfterClick: 1, number: 1, questions: 50, position: 1, attempts: 0 });
    });

    await runCase(2, '跨日保留題目順序答案標記與位置', async (context, actual) => {
      const page = await newPage(context); await openNewBooklet(page, BASE, 1);
      for (let index = 0; index < 20; index++) { await answer(page); if ([0, 7, 19].includes(index)) await page.locator('#daily-unsure').click(); await page.locator('#daily-next').click(); }
      const before = await currentBook(page);
      await page.clock.setFixedTime(new Date(TOMORROW)); await reload(page);
      const after = await currentBook(page);
      assert.equal(after.id, before.id); assert.equal(after.questions.length, 50); assert.equal(after.position, 20);
      assert.deepEqual(after.questions.map(({ id, rev, choice, unsure }) => ({ id, rev, choice, unsure })), before.questions.map(({ id, rev, choice, unsure }) => ({ id, rev, choice, unsure })));
      assert.equal(after.questions.filter((q) => q.choice).length, 20); assert.equal(after.questions.filter((q) => q.unsure).length, 3);
      assert.equal((await readStore(page)).booklets.length, 1); assert.equal((await readAttempts(page)).length, 0);
      assert.equal(await page.locator('#daily-numbers button').count(), 21);
      assert.equal(await page.locator('#daily-numbers [data-status="answered"]').count(), 17);
      assert.equal(await page.locator('#daily-numbers [data-status="unsure"]').count(), 3);
      assert.equal(await page.locator('#daily-numbers [data-status="unanswered"]').count(), 1); await expectDeferred(page);
      assert.deepEqual(await page.locator('#daily-numbers button').allTextContents(), Array.from({ length: 21 }, (_, index) => String(index + 1)));
      Object.assign(actual, { questions: 50, answered: 20, unsure: 3, position: 21, booklets: 1, attempts: 0, visibleNumbers: 21, green: 17, orange: 3, gray: 1, orderAndAnswersUnchanged: true, dateBefore: TODAY, dateAfter: '2026-11-09' });
      // 截圖沿用真實開本及作答產生的資料，並把固定時間切回建立日。
      fixtures.answering = { values: { [BOOK]: await readStore(page) }, subject: 1, bookId: after.id, target: '#daily-question-heading' };
    });

    await runCase(3, '昨天的舊清單與20筆作答原樣遷移', async (context, actual) => {
      const page = await newPage(context); const questions = pool(1).slice(0, 50);
      const set = { date: YESTERDAY, subject: 1, questions: questions.map(({ id, rev }) => ({ id, rev })) };
      const attempts = questions.slice(0, 20).map((q, index) => ({ id: `legacy-${index}`, qid: q.id, rev: q.rev, choice: answers.get(q.id), correct: true, ts: '2026-11-07T04:00:00.000Z', mode: `daily:${YESTERDAY}:S1`, ms: 1234 + index }));
      await seed(page, { [CACHE]: { version: 1, sets: [set] }, [ATT]: { version: 1, attempts } });
      const rawBefore = await page.evaluate((key) => localStorage.getItem(key), ATT); await openCatalog(page, BASE);
      const migrated = await currentBook(page); await enterBooklet(page, BASE, 1, migrated.id);
      assert.equal(migrated.id, 'v1-S1-2026-11-07-set'); assert.equal(migrated.origin, 'v1-set');
      assert.deepEqual(migrated.questions.map(({ id, rev }) => ({ id, rev })), set.questions);
      assert.equal(migrated.questions.filter((q) => q.legacyAttemptId).length, 20);
      for (let index = 0; index < 20; index++) assert.equal(migrated.questions[index].legacyAttemptId, `legacy-${index}`);
      assert.deepEqual(await readAttempts(page), attempts); assert.equal(await page.evaluate((key) => localStorage.getItem(key), ATT), rawBefore);
      // 遷移先接續第 21 題；逐一回看前 20 題，才是在驗證舊作答的鎖定。
      for (let index = 0; index < 20; index++) {
        await page.locator('#daily-numbers button').nth(index).click();
        assert.equal(await card(page).locator('input:disabled').count(), 4);
        await card(page).locator('input').first().evaluate((input) => input.click());
      }
      assert.equal((await currentBook(page)).questions[0].choice, attempts[0].choice);
      assert.equal(await page.evaluate((key) => localStorage.getItem(key), ATT), rawBefore);
      assert.equal((await readStore(page)).booklets.length, 1); assert.equal(await page.locator('[data-open-subject]').isVisible(), false);
      Object.assign(actual, { questions: 50, assigned: migrated.assignedQids.length, locked: 20, attempts: 20, oldAttemptBytesUnchanged: true, booklets: 1, drawn: 0 });
    });

    await runCase(4, '開科目1不影響科目3遷移', async (context, actual) => {
      const pair1 = catalog.find((q) => q.id === duplicate1); const pair3 = catalog.find((q) => q.id === duplicate3);
      const sets = [[pair1, ...pool(1).slice(0, 49)], [pair3, ...pool(3).slice(0, 49)]].map((questions, index) => ({ date: YESTERDAY, subject: index === 0 ? 1 : 3, questions: questions.map(({ id, rev }) => ({ id, rev })) }));
      const values = { [CACHE]: { version: 1, sets } };
      const page = await newPage(context); await seed(page, values); await openCatalog(page, BASE);
      assert.equal((await readStore(page)).booklets.length, 2);
      await openCatalog(page, BASE, 3);
      const afterSubject1 = await currentBook(page, 3);
      const control = await newContext();
      try {
        const other = await newPage(control); await seed(other, values); await openCatalog(other, BASE, 3);
        const directSubject3 = await currentBook(other, 3);
        // 兩種入口比較相同的遷移內容；保存次序與計時另由續答案例驗證。
        const content = (b) => ({ id: b.id, number: b.number, createdDate: b.createdDate, attemptMode: b.attemptMode, origin: b.origin, status: b.status, position: b.position, assignedQids: b.assignedQids, questions: b.questions.map(({ ms, ...q }) => q) });
        assert.deepEqual(content(afterSubject1), content(directSubject3)); assert.equal(afterSubject1.questions.length, 49);
        assert.equal(afterSubject1.assignedQids.length, 50); assert.equal(afterSubject1.questions.some((q) => q.id === duplicate3), false);
        assert.equal((await readAttempts(page)).length, 0); assert.equal((await readAttempts(other)).length, 0);
        Object.assign(actual, { oldLists: [50, 50], migratedBooklets: 2, subject3QuestionsBothPaths: [49, 49], subject3Assigned: 50, omittedDuplicate: duplicate3, contentEqual: true, attempts: 0 });
      } finally { await closeContext(control); }
    });

    await runCase(5, '連開3本不重複且歷史回看唯讀', async (context, actual) => {
      const page = await newPage(context); await openCatalog(page, BASE); const books = [];
      for (let number = 1; number <= 3; number++) {
        await openNewBooklet(page, BASE, 1);
        const opened = await currentBook(page); assert.equal(opened.number, number); assert.equal(opened.questions.length, 50);
        const priorAttempts = await readAttempts(page);
        assert.equal(opened.questions.filter((q) => priorAttempts.some((a) => a.qid === q.id)).length, 0);
        await answerThrough(page, 50); await submit(page); await expectScore(page, 50, 50);
        assert.equal(await page.locator('#daily-numbers [data-status="correct"]').count(), 50);
        assert.deepEqual(await page.locator('#daily-numbers button').allTextContents(), Array.from({ length: 50 }, (_, index) => String(index + 1)));
        const finished = (await readStore(page)).booklets.find((b) => b.id === opened.id); books.push(finished);
        assert.equal((await readAttempts(page)).length, number * 50);
      }
      const overlaps = [[0, 1], [0, 2], [1, 2]].map(([a, b]) => books[a].assignedQids.filter((id) => books[b].assignedQids.includes(id)).length);
      assert.deepEqual(overlaps, [0, 0, 0]);
      const reviews = [];
      for (const finished of books.slice(0, 2)) {
        await page.goto(BASE + '/__seed'); const before = await snapshot(page);
        await page.addInitScript(() => {
          window.reviewWrites = [];
          const original = Storage.prototype.setItem;
          Storage.prototype.setItem = function (key, value) { if (this === localStorage) window.reviewWrites.push(key); return original.call(this, key, value); };
        });
        await gotoBooklet(page, BASE, 1, finished.id); await expectScore(page, 50, 50);
        assert.equal(await page.locator('#daily-readonly').isVisible(), true); assert.equal(await card(page).locator('input:disabled').count(), 4);
        const time = await page.locator('#daily-time').innerText(); await page.locator('#daily-previous').click();
        await page.clock.runFor(16_000); await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
        assert.equal(await page.locator('#daily-time').innerText(), time); assert.equal(await page.evaluate(() => window.reviewWrites.length), 0);
        assert.deepEqual(await snapshot(page), before); await reload(page); await expectScore(page, 50, 50); assert.deepEqual(await snapshot(page), before);
        reviews.push({ number: finished.number, correct: 50, total: 50, secondsAdvanced: 16, writes: 0, timerUnchanged: true, changedKeys: 0 });
      }
      Object.assign(actual, { books: 3, sizes: [50, 50, 50], answeredThroughUI: 150, pairwiseOverlap: overlaps, attempts: 150, uniqueAttemptIds: new Set((await readAttempts(page)).map((a) => a.id)).size, reviews });
      fixtures.review = { values: { [BOOK]: await readStore(page), [ATT]: { version: 1, attempts: await readAttempts(page) } }, subject: 1, bookId: books[0].id, target: '#daily-score' };
    });

    await runCase(6, '120題縮庫的第3本只有20題並用完', async (context, actual) => {
      const page = await newPage(context); const allowed = new Set(pool(1).slice(0, 120).map((q) => q.id));
      await changeCatalog(page, (items) => items.filter((q) => q.subject !== 1 || allowed.has(q.id))); await openCatalog(page, BASE);
      const books = []; const labels = [];
      for (let number = 1; number <= 3; number++) {
        await openCatalog(page, BASE, 1); const button = page.locator('[data-open-subject="1"]'); labels.push(await button.innerText());
        if (number === 3) assert.equal(await button.innerText(), '開下一本（20 題）');
        await openNewBooklet(page, BASE, 1);
        const opened = await currentBook(page); assert.equal(opened.questions.length, number === 3 ? 20 : 50); books.push(opened);
        await answerThrough(page, number === 3 ? 20 : 50); await submit(page); await expectScore(page, number === 3 ? 20 : 50, number === 3 ? 20 : 50);
      }
      const overlaps = [[0, 1], [0, 2], [1, 2]].map(([a, b]) => books[a].assignedQids.filter((id) => books[b].assignedQids.includes(id)).length);
      assert.deepEqual(overlaps, [0, 0, 0]);
      assert.match(await page.locator('#daily-score-points').innerText(), /不是正式考試換算/);
      await backToCatalog(page);
      assert.match(await section(page).innerText(), /未做題已用完/);
      assert.equal(await section(page).locator('[data-open-subject]').count(), 0);
      assert.equal((await readAttempts(page)).length, 120);
      Object.assign(actual, { eligible: 120, sizes: [50, 50, 20], labels, pairwiseOverlap: overlaps, attempts: 120, visibleOpenButtons: 0 });
      fixtures.exhausted = { values: { [BOOK]: await readStore(page), [ATT]: { version: 1, attempts: await readAttempts(page) } }, allowed: [...allowed], target: '#daily-directory-1' };
    });

    await runCase(7, '做過同題群組成員後不抽另一題', async (context, actual) => {
      const page = await newPage(context); const q = catalog.find((q) => q.id === duplicate1);
      const attempted = { id: 'duplicate-done', qid: q.id, rev: q.rev, choice: answers.get(q.id), correct: true, ts: NOW, mode: 'quiz', ms: 1000 };
      const candidates = new Set([duplicate3, ...pool(3).slice(0, 49).map((item) => item.id)]);
      assert.equal(candidates.size, 50);
      await seed(page, { [ATT]: { version: 1, attempts: [attempted] } });
      await changeCatalog(page, (items) => items.filter((item) => item.subject !== 3 || candidates.has(item.id)));
      await openCatalog(page, BASE, 3); assert.equal(await page.locator('[data-open-subject="3"]').innerText(), '開第 1 本（49 題）');
      await openNewBooklet(page, BASE, 3);
      const opened = await currentBook(page, 3); assert.equal(opened.questions.length, 49);
      assert.equal(opened.assignedQids.includes(duplicate3), false); assert.deepEqual(await readAttempts(page), [attempted]);
      Object.assign(actual, { attempted: duplicate1, excluded: duplicate3, candidatesBeforeExclusion: 50, questions: 49, excludedMembers: 1, attempts: 1 });
    });

    await runCase(8, '交卷3個保存階段中斷後不重複', async (context, actual) => {
      actual.stages = [];
      for (const stage of ['prepare', 'attempts', 'finalize']) {
        const isolated = stage === 'prepare' ? context : await newContext();
        try {
          const page = await newPage(isolated); const b = booklet(pool(1).slice(0, 50), answers, { id: `fault-${stage}`, number: 1, answered: 50, correct: 37 });
          await seed(page, { [BOOK]: { ...emptyStore(), current: { '1': b.id, '3': null }, booklets: [b] } }); await enterBooklet(page, BASE, 1, b.id);
          await armWriteFailure(page, stage); await submit(page); await page.locator('#daily-save-error:not([hidden])').waitFor();
          assert.equal(await page.locator('#daily-discard').isVisible(), false, '交卷中及交卷失敗不能放棄');
          const fault = await page.evaluate(() => ({ throws: window.bookletFault.throws, attemptIds: window.bookletFault.attemptIds }));
          assert.equal(fault.throws, 1); assert.equal(fault.attemptIds.length, 50); assert.equal(await page.locator('#daily-score').isVisible(), false);
          const before = (await readAttempts(page)).length; assert.equal(before, stage === 'finalize' ? 50 : 0);
          await page.evaluate(() => { window.bookletFault.armed = false; });
          if (stage === 'finalize') await reload(page); else await page.locator('#daily-retry').click();
          await expectScore(page, 37, 50);
          const attempts = await readAttempts(page); assert.equal(attempts.length, 50); assert.equal(new Set(attempts.map((a) => a.id)).size, 50);
          assert.deepEqual(attempts.map((a) => a.id).sort(), [...fault.attemptIds].sort());
          await reload(page); await expectScore(page, 37, 50); assert.deepEqual(await readAttempts(page), attempts);
          assert.equal((await readStore(page)).booklets[0].status, 'submitted');
          actual.stages.push({ stage, injectedFailures: 1, attemptsBeforeRetry: before, attemptsAfterRetry: 50, uniqueIds: 50, correct: 37, total: 50, idsStable: true, recovery: stage === 'finalize' ? 'reload' : 'retry' });
        } finally { if (isolated !== context) await closeContext(isolated); }
      }
    });

    await runCase(9, '同科2本未交卷時先檢討再返回目前題本', async (context, actual) => {
      const page = await newPage(context); const first = booklet(pool(1).slice(0, 50), answers, { id: 'old-draft', number: 1, answered: 50, correct: 37, createdDate: '2026-11-06' });
      const draft = { id: first.id, seq: 1, subject: 1, date: '2026-11-06', status: 'open', position: 49, questions: first.questions };
      const set = { date: YESTERDAY, subject: 1, questions: pool(1).slice(50, 100).map(({ id, rev }) => ({ id, rev })) };
      await seed(page, { [DRAFT]: { version: 1, drafts: [draft] }, [CACHE]: { version: 1, sets: [set] } }); await openCatalog(page, BASE);
      const store = await readStore(page); assert.equal(store.booklets.length, 2); assert.equal(store.booklets.filter((b) => b.status === 'open').length, 2);
      const firstId = 'v1-S1-2026-11-06-draft'; const secondId = 'v1-S1-2026-11-07-set';
      assert.equal(store.current['1'], firstId); await enterBooklet(page, BASE, 1, firstId); await submit(page);
      await page.waitForURL((url) => url.searchParams.get('book') === firstId); await ready(page); await expectScore(page, 37, 50);
      assert.equal((await readStore(page)).current['1'], secondId); assert.equal(await page.locator('#daily-readonly').isVisible(), true);
      assert.equal((await readAttempts(page)).length, 50);
      await backToCatalog(page);
      assert.equal(await page.locator('#daily-practice').isVisible(), false);
      await enterBooklet(page, BASE, 1, secondId);
      assert.equal(new URL(page.url()).searchParams.get('book'), secondId); assert.equal((await currentBook(page)).id, secondId);
      assert.equal(await page.locator('#daily-position').innerText(), '第 1／50 題'); assert.equal((await readStore(page)).booklets.length, 2);
      Object.assign(actual, { migratedOpenBooks: 2, reviewBook: firstId, currentAfterSubmit: secondId, correct: 37, total: 50, points: 74, attempts: 50, returnedBook: secondId, returnedPosition: 1, bookletsAfterReturn: 2 });
    });

    await runCase(10, '目錄逐欄資料與台北跨日進度符合手算', async (context, actual) => {
      const page = await newPage(context); const questions = pool(1).slice(0, 180); const allowed = new Set(questions.map((q) => q.id));
      const yesterday = booklet(questions.slice(0, 50), answers, { id: 'history-yesterday', number: 1, status: 'submitted', answered: 50, correct: 40, createdDate: '2026-11-06', submittedAt: '2026-11-07T15:59:00.000Z' });
      const today = booklet(questions.slice(50, 70), answers, { id: 'history-today', number: 2, status: 'submitted', answered: 20, correct: 13, createdDate: YESTERDAY, submittedAt: '2026-11-07T16:01:00.000Z' });
      const retired = booklet(questions.slice(70, 75), answers, { id: 'history-retired', number: 3, status: 'retired' }); retired.questions = [];
      const open = booklet(questions.slice(75, 125), answers, { id: 'history-open', number: 4, answered: 17 });
      const store = { ...emptyStore(), current: { '1': open.id, '3': null }, booklets: [yesterday, today, retired, open] };
      const attempts = [...yesterday.submission.attempts, ...today.submission.attempts];
      await seed(page, { [BOOK]: store, [ATT]: { version: 1, attempts } });
      await changeCatalog(page, (items) => items.filter((q) => q.subject !== 1 || allowed.has(q.id))); await openCatalog(page, BASE);
      const metrics = () => section(page).locator('.booklet-catalog-metrics dd').allTextContents();
      const before = await metrics(); assert.deepEqual(before, ['20 題', '1 本，另 1 本 5 題']);
      await page.clock.setFixedTime(new Date(TOMORROW)); await reload(page);
      const after = await metrics(); assert.deepEqual(after, ['0 題', '1 本，另 1 本 5 題']);
      const actualRows = await rowCells(page);
      assert.deepEqual(actualRows, [
        ['第 4 本 2026-11-08', '作答中', '50 題', '已答 17／50', '繼續作答 →'],
        ['第 3 本 2026-11-08', '已結束', '0 題', '', ''],
        ['第 2 本 2026-11-07', '已交卷', '20 題', '答對 13／20', '回看檢討 →'],
        ['第 1 本 2026-11-06', '已交卷', '50 題', '答對 40／50', '回看檢討 →'],
      ]);
      assert.equal(await rows(page).nth(1).locator('a').count(), 0);
      assert.match(await page.locator('#daily-directory').innerText(), /題本只存在這個瀏覽器的這個網址/);
      await enterBooklet(page, BASE, 1, open.id); await expectAnswerFocus(page);
      assert.equal(await page.locator('#daily-progress').innerText(), '這本已答 17／50');
      Object.assign(actual, { rows: actualRows, catalog: 180, assigned: 125, freeQuestions: 55, fullBooks: 1, lastBook: 5, attempts: 70, before, nextDay: after, taipeiBoundary: ['2026-11-07T15:59:00Z', '2026-11-07T16:01:00Z'] });
    });

    await runCase(11, '空的作答中題本顯示結束操作且能結束', async (context, actual) => {
      const page = await newPage(context);
      const empty = booklet(pool(1).slice(0, 3), answers, { id: 'empty-open', number: 1 }); empty.questions = [];
      await seed(page, { [BOOK]: { ...emptyStore(), current: { '1': empty.id, '3': null }, booklets: [empty] } }); await openCatalog(page, BASE);
      const row = rows(page);
      const cells = await row.locator('[role="cell"]').allTextContents();
      assert.deepEqual(cells.slice(1), ['需結束', '0 題', '已答 0／0', '前往結束題本 →']);
      assert.equal((await currentBook(page)).status, 'open');
      assert.equal(await row.getByRole('link', { name: '繼續作答 →' }).count(), 0);
      actual.screenshots = [];
      for (const [width, theme] of [[1440, 'light'], [320, 'dark']]) {
        await page.setViewportSize({ width, height: width === 1440 ? 900 : 700 });
        await page.evaluate((theme) => { document.documentElement.dataset.theme = theme; }, theme);
        await page.evaluate(() => document.fonts.ready);
        await row.scrollIntoViewIfNeeded();
        const file = resolve(output, `empty-row-${width}-${theme}.png`);
        await page.screenshot({ path: file }); actual.screenshots.push(file);
        report.screenshots.push({ state: 'empty-row', width, theme, fullPage: false, file });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
      }
      await enterBooklet(page, BASE, 1, empty.id);
      await page.locator('#daily-retire:not([hidden])').waitFor();
      assert.equal((await currentBook(page)).status, 'open');
      await page.locator('#daily-retire-book').click(); await page.waitForURL((url) => !url.searchParams.has('book')); await waitCatalog(page);
      const finished = (await readStore(page)).booklets[0];
      assert.equal(finished.status, 'retired'); assert.equal((await readStore(page)).current['1'], null);
      assert.deepEqual(finished.assignedQids, empty.assignedQids); assert.equal((await readAttempts(page)).length, 0);
      Object.assign(actual, { cells, statusBefore: 'open', statusAfter: finished.status, assigned: 3, attempts: 0 });
    });

    await runCase(12, '另一頁寫入作答後即時更新題量與舊紀錄但不寫題本', async (context, actual) => {
      const page = await newPage(context); const candidates = pool(1).slice(0, 50); const allowed = new Set(candidates.map((q) => q.id));
      await seed(page, { [BOOK]: emptyStore() });
      await changeCatalog(page, (items) => items.filter((q) => q.subject !== 1 || allowed.has(q.id))); await openCatalog(page, BASE);
      assert.equal(await page.locator('[data-open-subject="1"]').innerText(), '開第 1 本');
      assert.equal((await section(page).locator('.booklet-catalog-metrics dd').nth(1).innerText()).replace(/\s/g, ''), '1本');
      assert.equal(await page.locator('#daily-legacy-records').isVisible(), false);
      const before = await snapshot(page); const url = page.url();
      await page.evaluate(() => {
        window.overviewWrites = [];
        const setItem = Storage.prototype.setItem; const removeItem = Storage.prototype.removeItem; const clear = Storage.prototype.clear;
        Storage.prototype.setItem = function (key, value) { if (this === localStorage) window.overviewWrites.push(key); return setItem.call(this, key, value); };
        Storage.prototype.removeItem = function (key) { if (this === localStorage) window.overviewWrites.push(key); return removeItem.call(this, key); };
        Storage.prototype.clear = function () { if (this === localStorage) window.overviewWrites.push('*'); return clear.call(this); };
        window.overviewLoaded = true;
      });
      const other = await newPage(context); await other.goto(BASE + '/__seed');
      const q = candidates[0];
      const attempted = { id: 'other-page-import', qid: q.id, rev: q.rev, choice: answers.get(q.id), correct: true, ts: NOW, mode: `daily:${TODAY}:S1`, ms: 1000 };
      await other.evaluate(({ key, attempted }) => localStorage.setItem(key, JSON.stringify({ version: 1, attempts: [attempted] })), { key: ATT, attempted });
      await page.waitForFunction(() => document.querySelector('[data-open-subject="1"]').textContent === '開第 1 本（49 題）');
      const after = await snapshot(page);
      assert.equal(after[BOOK], before[BOOK]);
      assert.deepEqual(Object.fromEntries(Object.entries(after).filter(([key]) => key !== ATT)), before);
      assert.equal((await section(page).locator('.booklet-catalog-metrics dd').nth(1).innerText()).replace(/\s/g, ''), '0本，另1本49題');
      assert.equal(await page.locator('#daily-legacy-records').isVisible(), true);
      assert.deepEqual(await page.locator('#daily-legacy-rows .booklet-legacy-row').allTextContents(), [`${TODAY}科目 1已答 1 題答對 1 題`]);
      assert.equal(page.url(), url); assert.equal(await page.evaluate(() => window.overviewLoaded), true);
      assert.deepEqual(await page.evaluate(() => window.overviewWrites), []);
      assert.equal(await page.locator('[data-open-subject="1"]').isEnabled(), true);
      assert.equal(await page.locator('#daily-save-error').isVisible(), false);
      Object.assign(actual, { initialQuestions: 50, updatedQuestions: 49, initialFullBooks: 1, updatedFullBooks: 0, legacyRecords: 1, bookletBytesUnchanged: true, writesFromDailyPage: 0, reloaded: false });
    });

    await runCase(13, '作答與重整只顯示這本，交卷後同本回看且沒有開本按鈕', async (context, actual) => {
      const page = await newPage(context); const q = pool(1)[0];
      const legacy = { id: 'focus-legacy', qid: q.id, rev: q.rev, choice: answers.get(q.id), correct: true, ts: NOW, mode: 'daily:' + YESTERDAY + ':S1', ms: 1000 };
      await seed(page, { [BOOK]: emptyStore(), [ATT]: { version: 1, attempts: [legacy] } }); await openCatalog(page, BASE);
      assert.equal(await page.locator('#daily-legacy-records').isVisible(), true);
      assert.equal(await page.locator('#daily-legacy-rows .booklet-legacy-row').count(), 1);
      await openNewBooklet(page, BASE, 1);
      const first = await currentBook(page); assert.equal(first.number, 1); await expectAnswerFocus(page);
      const date = await page.locator('#daily-date').innerText();
      await reload(page); await expectAnswerFocus(page);
      assert.equal(await page.locator('#daily-date').innerText(), date); assert.equal((await currentBook(page)).id, first.id);
      await answerThrough(page, 50); await submit(page); await expectScore(page, 50, 50);
      assert.equal(new URL(page.url()).searchParams.get('book'), first.id);
      assert.equal(await page.locator('#daily-directory').isVisible(), false);
      assert.equal(await page.locator('#daily-legacy-records').isVisible(), false);
      assert.equal(await page.locator('[data-open-subject]').count(), 0);
      await backToCatalog(page);
      assert.equal(await page.locator('#daily-legacy-records').isVisible(), true);
      await openNewBooklet(page, BASE, 1); await expectAnswerFocus(page);
      await enterBooklet(page, BASE, 1, first.id); await expectScore(page, 50, 50);
      assert.equal(await page.locator('#daily-readonly').isVisible(), true);
      assert.equal(await page.locator('[data-open-subject]').count(), 0);
      Object.assign(actual, { firstNumber: 1, hiddenBeforeAndAfterReload: true, legacyRecords: 1, dateUnchanged: true, submittedBook: first.id, reviewOpenButtons: 0, legacyVisibleOnlyInCatalog: true, viewingWithOpenBook: true });
    });

    await runCase(14, '兩科目錄分別顯示作答中與已交卷的列及動作', async (context, actual) => {
      const page = await newPage(context);
      const current = booklet(pool(1).slice(0, 50), answers, { id: 'catalog-current', number: 2, answered: 17 });
      const previous = booklet(pool(1).slice(50, 52), answers, { id: 'catalog-previous', number: 1, status: 'submitted', answered: 2 });
      const other = booklet(pool(3).slice(0, 20), answers, { id: 'catalog-other', number: 1, subject: 3, status: 'submitted', answered: 20, correct: 13 });
      const values = { [BOOK]: { ...emptyStore(), current: { '1': current.id, '3': null }, booklets: [previous, current, other] }, [ATT]: { version: 1, attempts: [...previous.submission.attempts, ...other.submission.attempts] } };
      await seed(page, values); const before = await snapshot(page); await openCatalog(page, BASE);
      assert.deepEqual(await snapshot(page), before);
      const subject1 = await rowCells(page, 1); const subject3 = await rowCells(page, 3);
      assert.deepEqual(subject1, [
        ['第 2 本 2026-11-08', '作答中', '50 題', '已答 17／50', '繼續作答 →'],
        ['第 1 本 2026-11-08', '已交卷', '2 題', '答對 2／2', '回看檢討 →'],
      ]);
      assert.deepEqual(subject3, [['第 1 本 2026-11-08', '已交卷', '20 題', '答對 13／20', '回看檢討 →']]);
      for (const b of [current, previous, other]) {
        const link = section(page, b.subject).locator('[data-booklet-id="' + b.id + '"]');
        const url = new URL(await link.getAttribute('href'), BASE);
        assert.equal(url.searchParams.get('subject'), String(b.subject)); assert.equal(url.searchParams.get('book'), b.id);
      }
      assert.equal(await section(page, 1).locator('[data-open-subject]').count(), 0);
      assert.equal(await section(page, 3).locator('[data-open-subject]').innerText(), '開下一本');
      fixtures.catalog = { values, target: '#daily-directory' };
      await enterBooklet(page, BASE, 3, other.id); await expectScore(page, 13, 20); await backToCatalog(page);
      await enterBooklet(page, BASE, 1, current.id); await expectAnswerFocus(page);
      Object.assign(actual, { subject1, subject3, storeUnchangedInCatalog: true, subject1OpenButtons: 0, subject3OpenButtons: 1, reviewAccessible: true, resumeAccessible: true });
    });

    await runCase(15, '未答題本顯示放棄，答題及重載後隱藏', async (context, actual) => {
      const page = await newPage(context); await openNewBooklet(page, BASE, 1); await page.locator('#daily-discard:visible').waitFor();
      actual.screenshots = [];
      for (const [width, theme] of [[1440, 'light'], [1440, 'dark'], [390, 'light'], [320, 'dark']]) {
        await page.setViewportSize({ width, height: width === 1440 ? 900 : 700 });
        await page.evaluate((theme) => { document.documentElement.dataset.theme = theme; window.scrollTo(0, 0); }, theme);
        await page.evaluate(() => document.fonts.ready);
        for (const modal of [false, true]) {
          if (modal) {
            await page.locator('#daily-discard').click();
            await page.locator('#daily-discard-dialog[open]').waitFor();
            assert.equal(await page.locator('#daily-discard-cancel').evaluate((button) => button === document.activeElement), true);
            const description = await page.locator('#daily-discard-description').innerText();
            for (const copy of ['從題本清單移除', '解除分配，之後可能再抽到', '用時不保留，已有的作答紀錄不變']) assert.ok(description.includes(copy));
            const layout = await page.locator('#daily-discard-dialog').evaluate((dialog) => ({ width: dialog.clientWidth, scroll: dialog.scrollWidth, left: dialog.getBoundingClientRect().left, right: dialog.getBoundingClientRect().right }));
            assert.ok(layout.scroll <= layout.width && layout.left >= 0 && layout.right <= width, '確認框不可溢出');
          }
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
          await page.evaluate(() => window.scrollTo(0, 0));
          const file = resolve(output, `discard-${modal ? 'dialog' : 'answering'}-${width}-${theme}-full.png`);
          await page.screenshot({ path: file, fullPage: true }); actual.screenshots.push(file);
          report.screenshots.push({ state: modal ? 'discard-dialog' : 'discard-answering', width, theme, fullPage: true, file });
          if (modal) await page.locator('#daily-discard-cancel').click();
        }
      }
      await answer(page); assert.equal(await page.locator('#daily-discard').isVisible(), false);
      await reload(page); assert.equal(await page.locator('#daily-discard').isVisible(), false);
      Object.assign(actual, { answered: 1, hiddenAfterAnswer: true, hiddenAfterReload: true, screenshots: actual.screenshots });
    });

    await runCase(16, '取消放棄不寫資料，恢復焦點並繼續計時', async (context, actual) => {
      const page = await newPage(context);
      const current = booklet(pool(1).slice(0, 2), answers, { id: 'cancel-discard', number: 1 });
      const oldAttempt = { id: 'unrelated-attempt', qid: pool(3)[0].id, rev: pool(3)[0].rev, choice: 'A', correct: false, ts: NOW, mode: 'quiz', ms: 1000 };
      await seed(page, { [BOOK]: { ...emptyStore(), current: { '1': current.id, '3': null }, booklets: [current] }, [ATT]: { version: 1, attempts: [oldAttempt] } });
      await enterBooklet(page, BASE, 1, current.id); const before = await snapshot(page);
      for (const cancel of ['button', 'escape']) {
        await page.locator('#daily-discard').click();
        // 跨過原保存週期，驗證確認框內沒有背景寫入。
        await page.clock.runFor(16_000);
        assert.deepEqual(await snapshot(page), before);
        if (cancel === 'button') await page.locator('#daily-discard-cancel').click();
        else await page.keyboard.press('Escape');
        await page.locator('#daily-discard-dialog').waitFor({ state: 'hidden' });
        assert.equal(await page.locator('#daily-discard-dialog').evaluate((dialog) => dialog.open), false);
        assert.deepEqual(await snapshot(page), before);
        assert.equal(await page.locator('#daily-practice').isVisible(), true);
        assert.equal(await page.locator('#daily-discard').evaluate((button) => button === document.activeElement), true);
      }
      await page.clock.runFor(16_000);
      assert.ok((await currentBook(page)).questions[0].ms > current.questions[0].ms, '取消後恢復保存用時');
      assert.equal((await snapshot(page))[ATT], before[ATT]);
      Object.assign(actual, { cancelButton: true, escape: true, backgroundWrites: 0, unchangedKeys: [BOOK, ATT], focusReturned: true, savingResumed: true });
    });

    await runCase(17, '兩科確認放棄都返回目錄且不開新本', async (context, actual) => {
      const page = await newPage(context); actual.subjects = [];
      for (const subject of [1, 3]) {
        const oldAttempt = { id: 'keep-attempt', qid: pool(subject)[0].id, rev: pool(subject)[0].rev, choice: 'A', correct: false, ts: NOW, mode: 'quiz', ms: 1000 };
        await seed(page, { [ATT]: { version: 1, attempts: [oldAttempt] } });
        await openNewBooklet(page, BASE, subject); await page.locator('#daily-discard:visible').waitFor();
        const discarded = await currentBook(page, subject); const before = (await snapshot(page))[ATT];
        await page.locator('#daily-discard').click(); await page.locator('#daily-discard-confirm').click();
        await page.waitForURL(BASE + `/daily/?subject=${subject}`); await waitCatalog(page);
        let data = await readStore(page);
        assert.equal(data.booklets.length, 0); assert.equal(data.current[subject], null);
        assert.equal(await rows(page, subject).count(), 0); assert.equal(new URL(page.url()).searchParams.has('book'), false);
        assert.equal((await snapshot(page))[ATT], before);
        assert.notEqual((await snapshot(page))[BOOK], null);
        await reload(page); await page.clock.runFor(16_000); data = await readStore(page);
        assert.equal(data.booklets.some((b) => b.id === discarded.id), false);
        assert.equal(data.booklets.length, 0); assert.equal((await snapshot(page))[ATT], before);
        actual.subjects.push({ subject, deleted: discarded.id, newKeyRetained: true, attemptsUnchanged: true, autoOpened: 0 });
      }
    });

    await runCase(18, '放棄第 2 本回目錄保留第 1 本，回看不能放棄', async (context, actual) => {
      const page = await newPage(context);
      const first = booklet(pool(1).slice(0, 2), answers, { id: 'keep-first', number: 1, status: 'submitted', answered: 2 }); first.position = 0;
      const second = booklet(pool(1).slice(2, 4), answers, { id: 'discard-second', number: 2 });
      await seed(page, { [BOOK]: { ...emptyStore(), current: { '1': second.id, '3': null }, booklets: [first, second] }, [ATT]: { version: 1, attempts: first.submission.attempts } });
      await enterBooklet(page, BASE, 1, second.id); const before = (await snapshot(page))[ATT];
      await page.locator('#daily-discard').click(); await page.locator('#daily-discard-confirm').click();
      await page.waitForURL((url) => !url.searchParams.has('book')); await waitCatalog(page);
      assert.equal(new URL(page.url()).searchParams.get('subject'), '1');
      assert.equal(await page.locator('#daily-practice').isVisible(), false);
      assert.deepEqual((await readStore(page)).booklets, [first]);
      assert.equal(await rows(page).count(), 1); assert.equal(await page.locator('[data-booklet-id="' + second.id + '"]').count(), 0);
      assert.equal((await snapshot(page))[ATT], before);
      await enterBooklet(page, BASE, 1, first.id); await expectScore(page, 2, 2);
      assert.equal(await page.locator('#daily-discard').isVisible(), false);
      Object.assign(actual, { remainingBooklets: 1, catalogAfterDiscard: true, reviewedNumber: 1, attemptsUnchanged: true, hiddenInReview: true, autoOpened: 0 });
    });

    await runCase(19, '放棄寫入失敗保留題本，重試仍須確認', async (context, actual) => {
      const page = await newPage(context); await openNewBooklet(page, BASE, 1); await page.locator('#daily-discard:visible').waitFor();
      const before = await snapshot(page);
      await page.evaluate((key) => {
        const original = Storage.prototype.setItem;
        window.discardThrows = 0;
        Storage.prototype.setItem = function (name, value) {
          if (name === key && JSON.parse(value).booklets.length === 0) { window.discardThrows++; throw new DOMException('injected discard failure', 'QuotaExceededError'); }
          return original.call(this, name, value);
        };
      }, BOOK);
      await page.locator('#daily-discard').click(); await page.locator('#daily-discard-confirm').click();
      await page.locator('#daily-save-error:visible').waitFor();
      assert.match(await page.locator('#daily-error-message').innerText(), /這本尚未放棄/);
      assert.deepEqual(await snapshot(page), before);
      assert.equal(await page.locator('#daily-practice').isVisible(), true);
      assert.equal(await page.locator('#daily-discard').isVisible(), false);
      await page.locator('#daily-retry').click(); await page.locator('#daily-discard-dialog[open]').waitFor();
      assert.equal(await page.evaluate(() => window.discardThrows), 1, '重試只開確認框，不直接刪除');
      await page.locator('#daily-discard-cancel').click(); assert.deepEqual(await snapshot(page), before);
      Object.assign(actual, { failedWrites: 1, bookletsPreserved: 1, attemptsUnchanged: true, reconfirmed: true });
    });

    await runCase(20, '第 2 版資料開目錄、重整、帶科目都不呼叫寫入', async (context, actual) => {
      const page = await newPage(context);
      const open = booklet(pool(1).slice(0, 3), answers, { id: 'readonly-open', number: 1, answered: 1 });
      // 題目失效與交卷中斷都只能在進入這本後處理，目錄不可順便保存。
      open.questions[0].rev += 100;
      const pending = booklet(pool(3).slice(0, 2), answers, { id: 'readonly-pending', number: 1, subject: 3, status: 'submitting', answered: 2 });
      await seed(page, { [BOOK]: { ...emptyStore(), current: { '1': open.id, '3': pending.id }, booklets: [open, pending] }, [ATT]: { version: 1, attempts: [] } });
      const before = await snapshot(page);
      await page.addInitScript(() => {
        window.catalogWrites = [];
        for (const method of ['setItem', 'removeItem', 'clear']) {
          const original = Storage.prototype[method];
          Storage.prototype[method] = function (...args) {
            if (this === localStorage) window.catalogWrites.push({ method, key: args[0] ?? null });
            return original.apply(this, args);
          };
        }
      });
      actual.visits = [];
      for (const visit of ['plain', 'reload', 'subject1', 'subject3']) {
        if (visit === 'reload') await reload(page);
        else await openCatalog(page, BASE, visit === 'plain' ? undefined : visit === 'subject1' ? 1 : 3);
        await page.clock.runFor(16_000);
        assert.deepEqual(await snapshot(page), before);
        const writes = await page.evaluate(() => window.catalogWrites);
        assert.deepEqual(writes, []);
        assert.equal(await page.locator('#daily-practice').isVisible(), false);
        actual.visits.push({ visit, unchangedKeys: [BOOK, ATT], writes });
      }
    });

    await runCase(21, '有未交卷題本仍先停目錄，續答與返回保留答案位置及用時', async (context, actual) => {
      const page = await newPage(context);
      const b = booklet(pool(1).slice(0, 5), answers, { id: 'resume-from-directory', number: 1, answered: 2 });
      await seed(page, { [BOOK]: { ...emptyStore(), current: { '1': b.id, '3': null }, booklets: [b] } });
      const before = await snapshot(page); await openCatalog(page, BASE);
      assert.equal(new URL(page.url()).searchParams.has('book'), false);
      assert.equal(await page.locator('#daily-practice').isVisible(), false);
      assert.deepEqual(await snapshot(page), before);
      await enterBooklet(page, BASE, 1, b.id); await expectAnswerFocus(page);
      assert.equal(await page.locator('#daily-position').innerText(), '第 3／5 題');
      assert.equal(new URL(page.url()).searchParams.get('book'), b.id);
      assert.deepEqual((await currentBook(page)).questions.map((q) => q.choice), b.questions.map((q) => q.choice));
      const entryMs = (await currentBook(page)).questions.reduce((sum, q) => sum + q.ms, 0);
      await answer(page); await page.locator('#daily-unsure').click();
      await page.locator('#daily-next').click(); await page.clock.runFor(2500);
      await backToCatalog(page);
      const saved = await currentBook(page); const exitMs = saved.questions.reduce((sum, q) => sum + q.ms, 0);
      assert.equal(saved.questions[2].choice, answers.get(b.questions[2].id));
      assert.equal(saved.questions[2].unsure, true); assert.equal(saved.position, 3);
      assert.ok(exitMs > entryMs, '回目錄前保存用時');
      assert.equal((await readStore(page)).booklets.length, 1);
      assert.equal(await page.locator('#daily-practice').isVisible(), false);
      await enterBooklet(page, BASE, 1, b.id);
      assert.equal(await page.locator('#daily-position').innerText(), '第 4／5 題');
      assert.equal((await currentBook(page)).questions[2].choice, saved.questions[2].choice);
      Object.assign(actual, { initiallyCatalog: true, initialPosition: 3, savedPosition: 4, savedAnswer: saved.questions[2].choice, savedUnsure: true, entryMs, exitMs, booklets: 1 });
    });

    await runCase(22, '目錄直接開下一本不顯示確認框，交卷後同本回看沒有開本按鈕', async (context, actual) => {
      const page = await newPage(context);
      const first = booklet(pool(1).slice(0, 2), answers, { id: 'opening-first', number: 1, status: 'submitted', answered: 2 });
      await seed(page, { [BOOK]: { ...emptyStore(), booklets: [first] }, [ATT]: { version: 1, attempts: first.submission.attempts } });
      const allowed = new Set(pool(1).slice(0, 4).map((q) => q.id));
      await changeCatalog(page, (items) => items.filter((q) => q.subject !== 1 || allowed.has(q.id)));
      let modalCalls = 0; let nativeDialogs = 0;
      await context.exposeBinding('recordOpeningModal', () => { modalCalls++; });
      await page.addInitScript(() => {
        const original = HTMLDialogElement.prototype.showModal;
        HTMLDialogElement.prototype.showModal = function (...args) { void window.recordOpeningModal(); return original.apply(this, args); };
      });
      page.on('dialog', async (dialog) => { nativeDialogs++; await dialog.dismiss(); });
      const id = await openNewBooklet(page, BASE, 1);
      const opened = await currentBook(page);
      assert.equal(modalCalls, 0); assert.equal(nativeDialogs, 0);
      assert.equal(id, opened.id); assert.equal(opened.number, 2); assert.equal(opened.position, 0);
      assert.equal(await page.locator('#daily-position').innerText(), '第 1／2 題');
      assert.equal(await page.locator('dialog[open]').count(), 0);
      await answerThrough(page, 2); await submit(page); await expectScore(page, 2, 2);
      assert.equal(new URL(page.url()).searchParams.get('book'), id);
      assert.equal(await page.locator('[data-open-subject]').count(), 0);
      Object.assign(actual, { openingModalCalls: 0, nativeDialogs: 0, newBookId: id, storeBookId: opened.id, number: 2, initialPosition: 1, reviewOpenButtons: 0 });
    });

    await runCase(23, '已放棄、不存在與科目不符的題本網址都不改資料', async (context, actual) => {
      const page = await newPage(context);
      const abandonedId = await openNewBooklet(page, BASE, 1);
      await page.locator('#daily-discard').click(); await page.locator('#daily-discard-confirm').click();
      await page.waitForURL((url) => !url.searchParams.has('book')); await waitCatalog(page);
      const other = booklet(pool(3).slice(0, 2), answers, { id: 'missing-other-subject', number: 1, subject: 3 });
      const values = { [BOOK]: { ...emptyStore(), current: { '1': null, '3': other.id }, booklets: [other] }, [ATT]: { version: 1, attempts: [] } };
      await seed(page, values); const before = await snapshot(page);
      actual.urls = [];
      for (const [kind, id] of [['abandoned', abandonedId], ['nonexistent', 'does-not-exist'], ['subject-mismatch', other.id]]) {
        await gotoBooklet(page, BASE, 1, id);
        assert.equal(await page.locator('#daily-unavailable-title').innerText(), '找不到這本題本');
        assert.equal(await page.locator('#daily-back').isVisible(), true);
        assert.equal(await page.locator('#daily-back').getAttribute('href'), '/daily/?subject=1');
        assert.equal(await page.locator('#daily-practice').isVisible(), false);
        assert.equal(await page.locator('[data-open-subject]').count(), 0);
        assert.deepEqual(await snapshot(page), before);
        await backToCatalog(page); assert.deepEqual(await snapshot(page), before);
        actual.urls.push({ kind, id, storeUnchanged: true, backToCatalog: true });
      }
      fixtures.missing = { values, subject: 1, bookId: abandonedId, target: '#daily-unavailable' };
    });

    // 全失效畫面另外造資料，確認「結束」保留分配紀錄且不寫作答。
    const retired = booklet(pool(1).slice(0, 3), answers, { id: 'all-invalid', number: 1 });
    retired.questions = retired.questions.map((q) => ({ ...q, rev: q.rev + 100 }));
    fixtures.retire = { values: { [BOOK]: { ...emptyStore(), current: { '1': retired.id, '3': null }, booklets: [retired] } }, subject: 1, bookId: retired.id, target: '#daily-retire' };

    const shotStates = ['first', 'catalog', 'answering', 'review', 'missing', 'exhausted', 'retire'];
    for (const state of shotStates) for (const width of [1440, 390, 320]) for (const theme of ['light', 'dark']) {
      const context = await newContext(); const measurement = { state, width, height: width === 1440 ? 900 : 700, theme }; report.measurements.push(measurement);
      try {
        assert.ok(fixtures[state], `${state} 的流程資料必須存在`);
        const fixture = fixtures[state]; const page = await newPage(context);
        await page.setViewportSize({ width, height: measurement.height }); await seed(page, fixture.values);
        if (fixture.allowed) { const allowed = new Set(fixture.allowed); await changeCatalog(page, (items) => items.filter((q) => q.subject !== 1 || allowed.has(q.id))); }
        if (fixture.bookId) await gotoBooklet(page, BASE, fixture.subject, fixture.bookId);
        else await openCatalog(page, BASE);
        await page.evaluate((theme) => { document.documentElement.dataset.theme = theme; }, theme);
        await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(200);
        await page.locator(fixture.target).evaluate((element) => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
        await page.waitForTimeout(100);
        measurement.overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        // 先保存數據與圖片再斷言，即使版面失敗仍有完整證據，不用全頁圖推論固定列位置。
        if (state === 'answering') { const measured = await measureActions(page); report.actionMeasurements.push({ state, width, theme, ...measured }); }
        const file = resolve(output, `${state}-${width}-${theme}-viewport.png`);
        await page.screenshot({ path: file, fullPage: false }); report.screenshots.push({ state, width, theme, fullPage: false, file });
        const fullFile = resolve(output, `${state}-${width}-${theme}-full.png`);
        await page.screenshot({ path: fullFile, fullPage: true }); report.screenshots.push({ state, width, theme, fullPage: true, file: fullFile });
        assert.ok(measurement.overflow <= 0, `${state}/${width}/${theme} 水平溢出 ${measurement.overflow}px`);
        if (state === 'answering') assertActions(report.actionMeasurements.at(-1));
        if (state === 'retire' && width === 1440 && theme === 'light') {
          assert.equal((await readAttempts(page)).length, 0); await page.locator('#daily-retire-book').click(); await page.waitForURL((url) => !url.searchParams.has('book')); await waitCatalog(page);
          const store = await readStore(page); assert.equal(store.booklets[0].status, 'retired'); assert.equal(store.current['1'], null);
          assert.equal(store.booklets[0].assignedQids.length, 3); assert.equal((await readAttempts(page)).length, 0);
          report.retireCheck = { status: 'retired', current: null, assigned: 3, attempts: 0 };
        }
        measurement.status = 'passed';
      } catch (error) {
        measurement.status = 'failed'; measurement.failure = String(error.stack ?? error);
        report.productIssues.push({ state, width, theme, failure: measurement.failure });
      }
      finally { await closeContext(context); }
    }
    assert.equal(report.cases.length, 23);
    assert.equal(report.cases.find((entry) => entry.id === 15)?.actual.screenshots?.length, 8, '放棄按鈕與確認框各 4 張全頁截圖');
    assert.equal(report.screenshots.filter((s) => !s.fullPage).length, 44, '7 種畫面各 6 張，加上 2 張需結束的目錄列');
    assert.equal(report.screenshots.filter((s) => s.fullPage).length, 50, '7 種畫面各 6 張，加上 8 張放棄畫面');
    report.maxHorizontalOverflow = Math.max(...report.measurements.map((m) => m.overflow ?? 0));
  } catch (error) { report.fatal = String(error.stack ?? error); }
  finally {
    for (const context of contexts) await context.close().catch((error) => { report.errors.push({ type: 'cleanup', message: String(error) }); });
    if (browser) await browser.close().catch((error) => { report.errors.push({ type: 'cleanup', message: String(error) }); });
    if (server?.listening) await new Promise((done) => { server.close(done); server.closeAllConnections(); });
    report.finishedAt = new Date().toISOString();
    report.summary = { casesPassed: report.cases.filter((c) => c.status === 'passed').length, casesFailed: report.cases.filter((c) => c.status === 'failed').length,
      viewportScreenshots: report.screenshots.filter((s) => !s.fullPage).length, fullPageScreenshots: report.screenshots.filter((s) => s.fullPage).length,
      layoutsFailed: report.measurements.filter((m) => m.status === 'failed').length, browserErrors: report.errors.length, requestFailures: report.requestFailures.length };
    report.exitCode = !report.fatal && report.summary.casesPassed === 23 && report.summary.layoutsFailed === 0 && report.summary.viewportScreenshots === 44 && report.summary.fullPageScreenshots === 50 && report.errors.length === 0 && report.requestFailures.length === 0 && report.productIssues.length === 0 ? 0 : 1;
    await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = await runDailyBookletSmoke();
  console.log(JSON.stringify({ ...report.summary, exitCode: report.exitCode, report: resolve(report.output, 'report.json') }));
  process.exitCode = report.exitCode;
}
