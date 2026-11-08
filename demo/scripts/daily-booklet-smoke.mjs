/** 題本驗收只讀指定建置，使用隔離瀏覽器與暫時服務，保留失敗及目前視窗的版面證據。 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { parse } from 'yaml';

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
const ready = (page) => page.locator('#daily-metrics:not([hidden])').waitFor();
const go = async (page, path = '/daily/?subject=1') => { await page.goto(BASE + path); await ready(page); };
const reload = async (page) => { await page.reload(); await ready(page); };
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
  await page.locator('#daily-score:not([hidden])').waitFor();
  assert.equal(await page.locator('#daily-score-heading').innerText(), `答對 ${correct}／${total} 題`);
  assert.match(await page.locator('#daily-score-points').innerText(), new RegExp(`^${correct * 2} 分／${total * 2} 分`));
}

async function expectDeferred(page) {
  assert.equal(await page.locator('[data-explanation]:visible, .option-status:not(:empty):visible, #daily-score:visible, .is-correct:visible, .is-wrong:visible').count(), 0, '交卷前不顯示結果');
  assert.doesNotMatch(await page.locator('.daily-toolbar').innerText(), /答對|答錯|分數|答案|解析/);
  assert.doesNotMatch(await page.locator('.daily-exam').ariaSnapshot(), /參考答案|官方答案|為什麼 [ABCD] 正確|答對了|你的答案|其他選項的問題/);
}

async function expectAnswerFocus(page) {
  assert.equal(await page.locator('#daily-current').count(), 0, '已移除目前題本卡片');
  for (const selector of ['#daily-history', '#daily-legacy-records']) {
    assert.equal(await page.locator(selector).isVisible(), false, `作答中隱藏 ${selector}`);
  }
  for (const selector of ['#daily-date', '#daily-metrics', '.daily-subjects', '#daily-practice']) {
    assert.equal(await page.locator(selector).isVisible(), true, `作答中保留 ${selector}`);
  }
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
      catch (error) { result.status = 'failed'; result.failure = String(error.stack ?? error); }
      finally { await closeContext(context); }
      await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
      console.log(`${id}: ${result.status} ${name}`);
    };

    await runCase(1, '全新環境只在按鈕後開本', async (context, actual) => {
      const page = await newPage(context); await go(page);
      const counts = [(await readStore(page))?.booklets.length ?? 0];
      assert.equal(await page.locator('#daily-open-first').isVisible(), true);
      await reload(page); counts.push((await readStore(page))?.booklets.length ?? 0);
      await page.locator('[data-daily-subject="3"]').click(); await ready(page); counts.push((await readStore(page))?.booklets.length ?? 0);
      await page.locator('[data-daily-subject="1"]').click(); await ready(page); counts.push((await readStore(page))?.booklets.length ?? 0);
      assert.deepEqual(counts, [0, 0, 0, 0]);
      fixtures.first = { values: { [BOOK]: await readStore(page) }, target: '#daily-empty' };
      await page.locator('#daily-open-first').click(); await page.locator('#daily-practice:not([hidden])').waitFor();
      const opened = await currentBook(page);
      assert.equal((await readStore(page)).booklets.length, 1); assert.equal(opened.number, 1); assert.equal(opened.questions.length, 50); assert.equal(opened.position, 0);
      assert.equal(await page.locator('#daily-position').innerText(), '第 1／50 題');
      assert.equal(await page.locator('#daily-numbers button').count(), 1); await expectDeferred(page);
      assert.equal((await readAttempts(page)).length, 0);
      Object.assign(actual, { bookletsBeforeClick: counts, bookletsAfterClick: 1, number: 1, questions: 50, position: 1, attempts: 0 });
    });

    await runCase(2, '跨日保留題目順序答案標記與位置', async (context, actual) => {
      const page = await newPage(context); await go(page); await page.locator('#daily-open-first').click(); await page.locator('#daily-practice:not([hidden])').waitFor();
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
      fixtures.answering = { values: { [BOOK]: await readStore(page) }, target: '#daily-question-heading' };
    });

    await runCase(3, '昨天的舊清單與20筆作答原樣遷移', async (context, actual) => {
      const page = await newPage(context); const questions = pool(1).slice(0, 50);
      const set = { date: YESTERDAY, subject: 1, questions: questions.map(({ id, rev }) => ({ id, rev })) };
      const attempts = questions.slice(0, 20).map((q, index) => ({ id: `legacy-${index}`, qid: q.id, rev: q.rev, choice: answers.get(q.id), correct: true, ts: '2026-11-07T04:00:00.000Z', mode: `daily:${YESTERDAY}:S1`, ms: 1234 + index }));
      await seed(page, { [CACHE]: { version: 1, sets: [set] }, [ATT]: { version: 1, attempts } });
      const rawBefore = await page.evaluate((key) => localStorage.getItem(key), ATT); await go(page);
      const migrated = await currentBook(page);
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
      assert.equal((await readStore(page)).booklets.length, 1); assert.equal(await page.locator('#daily-open-next').isVisible(), false);
      Object.assign(actual, { questions: 50, assigned: migrated.assignedQids.length, locked: 20, attempts: 20, oldAttemptBytesUnchanged: true, booklets: 1, drawn: 0 });
    });

    await runCase(4, '開科目1不影響科目3遷移', async (context, actual) => {
      const pair1 = catalog.find((q) => q.id === duplicate1); const pair3 = catalog.find((q) => q.id === duplicate3);
      const sets = [[pair1, ...pool(1).slice(0, 49)], [pair3, ...pool(3).slice(0, 49)]].map((questions, index) => ({ date: YESTERDAY, subject: index === 0 ? 1 : 3, questions: questions.map(({ id, rev }) => ({ id, rev })) }));
      const values = { [CACHE]: { version: 1, sets } };
      const page = await newPage(context); await seed(page, values); await go(page);
      assert.equal((await readStore(page)).booklets.length, 2);
      await page.locator('[data-daily-subject="3"]').click(); await ready(page);
      const afterSubject1 = await currentBook(page, 3);
      const control = await newContext();
      try {
        const other = await newPage(control); await seed(other, values); await go(other, '/daily/?subject=3');
        const directSubject3 = await currentBook(other, 3);
        // 進頁保存會增加 seq 與計時，只比較遷移的內容，不把瀏覽次數當成內容差異。
        const content = (b) => ({ id: b.id, number: b.number, createdDate: b.createdDate, attemptMode: b.attemptMode, origin: b.origin, status: b.status, position: b.position, assignedQids: b.assignedQids, questions: b.questions.map(({ ms, ...q }) => q) });
        assert.deepEqual(content(afterSubject1), content(directSubject3)); assert.equal(afterSubject1.questions.length, 49);
        assert.equal(afterSubject1.assignedQids.length, 50); assert.equal(afterSubject1.questions.some((q) => q.id === duplicate3), false);
        assert.equal((await readAttempts(page)).length, 0); assert.equal((await readAttempts(other)).length, 0);
        Object.assign(actual, { oldLists: [50, 50], migratedBooklets: 2, subject3QuestionsBothPaths: [49, 49], subject3Assigned: 50, omittedDuplicate: duplicate3, contentEqual: true, attempts: 0 });
      } finally { await closeContext(control); }
    });

    await runCase(5, '連開3本不重複且歷史回看唯讀', async (context, actual) => {
      const page = await newPage(context); await go(page); const books = [];
      for (let number = 1; number <= 3; number++) {
        await page.locator(number === 1 ? '#daily-open-first' : '#daily-open-next').click(); await page.locator('#daily-practice:not([hidden])').waitFor();
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
        await go(page, `/daily/?subject=1&book=${encodeURIComponent(finished.id)}`); await expectScore(page, 50, 50);
        assert.equal(await page.locator('#daily-readonly').isVisible(), true); assert.equal(await card(page).locator('input:disabled').count(), 4);
        const time = await page.locator('#daily-time').innerText(); await page.locator('#daily-previous').click();
        await page.clock.runFor(16_000); await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
        assert.equal(await page.locator('#daily-time').innerText(), time); assert.equal(await page.evaluate(() => window.reviewWrites.length), 0);
        assert.deepEqual(await snapshot(page), before); await reload(page); await expectScore(page, 50, 50); assert.deepEqual(await snapshot(page), before);
        reviews.push({ number: finished.number, correct: 50, total: 50, secondsAdvanced: 16, writes: 0, timerUnchanged: true, changedKeys: 0 });
      }
      Object.assign(actual, { books: 3, sizes: [50, 50, 50], answeredThroughUI: 150, pairwiseOverlap: overlaps, attempts: 150, uniqueAttemptIds: new Set((await readAttempts(page)).map((a) => a.id)).size, reviews });
      fixtures.review = { values: { [BOOK]: await readStore(page), [ATT]: { version: 1, attempts: await readAttempts(page) } }, url: `/daily/?subject=1&book=${books[0].id}`, target: '#daily-score' };
    });

    await runCase(6, '120題縮庫的第3本只有20題並用完', async (context, actual) => {
      const page = await newPage(context); const allowed = new Set(pool(1).slice(0, 120).map((q) => q.id));
      await changeCatalog(page, (items) => items.filter((q) => q.subject !== 1 || allowed.has(q.id))); await go(page);
      const books = []; const labels = [];
      for (let number = 1; number <= 3; number++) {
        const button = page.locator(number === 1 ? '#daily-open-first' : '#daily-open-next'); labels.push(await button.innerText());
        if (number === 3) assert.equal(await button.innerText(), '開下一本（20 題）');
        await button.click(); await page.locator('#daily-practice:not([hidden])').waitFor();
        const opened = await currentBook(page); assert.equal(opened.questions.length, number === 3 ? 20 : 50); books.push(opened);
        await answerThrough(page, number === 3 ? 20 : 50); await submit(page); await expectScore(page, number === 3 ? 20 : 50, number === 3 ? 20 : 50);
      }
      const overlaps = [[0, 1], [0, 2], [1, 2]].map(([a, b]) => books[a].assignedQids.filter((id) => books[b].assignedQids.includes(id)).length);
      assert.deepEqual(overlaps, [0, 0, 0]); assert.equal(await page.locator('#daily-stock').isVisible(), true);
      assert.match(await page.locator('#daily-stock').innerText(), /未做題已用完/);
      assert.equal(await page.locator('#daily-open-first:visible, #daily-open-next:visible').count(), 0);
      assert.match(await page.locator('#daily-score-points').innerText(), /不是正式考試換算/); assert.equal((await readAttempts(page)).length, 120);
      Object.assign(actual, { eligible: 120, sizes: [50, 50, 20], labels, pairwiseOverlap: overlaps, attempts: 120, visibleOpenButtons: 0 });
      fixtures.exhausted = { values: { [BOOK]: await readStore(page), [ATT]: { version: 1, attempts: await readAttempts(page) } }, allowed: [...allowed], target: '#daily-stock' };
    });

    await runCase(7, '做過同題群組成員後不抽另一題', async (context, actual) => {
      const page = await newPage(context); const q = catalog.find((q) => q.id === duplicate1);
      const attempted = { id: 'duplicate-done', qid: q.id, rev: q.rev, choice: answers.get(q.id), correct: true, ts: NOW, mode: 'quiz', ms: 1000 };
      const candidates = new Set([duplicate3, ...pool(3).slice(0, 49).map((item) => item.id)]);
      assert.equal(candidates.size, 50);
      await seed(page, { [ATT]: { version: 1, attempts: [attempted] } });
      await changeCatalog(page, (items) => items.filter((item) => item.subject !== 3 || candidates.has(item.id)));
      await go(page, '/daily/?subject=3'); assert.equal(await page.locator('#daily-open-first').innerText(), '開第 1 本（49 題）');
      await page.locator('#daily-open-first').click(); await page.locator('#daily-practice:not([hidden])').waitFor();
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
          await seed(page, { [BOOK]: { ...emptyStore(), current: { '1': b.id, '3': null }, booklets: [b] } }); await go(page);
          await armWriteFailure(page, stage); await submit(page); await page.locator('#daily-save-error:not([hidden])').waitFor();
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
      await seed(page, { [DRAFT]: { version: 1, drafts: [draft] }, [CACHE]: { version: 1, sets: [set] } }); await go(page);
      const store = await readStore(page); assert.equal(store.booklets.length, 2); assert.equal(store.booklets.filter((b) => b.status === 'open').length, 2);
      const firstId = 'v1-S1-2026-11-06-draft'; const secondId = 'v1-S1-2026-11-07-set';
      assert.equal(store.current['1'], firstId); await submit(page);
      await page.waitForURL((url) => url.searchParams.get('book') === firstId); await ready(page); await expectScore(page, 37, 50);
      assert.equal((await readStore(page)).current['1'], secondId); assert.equal(await page.locator('#daily-readonly').isVisible(), true);
      assert.equal((await readAttempts(page)).length, 50);
      await page.locator('#daily-return').click(); await ready(page);
      assert.equal(new URL(page.url()).searchParams.has('book'), false); assert.equal((await currentBook(page)).id, secondId);
      assert.equal(await page.locator('#daily-position').innerText(), '第 1／50 題'); assert.equal((await readStore(page)).booklets.length, 2);
      Object.assign(actual, { migratedOpenBooks: 2, reviewBook: firstId, currentAfterSubmit: secondId, correct: 37, total: 50, points: 74, attempts: 50, returnedBook: secondId, returnedPosition: 1, bookletsAfterReturn: 2 });
    });

    await runCase(10, '題本清單與跨日進度符合手算', async (context, actual) => {
      const page = await newPage(context); const questions = pool(1).slice(0, 180); const allowed = new Set(questions.map((q) => q.id));
      const yesterday = booklet(questions.slice(0, 50), answers, { id: 'history-yesterday', number: 1, status: 'submitted', answered: 50, correct: 40, createdDate: '2026-11-06', submittedAt: '2026-11-07T15:59:00.000Z' });
      const today = booklet(questions.slice(50, 70), answers, { id: 'history-today', number: 2, status: 'submitted', answered: 20, correct: 13, createdDate: YESTERDAY, submittedAt: '2026-11-07T16:01:00.000Z' });
      const retired = booklet(questions.slice(70, 75), answers, { id: 'history-retired', number: 3, status: 'retired', createdDate: TODAY }); retired.questions = [];
      const open = booklet(questions.slice(75, 125), answers, { id: 'history-open', number: 4, answered: 17 });
      const store = { ...emptyStore(), current: { '1': open.id, '3': null }, booklets: [yesterday, today, retired, open] };
      const attempts = [...yesterday.submission.attempts, ...today.submission.attempts];
      await seed(page, { [BOOK]: store, [ATT]: { version: 1, attempts } });
      await changeCatalog(page, (items) => items.filter((q) => q.subject !== 1 || allowed.has(q.id))); await go(page);
      await expectAnswerFocus(page);
      const metrics = async () => ({ answered: (await page.locator('#daily-metric-answered').innerText()).replace(/\s/g, ''), today: (await page.locator('#daily-metric-today').innerText()).replace(/\s/g, ''), free: (await page.locator('#daily-metric-free').innerText()).replace(/\s/g, '') });
      const before = await metrics(); assert.deepEqual(before, { answered: '17／50', today: '20題', free: '1本另1本5題' });
      assert.equal(await page.locator('#daily-progress').innerText(), '這本已答 17／50');
      await page.clock.setFixedTime(new Date(TOMORROW)); await reload(page);
      const after = await metrics(); assert.deepEqual(after, { answered: '17／50', today: '0題', free: '1本另1本5題' });
      await expectAnswerFocus(page);
      // 題本清單只在檢討畫面驗證，保留原有逐欄內容與跨日進度的斷言。
      await go(page, `/daily/?subject=1&book=${today.id}`);
      assert.equal(await page.locator('#daily-history').isVisible(), true);
      const rows = await page.locator('#daily-rows .booklet-row:not(.booklet-table-head)').evaluateAll((elements) => elements.map((row) => [...row.children].map((cell) => cell.innerText.trim().replace(/\s+/g, ' '))));
      const expectedRows = [
        ['第 4 本 2026-11-08', '作答中', '50 題', '已答 17／50', '繼續作答 →'],
        ['第 3 本 2026-11-08', '已結束', '0 題', '', ''],
        ['第 2 本 2026-11-07', '已交卷', '20 題', '答對 13／20', '回看檢討 →'],
        ['第 1 本 2026-11-06', '已交卷', '50 題', '答對 40／50', '回看檢討 →'],
      ];
      assert.deepEqual(rows, expectedRows);
      assert.match(await page.locator('#daily-history').innerText(), /題本只存在這個瀏覽器的這個網址/);
      fixtures.history = { values: { [BOOK]: await readStore(page), [ATT]: { version: 1, attempts } }, allowed: [...allowed], url: `/daily/?subject=1&book=${today.id}`, target: '#daily-history' };
      Object.assign(actual, { rows, catalog: 180, assigned: 125, freeQuestions: 55, fullBooks: 1, lastBook: 5, attempts: 70, before, nextDay: after, taipeiBoundary: ['2026-11-07T15:59:00Z', '2026-11-07T16:01:00Z'] });
    });

    await runCase(11, '空的作答中題本顯示結束操作且能結束', async (context, actual) => {
      const page = await newPage(context);
      const empty = booklet(pool(1).slice(0, 3), answers, { id: 'empty-open', number: 1 }); empty.questions = [];
      await seed(page, { [BOOK]: { ...emptyStore(), current: { '1': empty.id, '3': null }, booklets: [empty] } }); await go(page);
      const row = page.locator('#daily-rows .booklet-row:not(.booklet-table-head)');
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
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
      }
      await row.getByRole('link', { name: '前往結束題本 →' }).click(); await ready(page);
      await page.locator('#daily-retire:not([hidden])').waitFor();
      assert.equal((await currentBook(page)).status, 'open');
      await page.locator('#daily-retire-book').click(); await ready(page);
      const finished = (await readStore(page)).booklets[0];
      assert.equal(finished.status, 'retired'); assert.equal((await readStore(page)).current['1'], null);
      assert.deepEqual(finished.assignedQids, empty.assignedQids); assert.equal((await readAttempts(page)).length, 0);
      Object.assign(actual, { cells, statusBefore: 'open', statusAfter: finished.status, assigned: 3, attempts: 0 });
    });

    await runCase(12, '另一頁寫入作答後即時更新題量與舊紀錄但不寫題本', async (context, actual) => {
      const page = await newPage(context); const candidates = pool(1).slice(0, 50); const allowed = new Set(candidates.map((q) => q.id));
      await seed(page, { [BOOK]: emptyStore() });
      await changeCatalog(page, (items) => items.filter((q) => q.subject !== 1 || allowed.has(q.id))); await go(page);
      assert.equal(await page.locator('#daily-open-first').innerText(), '開第 1 本');
      assert.equal((await page.locator('#daily-metric-free').innerText()).replace(/\s/g, ''), '1本');
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
      await page.waitForFunction(() => document.getElementById('daily-open-first').textContent === '開第 1 本（49 題）');
      const after = await snapshot(page);
      assert.equal(after[BOOK], before[BOOK]);
      assert.deepEqual(Object.fromEntries(Object.entries(after).filter(([key]) => key !== ATT)), before);
      assert.equal((await page.locator('#daily-metric-free').innerText()).replace(/\s/g, ''), '0本另1本49題');
      assert.equal(await page.locator('#daily-legacy-records').isVisible(), true);
      assert.deepEqual(await page.locator('#daily-legacy-rows .booklet-legacy-row').allTextContents(), [`${TODAY}科目 1已答 1 題答對 1 題`]);
      assert.equal(page.url(), url); assert.equal(await page.evaluate(() => window.overviewLoaded), true);
      assert.deepEqual(await page.evaluate(() => window.overviewWrites), []);
      assert.equal(await page.locator('#daily-open-first').isEnabled(), true);
      assert.equal(await page.locator('#daily-save-error').isVisible(), false);
      Object.assign(actual, { initialQuestions: 50, updatedQuestions: 49, initialFullBooks: 1, updatedFullBooks: 0, legacyRecords: 1, bookletBytesUnchanged: true, writesFromDailyPage: 0, reloaded: false });
    });

    await runCase(13, '作答與重整隱藏資訊且交卷即時恢復清單', async (context, actual) => {
      const page = await newPage(context); const q = pool(1)[0];
      const legacy = { id: 'focus-legacy', qid: q.id, rev: q.rev, choice: answers.get(q.id), correct: true, ts: NOW, mode: `daily:${YESTERDAY}:S1`, ms: 1000 };
      await seed(page, { [BOOK]: emptyStore(), [ATT]: { version: 1, attempts: [legacy] } }); await go(page);
      assert.equal(await page.locator('#daily-history').isVisible(), false);
      assert.equal(await page.locator('#daily-legacy-records').isVisible(), true);
      await page.locator('#daily-open-first').click(); await page.locator('#daily-practice:visible').waitFor();
      const first = await currentBook(page); assert.equal(first.number, 1);
      await expectAnswerFocus(page);
      assert.equal(await page.locator('#daily-legacy-rows .booklet-legacy-row').count(), 1, '確實存在舊紀錄才驗證隱藏');
      const date = await page.locator('#daily-date').innerText();
      await reload(page); await expectAnswerFocus(page);
      assert.equal(await page.locator('#daily-date').innerText(), date);
      assert.equal((await currentBook(page)).id, first.id);
      await page.evaluate(() => { window.answerFocusLoaded = true; });
      await answerThrough(page, 50);
      const url = page.url();
      await submit(page); await expectScore(page, 50, 50);
      assert.equal(page.url(), url); assert.equal(await page.evaluate(() => window.answerFocusLoaded), true, '交卷後未重新載入');
      assert.equal(await page.locator('#daily-history').isVisible(), true);
      assert.equal(await page.locator('#daily-legacy-records').isVisible(), true);
      assert.equal(await page.locator('#daily-legacy-rows .booklet-legacy-row').count(), 1);
      await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
      await page.evaluate(() => document.fonts.ready);
      actual.submittedScreenshot = resolve(output, 'submitted-1440-light-full.png');
      await page.screenshot({ path: actual.submittedScreenshot, fullPage: true });
      // 另開一本後回看，確認觀看已交卷題本優先於目前題本的作答狀態。
      await page.locator('#daily-open-next').click(); await page.locator('#daily-practice:visible').waitFor();
      await expectAnswerFocus(page);
      await go(page, `/daily/?subject=1&book=${encodeURIComponent(first.id)}`); await expectScore(page, 50, 50);
      assert.equal(await page.locator('#daily-readonly').isVisible(), true);
      assert.equal(await page.locator('#daily-history').isVisible(), true);
      assert.equal(await page.locator('#daily-legacy-records').isVisible(), true);
      Object.assign(actual, { firstNumber: 1, hiddenBeforeAndAfterReload: true, legacyRecords: 1, dateUnchanged: true, submittedWithoutReload: true, reviewHistoryVisible: true, reviewLegacyVisible: true, viewingWithOpenBook: true });
    });

    // 全失效畫面另外造資料，確認「結束」保留分配紀錄且不寫作答。
    const retired = booklet(pool(1).slice(0, 3), answers, { id: 'all-invalid', number: 1 });
    retired.questions = retired.questions.map((q) => ({ ...q, rev: q.rev + 100 }));
    fixtures.retire = { values: { [BOOK]: { ...emptyStore(), current: { '1': retired.id, '3': null }, booklets: [retired] } }, target: '#daily-retire' };

    const shotStates = ['first', 'answering', 'review', 'history', 'exhausted', 'retire'];
    for (const state of shotStates) for (const width of [1440, 390, 320]) for (const theme of ['light', 'dark']) {
      const context = await newContext(); const measurement = { state, width, height: width === 1440 ? 900 : 700, theme }; report.measurements.push(measurement);
      try {
        assert.ok(fixtures[state], `${state} 的流程資料必須存在`);
        const fixture = fixtures[state]; const page = await newPage(context);
        await page.setViewportSize({ width, height: measurement.height }); await seed(page, fixture.values);
        if (fixture.allowed) { const allowed = new Set(fixture.allowed); await changeCatalog(page, (items) => items.filter((q) => q.subject !== 1 || allowed.has(q.id))); }
        await go(page, fixture.url); await page.evaluate((theme) => { document.documentElement.dataset.theme = theme; }, theme);
        await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(200);
        await page.locator(fixture.target).evaluate((element) => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
        await page.waitForTimeout(100);
        measurement.overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        // 先保存數據與圖片再斷言，即使版面失敗仍有完整證據，不用全頁圖推論固定列位置。
        if (state === 'answering') { const measured = await measureActions(page); report.actionMeasurements.push({ state, width, theme, ...measured }); }
        const file = resolve(output, `${state}-${width}-${theme}-viewport.png`);
        await page.screenshot({ path: file, fullPage: false }); report.screenshots.push({ state, width, theme, fullPage: false, file });
        if ((width === 1440 && theme === 'light') || (state === 'answering' && width === 320 && theme === 'dark')) {
          const fullFile = resolve(output, `${state}-${width}-${theme}-full.png`);
          await page.screenshot({ path: fullFile, fullPage: true }); report.screenshots.push({ state, width, theme, fullPage: true, file: fullFile });
        }
        assert.ok(measurement.overflow <= 0, `${state}/${width}/${theme} 水平溢出 ${measurement.overflow}px`);
        if (state === 'answering') assertActions(report.actionMeasurements.at(-1));
        if (state === 'retire' && width === 1440 && theme === 'light') {
          assert.equal((await readAttempts(page)).length, 0); await page.locator('#daily-retire-book').click(); await ready(page);
          const store = await readStore(page); assert.equal(store.booklets[0].status, 'retired'); assert.equal(store.current['1'], null);
          assert.equal(store.booklets[0].assignedQids.length, 3); assert.equal((await readAttempts(page)).length, 0);
          report.retireCheck = { status: 'retired', current: null, assigned: 3, attempts: 0 };
        }
        measurement.status = 'passed';
      } catch (error) { measurement.status = 'failed'; measurement.failure = String(error.stack ?? error); }
      finally { await closeContext(context); }
    }
    assert.equal(report.cases.length, 13);
    assert.equal(report.screenshots.filter((s) => !s.fullPage).length, 36, '36張目前視窗截圖');
    assert.equal(report.screenshots.filter((s) => s.fullPage).length, 7, '7張全頁截圖');
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
    report.exitCode = !report.fatal && report.summary.casesPassed === 13 && report.summary.layoutsFailed === 0 && report.summary.viewportScreenshots === 36 && report.summary.fullPageScreenshots === 7 && report.errors.length === 0 && report.requestFailures.length === 0 ? 0 : 1;
    await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = await runDailyBookletSmoke();
  console.log(JSON.stringify({ ...report.summary, exitCode: report.exitCode, report: resolve(report.output, 'report.json') }));
  process.exitCode = report.exitCode;
}
