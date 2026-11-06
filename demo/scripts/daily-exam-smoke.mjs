/** 建置產物的離線瀏覽器驗收；僅建立全新瀏覽器資料與 4333 暫時服務，結束一律關閉。 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';
import { parse } from 'yaml';
import assert from 'node:assert/strict';

const DRAFT = 'ipas-daily-draft-v1';
const ATTEMPTS = 'ipas-attempts-v1';
const date = '2026-11-05';
const instant = new Date('2026-11-05T04:00:00Z');
let hiddenChecks = 0;
const output = process.env.DAILY_EXAM_OUTPUT ?? 'D:/ipas-study/tmp/demo-shots/daily-exam-impl/';
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const dataRoot = fileURLToPath(new URL('../../content/questions/', import.meta.url));
const currentCard = (page) => page.locator('#daily-cards [data-question]:visible');
const getDraft = (page, subject = 1) => page.evaluate(({ key, subject }) => JSON.parse(localStorage.getItem(key)).drafts.find((d) => d.subject === subject), { key: DRAFT, subject });
const getAttempts = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{"attempts":[]}').attempts, ATTEMPTS);
const loadDaily = async (page, url) => { await page.goto(url); await page.locator('#daily-status').filter({ hasText: /已固定|正在續作|目前沒有可做|這份題組已沒有/ }).waitFor(); };
async function changeCatalog(page, transform) {
  await page.route('**/daily/**', async (route) => {
    const response = await route.fetch();
    const html = (await response.text()).replace(/(<script[^>]*id="daily-catalog"[^>]*>)([\s\S]*?)(<\/script>)/, (_, start, json, end) => start + JSON.stringify(transform(JSON.parse(json))) + end);
    await route.fulfill({ response, body: html });
  });
}
const assertHiddenResults = async (page) => {
  assert.equal(await page.locator('[data-explanation]:visible, .option-status:not(:empty):visible, #daily-score:visible, .is-correct:visible, .is-wrong:visible').count(), 0);
  assert.doesNotMatch(await page.locator('.daily-toolbar').innerText(), /答對|答錯|分數|答案|解析/);
  const accessible = await page.locator('.daily-exam').ariaSnapshot();
  assert.doesNotMatch(accessible, /參考答案|官方答案|為什麼 [ABCD] 正確|答對了|你的答案|其他選項的問題|已答.*答對/);
  hiddenChecks++;
};
function fixture(questions, subject, answered = 0, status = 'open') {
  const qs = questions.filter((q) => q.subject === subject && q.source === 'mock' && q.review.status === 'verified').sort((a, b) => a.id.localeCompare(b.id)).slice(0, 50);
  // 將長題與程式碼題排在前段，讓每種寬度都量到真實的長內容。
  const special = questions.find((q) => q.id === (subject === 3 ? 'M-L23102-004' : 'Z-L21101-001'));
  if (special) { const index = qs.findIndex((q) => q.id === special.id); if (index >= 0) qs.splice(index, 1); else qs.pop(); qs.unshift(special); }
  const items = qs.map((q, index) => ({ id: q.id, rev: q.rev, choice: index < answered ? status !== 'open' && index % 7 === 0 ? q.answer === 'A' ? 'B' : 'A' : q.answer : null, unsure: index < answered && index % 7 === 0, ms: 1000,
    ...(status === 'open' ? {} : { correct: index % 7 !== 0 }) }));
  const attempts = items.filter((q) => q.choice).map((q, index) => ({ id: `fixture-${subject}-${index}`, qid: q.id, rev: q.rev, choice: q.choice, correct: Boolean(q.correct), ts: instant.toISOString(), mode: `daily:${date}:S${subject}`, ms: q.ms }));
  return { id: `fixture-${subject}`, seq: 1, subject, date, status, position: answered === 50 ? 0 : answered, questions: items,
    ...(status === 'open' ? {} : { submission: { ts: instant.toISOString(), attempts, total: 50, correct: items.filter((q) => q.correct).length } }) };
}
async function seed(context, drafts, attempts = []) {
  await context.addInitScript(({ drafts, attempts }) => {
    if (location.origin !== 'http://127.0.0.1:4333') return;
    if (sessionStorage.getItem('daily-exam-fixture')) return;
    localStorage.setItem('ipas-daily-draft-v1', JSON.stringify({ version: 1, drafts }));
    localStorage.setItem('ipas-attempts-v1', JSON.stringify({ version: 1, attempts }));
    sessionStorage.setItem('daily-exam-fixture', 'seeded');
  }, { drafts, attempts });
}
async function measure(page, subject, width, theme, state) {
  // 題目標題置於固定列下方，並驗證題幹繼續捲動時兩列仍在視窗內。
  await page.locator('#daily-question-heading').evaluate((element) => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
  const result = await page.evaluate(() => {
    const box = (selector) => { const e = document.querySelector(selector); const r = e.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height, scrollWidth: e.scrollWidth, clientWidth: e.clientWidth }; };
    const paper = document.querySelector('.daily-paper'); const style = getComputedStyle(paper); const p = box('.daily-paper');
    const action = document.querySelector('.daily-actions'); const astyle = getComputedStyle(action); const a = box('.daily-actions');
    const submitted = !document.querySelector('#daily-submitted').hidden;
    const controls = ['#daily-previous', '#daily-next', '#daily-unsure'].filter((s) => !document.querySelector(s).hidden).map((s) => ({ selector: s, ...box(s) }));
    const submitElement = document.querySelector(submitted ? '#daily-submitted' : '#daily-submit'); const sr = submitElement.getBoundingClientRect();
    const submitVisible = [[sr.x + 4, sr.y + 4], [sr.right - 4, sr.y + 4], [sr.x + sr.width / 2, sr.y + sr.height / 2], [sr.x + 4, sr.bottom - 4], [sr.right - 4, sr.bottom - 4]].every(([x, y]) => { const hit = document.elementFromPoint(x, y); return Boolean(hit && (submitElement === hit || submitElement.contains(hit))); });
    return { submitVisible, toolbar: box('.daily-toolbar'), action: a, heading: box('#daily-question-heading'), submit: box(submitted ? '#daily-submitted' : '#daily-submit'), previous: box('#daily-previous'), next: box('#daily-next'), unsure: document.querySelector('#daily-unsure').hidden ? null : box('#daily-unsure'), controls,
      paperRight: p.right - parseFloat(style.paddingRight) - parseFloat(style.borderRightWidth), actionLeft: a.left + parseFloat(astyle.paddingLeft) + parseFloat(astyle.borderLeftWidth), actionRight: a.right - parseFloat(astyle.paddingRight) - parseFloat(astyle.borderRightWidth), overflow: document.documentElement.scrollWidth - innerWidth, height: innerHeight };
  });
  assert.ok(Math.abs(result.submit.right - result.paperRight) <= 2, `submit edge ${JSON.stringify({ subject, width, theme, state, result })}`);
  assert.ok(result.submit.top < result.heading.top, '交卷位於題幹上方');
  assert.equal(result.submitVisible, true, '頁首沒有遮住交卷');
  assert.ok(Math.abs(result.previous.left - result.actionLeft) <= 2, '上一題左緣');
  assert.ok(Math.abs(result.next.right - result.actionRight) <= 2, '下一題右緣');
  assert.ok(Math.max(...result.controls.map((r) => r.top)) - Math.min(...result.controls.map((r) => r.top)) <= 1, '按鈕上緣');
  for (const control of result.controls) assert.ok(control.scrollWidth <= control.clientWidth, `${control.selector} 文字完整`);
  if (result.unsure) assert.ok(result.next.left - result.unsure.right >= 0 && result.next.left - result.unsure.right <= 16, '不確定間距');
  assert.ok(result.overflow <= 0, `水平溢出 ${result.overflow}`);
  assert.ok(result.heading.top >= result.toolbar.bottom - 1, '固定列沒有遮住標題');
  assert.ok(result.action.bottom <= result.height + 1 && result.toolbar.top >= -1, '兩條固定列在視窗內');
  if (width === 320) assert.ok(result.action.top - result.toolbar.bottom >= 500, `讀題空間 ${result.action.top - result.toolbar.bottom}`);
  await page.mouse.wheel(0, 180);
  await page.waitForTimeout(150);
  const scrolling = await page.locator('.daily-toolbar').boundingBox();
  assert.ok(scrolling.y >= -1, '長題目捲動後仍看得到交卷');
  return { subject, width, theme, state, ...result, readingSpace: result.action.top - result.toolbar.bottom };
}

export async function runDailyExamSmoke() {
  hiddenChecks = 0;
  await mkdir(output, { recursive: true });
  const questions = await Promise.all((await readdir(dataRoot, { recursive: true })).filter((name) => name.endsWith('.yaml')).map(async (name) => parse(await readFile(resolve(dataRoot, name), 'utf8'))));
  const revisions = await readFile(new URL('../src/data/revisions.json', import.meta.url), 'utf8');
  const attemptsSource = (await readFile(new URL('../src/lib/attempts.ts', import.meta.url), 'utf8')).replace(/import revisionIndex from .*?;/, `const revisionIndex = ${revisions};`);
  const testModule = transpileModule(attemptsSource, { compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2022 } }).outputText;
  const report = { cases: [], measurements: [], dialogs: [], screenshots: [], errors: [], faults: [], instantSaves: [] };
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (pathname === '/__test/attempts.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(testModule); return; }
      const file = resolve(dist, `.${pathname.endsWith('/') ? pathname + 'index.html' : pathname}`);
      if (!file.startsWith(resolve(dist) + sep)) { response.writeHead(403).end(); return; }
      response.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream'); response.end(await readFile(file));
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((done, reject) => { server.once('error', reject); server.listen(4333, '127.0.0.1', done); });
  const base = 'http://127.0.0.1:4333'; let browser;
  const screenshot = async (page, name) => {
    if (await page.locator('#daily-practice:visible').count() && !(await page.locator('#daily-dialog[open]').count())) {
      const selector = name.endsWith('submitted') ? '#daily-score' : '#daily-question-heading';
      await page.locator(selector).evaluate((e) => e.scrollIntoView({ block: 'start', behavior: 'instant' }));
    }
    await page.waitForTimeout(100);
    const file = resolve(output, `${name}.png`); await page.screenshot({ path: file, fullPage: false }); report.screenshots.push(file);
  };
  const checkDialog = async (page) => {
    const box = await page.locator('#daily-dialog').boundingBox(); const viewport = page.viewportSize();
    const dx = Math.abs(box.x + box.width / 2 - viewport.width / 2); const dy = Math.abs(box.y + box.height / 2 - viewport.height / 2);
    assert.ok(dx <= 1 && dy <= 1, `確認視窗置中 ${dx},${dy}`);
    report.dialogs.push({ width: viewport.width, ...box, centerDeltaX: dx, centerDeltaY: dy });
  };
  const context = async (options = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'America/Los_Angeles', ...options });
    await ctx.route('**/*', (route) => route.request().url().startsWith(base + '/') ? route.continue() : route.abort());
    ctx.on('page', (p) => p.on('pageerror', (error) => report.errors.push(String(error)))); return ctx;
  };
  try {
    browser = await chromium.launch({ headless: true, channel: 'chrome' }); report.browser = browser.version();
    // 真實逐題操作、Enter、取消交卷、改答與關閉後重開。
    {
      const ctx = await context(); const page = await ctx.newPage(); await page.clock.install({ time: instant });
      await loadDaily(page, base + '/daily/?subject=1&position=50');
      assert.equal(await page.locator('#daily-position').innerText(), '第 1／50 題');
      assert.equal(await page.locator('#daily-next').isDisabled(), true); assert.equal(await page.locator('#daily-unsure').isDisabled(), true); assert.equal(await page.locator('#daily-submit').isDisabled(), true);
      assert.equal(await page.locator('#daily-numbers button').count(), 1); await assertHiddenResults(page);
      assert.equal(await page.locator('#daily-cards .answer-actions').count(), 0);
      assert.equal(await page.getByText('每題確認作答後，立即顯示解析。', { exact: true }).count(), 0);
      await page.keyboard.press('Enter'); await assertHiddenResults(page); assert.equal((await getAttempts(page)).length, 0);
      const card = currentCard(page); await card.locator('input[value="A"]').check(); await page.keyboard.press('Enter'); await assertHiddenResults(page);
      assert.equal(await page.locator('#daily-numbers button').count(), 2);
      await page.locator('#daily-unsure').click(); assert.equal(await page.locator('#daily-unsure').getAttribute('aria-pressed'), 'true');
      await card.locator('input[value="B"]').check(); await page.locator('#daily-next').click();
      assert.equal(await page.locator('#daily-position').innerText(), '第 2／50 題');
      assert.equal(await page.locator('#daily-question-heading').evaluate((e) => document.activeElement === e), true);
      await page.clock.runFor(5100); await page.reload(); await page.locator('#daily-position').filter({ hasText: '第 2／50' }).waitFor();
      const saved = await getDraft(page); assert.equal(saved.questions[0].choice, 'B'); assert.equal(saved.questions[0].unsure, true);
      assert.ok(saved.questions.reduce((sum, q) => sum + q.ms, 0) >= 5000);
      const beforeClose = saved.questions.reduce((sum, q) => sum + q.ms, 0); await page.close();
      const reopened = await ctx.newPage(); await reopened.clock.install({ time: instant }); await loadDaily(reopened, base + '/daily/?subject=1');
      assert.equal(await reopened.locator('#daily-position').innerText(), '第 2／50 題'); assert.ok((await getDraft(reopened)).questions.reduce((sum, q) => sum + q.ms, 0) >= beforeClose);
      await reopened.locator('#daily-previous').click(); assert.equal(await currentCard(reopened).locator('input[value="B"]').isChecked(), true);
      const rawBefore = await reopened.evaluate(() => localStorage.getItem('ipas-attempts-v1'));
      const backup = await reopened.evaluate(async () => (await import('/__test/attempts.js')).exportAttempts());
      assert.equal(JSON.parse(backup).attempts.length, 0); assert.deepEqual(Object.keys(JSON.parse(backup)).sort(), ['attempts', 'readings', 'version']);
      assert.equal(await reopened.evaluate(() => localStorage.getItem('ipas-attempts-v1')), rawBefore);
      await reopened.goto(base + '/wrong-book/'); assert.equal(await reopened.locator('#wrong-count').innerText(), '0 題');
      await reopened.goBack(); await reopened.locator('#daily-position').filter({ hasText: '第 1／50' }).waitFor(); await assertHiddenResults(reopened);
      report.cases.push({ name: 'sequential-enter-edit-reopen-backup-back', attemptsBeforeSubmission: 0, elapsedPersistedMs: beforeClose }); await ctx.close();
    }
    // 逐題實際完成少量題組，確認、分數、固定 ID 與鎖定。
    {
      const ctx = await context(); const d = fixture(questions, 3); d.questions = d.questions.slice(0, 3); d.position = 0; await seed(ctx, [d]);
      const page = await ctx.newPage(); await page.clock.install({ time: instant }); await loadDaily(page, base + '/daily/?subject=3');
      for (let i = 0; i < 3; i++) { await currentCard(page).locator('input[value="A"]').check(); if (i === 0) await page.locator('#daily-unsure').click(); if (i < 2) await page.locator('#daily-next').click(); }
      assert.equal(await page.locator('#daily-submit').isEnabled(), true); assert.equal((await getAttempts(page)).length, 0);
      await page.locator('#daily-submit').click(); assert.equal(await page.locator('#daily-cancel').evaluate((e) => document.activeElement === e), true);
      await checkDialog(page);
      assert.match(await page.locator('#daily-dialog-count').innerText(), /不確定 1 題/); await page.locator('#daily-cancel').click();
      assert.equal(await page.locator('#daily-submit').evaluate((e) => document.activeElement === e), true); await assertHiddenResults(page);
      await page.locator('#daily-submit').click(); await page.locator('#daily-confirm').click(); await page.locator('#daily-score').waitFor();
      const attempts = await getAttempts(page); assert.equal(attempts.length, 3); assert.equal(await currentCard(page).locator('input:enabled').count(), 0);
      const expectedCorrect = d.questions.filter((item) => questions.find((q) => q.id === item.id).answer === 'A').length;
      assert.equal(await page.locator('#daily-score-heading').innerText(), `答對 ${expectedCorrect}／3 題`);
      assert.ok((await page.locator('#daily-score-points').innerText()).startsWith(`${expectedCorrect * 2} 分／6 分`));
      assert.match(await page.locator('#daily-score-points').innerText(), /不是正式考試換算/);
      assert.equal(await page.locator('#daily-score').evaluate((e) => document.activeElement === e), true);
      const time = await page.locator('#daily-time').innerText(); await page.clock.runFor(20000); assert.equal(await page.locator('#daily-time').innerText(), time);
      await page.reload(); await page.locator('#daily-score').waitFor(); assert.deepEqual(await getAttempts(page), attempts);
      await page.locator('#daily-previous').click(); await page.locator('#daily-previous').click(); assert.equal(await page.locator('#daily-unsure').innerText(), '已標不確定');
      report.cases.push({ name: 'small-set-submit-cancel-review-reload', added: attempts.length, correct: (await getDraft(page, 3)).submission.correct, total: 3, ids: attempts.map((a) => a.id), stoppedTime: time }); await ctx.close();
    }
    // 每一步實際 setItem 故障：解析須等結案成功後才出現。
    for (const step of [1, 2, 3]) {
      const ctx = await context(); const d = fixture(questions, 1, 50); await seed(ctx, [d]); const page = await ctx.newPage(); await page.clock.install({ time: instant }); await loadDaily(page, base + '/daily/');
      await page.evaluate((step) => {
        const original = Storage.prototype.setItem; let writes = 0;
        window.dailyGeneratedIds = []; const uuid = crypto.randomUUID.bind(crypto); crypto.randomUUID = () => { const id = uuid(); window.dailyGeneratedIds.push(id); return id; };
        Storage.prototype.setItem = function(key, value) { if (key === 'ipas-daily-draft-v1' || key === 'ipas-attempts-v1') { writes++; if (writes === step) throw new Error('test quota'); } return original.call(this, key, value); };
      }, step);
      await page.locator('#daily-submit').click(); await page.locator('#daily-confirm').click(); await page.locator('#daily-save-error').waitFor(); await assertHiddenResults(page);
      const failedPosition = await page.locator('#daily-position').innerText();
      assert.equal(await page.locator('#daily-next').isDisabled(), true); assert.equal(await page.locator('#daily-numbers button:enabled').count(), 0);
      await page.locator('#daily-next').evaluate((button) => button.click()); assert.equal(await page.locator('#daily-position').innerText(), failedPosition);
      const before = await getAttempts(page); assert.equal(before.length, step === 3 ? 50 : 0);
      const pending = await getDraft(page); const fixedIds = pending.submission?.attempts.map((a) => a.id);
      await page.locator('#daily-retry').click(); await page.locator('#daily-score').waitFor(); const after = await getAttempts(page); assert.equal(after.length, 50); assert.equal(new Set(after.map((a) => a.id)).size, 50);
      assert.deepEqual(await page.evaluate(() => window.dailyGeneratedIds), after.map((a) => a.id));
      if (fixedIds) assert.deepEqual(after.map((a) => a.id), fixedIds);
      await page.reload(); await page.locator('#daily-score').waitFor(); assert.deepEqual(await getAttempts(page), after);
      report.faults.push({ step, before: before.length, after: after.length, idsStable: true }); await ctx.close();
    }
    // 還原 submitting 時自動重試，已寫與未寫作答鍵都保持原 ID。
    for (const alreadyWritten of [false, true]) {
      const ctx = await context(); const d = fixture(questions, 1, 50, 'submitting'); await seed(ctx, [d], alreadyWritten ? d.submission.attempts : []);
      const page = await ctx.newPage(); await page.clock.install({ time: instant }); await loadDaily(page, base + '/daily/'); await page.locator('#daily-score').waitFor();
      assert.equal((await getDraft(page)).status, 'submitted'); assert.equal((await getAttempts(page)).length, 50); assert.deepEqual((await getAttempts(page)).map((a) => a.id), d.submission.attempts.map((a) => a.id));
      report.cases.push({ name: 'submitting-auto-retry', alreadyWritten, count: 50, idsStable: true }); await ctx.close();
    }
    // 跨日保留兩科，交卷後才可開今日；背景時間不計入。
    {
      const ctx = await context(); const page = await ctx.newPage(); await page.clock.install({ time: instant }); await loadDaily(page, base + '/daily/'); await currentCard(page).locator('input[value="B"]').check(); await page.locator('#daily-unsure').click();
      const one = await getDraft(page); await page.clock.setSystemTime(new Date('2026-11-06T04:00:00Z')); await page.reload(); await page.locator('#daily-status').filter({ hasText: '正在續作 2026-11-05' }).waitFor();
      assert.equal(await page.locator('#daily-today').isVisible(), false); assert.equal((await getDraft(page)).id, one.id);
      await page.locator('[data-daily-subject="3"]').click(); await page.locator('#daily-date').filter({ hasText: '科目 3' }).waitFor();
      const three = await getDraft(page, 3); assert.equal(three.date, '2026-11-06');
      await page.locator('[data-daily-subject="1"]').click(); await page.locator('#daily-date').filter({ hasText: '科目 1' }).waitFor(); assert.equal((await getDraft(page)).id, one.id); assert.equal((await getDraft(page)).questions[0].choice, 'B');
      await page.evaluate(() => { const root = JSON.parse(localStorage.getItem('ipas-daily-draft-v1')); const draft = root.drafts.find((d) => d.subject === 1); draft.seq++; draft.questions.forEach((q) => { q.choice ??= 'A'; }); localStorage.setItem('ipas-daily-draft-v1', JSON.stringify(root)); });
      await page.reload(); await page.locator('#daily-submit:enabled').waitFor(); await page.locator('#daily-submit').click(); await page.locator('#daily-confirm').click(); await page.locator('#daily-score').waitFor();
      await page.locator('#daily-today').click(); await page.locator('#daily-date').filter({ hasText: '2026-11-06' }).waitFor(); assert.notEqual((await getDraft(page)).id, one.id); assert.equal((await getDraft(page, 3)).id, three.id);
      report.cases.push({ name: 'cross-day-subject-explicit-today', dates: [one.date, three.date], subject3Preserved: true }); await ctx.close();
    }
    // 多頁競爭、匯入不掃描、清除後拒絕舊頁續寫，包括清除後同 seq 新建。
    {
      const ctx = await context(); const first = await ctx.newPage(); await loadDaily(first, base + '/daily/'); const second = await ctx.newPage(); await loadDaily(second, base + '/daily/');
      await currentCard(second).locator('input[value="A"]').check(); await first.locator('#daily-error-message').filter({ hasText: '唯讀' }).waitFor();
      assert.equal(await currentCard(first).locator('input:enabled').count(), 0);
      const d = await getDraft(second); const legacy = { id: 'imported', qid: d.questions[1].id, rev: d.questions[1].rev, choice: 'B', correct: true, ts: instant.toISOString(), mode: `daily:${d.date}:S1`, ms: 9 };
      const backupPage = await ctx.newPage(); await backupPage.goto(base + '/wrong-book/'); await backupPage.locator('#import-attempts').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, attempts: [legacy] })) });
      await backupPage.locator('#import-status').filter({ hasText: '新增' }).waitFor();
      const exported = await backupPage.evaluate(async () => (await import('/__test/attempts.js')).exportAttempts());
      await second.locator('#daily-next').click(); assert.equal(await currentCard(second).locator('input:enabled').count(), 4); await currentCard(second).locator('input[value="C"]').check();
      assert.equal((await getDraft(second)).questions[1].legacyAttemptId, undefined);
      await backupPage.evaluate(async () => (await import('/__test/attempts.js')).clearStudyData()); await second.locator('#daily-error-message').filter({ hasText: '唯讀' }).waitFor();
      assert.equal(await second.evaluate(() => localStorage.getItem('ipas-daily-draft-v1')), null);
      const third = await ctx.newPage(); await loadDaily(third, base + '/daily/'); const replacement = await getDraft(third); assert.notEqual(replacement.id, d.id);
      await second.evaluate(() => document.querySelector('#daily-unsure').click()); assert.equal((await getDraft(third)).id, replacement.id); assert.equal((await getDraft(third)).questions.filter((q) => q.choice).length, 0);
      await backupPage.locator('#import-status').evaluate((e) => { e.textContent = ''; });
      await backupPage.locator('#import-attempts').setInputFiles({ name: 'restored.json', mimeType: 'application/json', buffer: Buffer.from(exported) });
      await backupPage.locator('#import-status').filter({ hasText: '新增' }).waitFor(); assert.equal((await getAttempts(backupPage)).length, 1);
      assert.equal((await getDraft(third)).id, replacement.id); assert.equal((await getDraft(third)).questions.filter((q) => q.choice).length, 0);
      report.cases.push({ name: 'two-tabs-import-clear-recreate', staleReadOnly: true, importedLegacyLocked: false, replacementProtected: true }); await ctx.close();
    }
    // 草稿儲存失敗保留畫面；背景停表與恢復只計可見區段。
    {
      const ctx = await context(); const page = await ctx.newPage(); await page.clock.install({ time: instant }); await loadDaily(page, base + '/daily/');
      await page.evaluate(() => { const original = Storage.prototype.setItem; window.restoreDailyStorage = () => { Storage.prototype.setItem = original; }; Storage.prototype.setItem = function(key, raw) { if (key === 'ipas-daily-draft-v1') throw new Error('test quota'); return original.call(this, key, raw); }; });
      await currentCard(page).locator('input[value="D"]').check(); await page.locator('#daily-save-error').waitFor();
      assert.equal(await currentCard(page).locator('input[value="D"]').isChecked(), true); assert.equal((await getDraft(page)).questions[0].choice, null);
      await assertHiddenResults(page); assert.equal((await getAttempts(page)).length, 0);
      await page.evaluate(() => window.restoreDailyStorage()); await page.locator('#daily-retry').click(); assert.equal((await getDraft(page)).questions[0].choice, 'D');
      await page.clock.runFor(2000);
      await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
      const before = (await getDraft(page)).questions.reduce((sum, q) => sum + q.ms, 0); await page.clock.runFor(60000);
      await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
      assert.equal((await getDraft(page)).questions.reduce((sum, q) => sum + q.ms, 0), before);
      await page.clock.runFor(30000); const after = (await getDraft(page)).questions.reduce((sum, q) => sum + q.ms, 0); assert.ok(after - before >= 15000 && after - before <= 31000);
      const live = await page.locator('#daily-time').innerText(); const parts = live.match(/(\d+):(\d+)$/); const shown = (Number(parts[1]) * 60 + Number(parts[2])) * 1000;
      assert.ok(shown - after <= 15000, `定期保存誤差 ${shown - after}ms`);
      report.cases.push({ name: 'save-failure-background-15s', recoveredChoice: 'D', backgroundAddedMs: 0, visibleAddedMs: after - before, saveLagMs: Math.max(0, shown - after), visibility: 'browser visibilitychange event with simulated hidden state' }); await ctx.close();
    }
    // 不依賴 storage 通知：舊頁在通知被延後時也會在寫入前被拒絕。
    {
      const ctx = await context(); const first = await ctx.newPage();
      await first.addInitScript(() => window.addEventListener('storage', (event) => event.stopImmediatePropagation()));
      await loadDaily(first, base + '/daily/'); const second = await ctx.newPage(); await loadDaily(second, base + '/daily/');
      const latest = await getDraft(second); await currentCard(first).locator('input[value="A"]').check(); await first.locator('#daily-error-message').filter({ hasText: '唯讀' }).waitFor();
      assert.deepEqual(await getDraft(second), latest); report.cases.push({ name: 'conflict-without-storage-event', rejectedBeforeWrite: true }); await ctx.close();
    }
    // 損壞與未知版本不覆寫、不抽新題；交卷前改版略過，檢討時保持分數。
    for (const raw of ['{', '{"version":9,"drafts":[]}']) {
      const ctx = await context(); await ctx.addInitScript((raw) => { if (location.origin === 'http://127.0.0.1:4333') localStorage.setItem('ipas-daily-draft-v1', raw); }, raw); const page = await ctx.newPage();
      await page.goto(base + '/daily/'); await page.locator('#daily-status').filter({ hasText: '保留原資料' }).waitFor(); assert.equal(await page.evaluate(() => localStorage.getItem('ipas-daily-draft-v1')), raw);
      assert.equal(await page.locator('#daily-practice').isVisible(), false); report.cases.push({ name: 'corrupt-draft-preserved', raw }); await ctx.close();
    }
    for (const submitted of [false, true]) {
      const ctx = await context(); const d = fixture(questions, 1, submitted ? 50 : 0, submitted ? 'submitted' : 'open');
      await seed(ctx, [d], d.submission?.attempts ?? []); const page = await ctx.newPage();
      await page.route('**/daily/**', async (route) => {
        const response = await route.fetch(); let html = await response.text();
        html = html.replace(/(<script[^>]*id="daily-catalog"[^>]*>)([\s\S]*?)(<\/script>)/, (_, start, json, end) => start + JSON.stringify(JSON.parse(json).map((q) => q.id === d.questions[0].id ? { ...q, rev: q.rev + 1 } : q)) + end);
        await route.fulfill({ response, body: html });
      });
      await loadDaily(page, base + '/daily/');
      if (submitted) { assert.equal((await getDraft(page)).submission.total, 50); assert.equal(await page.locator('#daily-score-heading').innerText(), `答對 ${d.submission.correct}／50 題`); assert.equal(await page.locator('.daily-unavailable:visible').count(), 1); }
      else { assert.equal((await getDraft(page)).questions.length, 49); await assertHiddenResults(page); assert.match(await page.locator('#daily-status').innerText(), /1 題已移除或改版/); }
      report.cases.push({ name: submitted ? 'review-revision-score-fixed' : 'open-revision-skip-no-refill', total: submitted ? 50 : 49, ...(submitted ? { correct: d.submission.correct } : {}) }); await ctx.close();
    }
    for (const status of ['open', 'submitted']) {
      const ctx = await context(); const d = fixture(questions, 1, status === 'submitted' ? 50 : 0, status); await seed(ctx, [d]);
      await ctx.addInitScript(() => { if (location.origin === 'http://127.0.0.1:4333') localStorage.setItem('ipas-attempts-v1', '{"version":9,"attempts":[]}'); });
      const page = await ctx.newPage(); await page.clock.install({ time: instant }); await loadDaily(page, base + '/daily/');
      assert.equal((await getDraft(page)).id, d.id); assert.match(await page.locator('#daily-remaining').innerText(), /無法更新剩餘題數/);
      if (status === 'submitted') await page.locator('#daily-score').waitFor();
      else { await currentCard(page).locator('input[value="D"]').check(); assert.equal((await getDraft(page)).questions[0].choice, 'D'); await assertHiddenResults(page); }
      assert.equal(await page.evaluate(() => localStorage.getItem('ipas-attempts-v1')), '{"version":9,"attempts":[]}');
      report.cases.push({ name: 'restore-only-from-draft', status, attemptsPreserved: true }); await ctx.close();
    }
    {
      const ctx = await context(); await ctx.addInitScript(() => { if (location.origin === 'http://127.0.0.1:4333') localStorage.setItem('ipas-daily-v1', JSON.stringify({ version: 1, sets: [{ date: '2026-11-01', subject: 1, questions: [{ id: 'old-missing', rev: 1 }] }] })); });
      const page = await ctx.newPage(); await page.clock.install({ time: instant }); await loadDaily(page, base + '/daily/'); const draft = await getDraft(page);
      assert.equal(draft.date, date); assert.equal(draft.questions.length, 50); report.cases.push({ name: 'old-cache-without-draft-starts-today', total: 50 }); await ctx.close();
    }
    {
      const ctx = await context(); const page = await ctx.newPage(); await page.clock.install({ time: instant });
      let empty = true; await changeCatalog(page, (catalog) => empty ? catalog.filter((q) => q.subject !== 1 || q.source !== 'mock') : catalog);
      await loadDaily(page, base + '/daily/');
      assert.equal(await page.locator('#daily-practice').isVisible(), false); assert.equal(await page.locator('#daily-submit:visible').count(), 0); assert.equal((await getAttempts(page)).length, 0);
      assert.match(await page.locator('#daily-status').innerText(), /目前沒有可做的題目/);
      await page.clock.runFor(16000); await page.reload(); await page.locator('#daily-status').filter({ hasText: '目前沒有可做' }).waitFor();
      assert.equal(await page.evaluate((key) => localStorage.getItem(key), DRAFT), null);
      report.cases.push({ name: 'zero-questions-no-submission', total: 0, draftCreated: false });
      empty = false; await page.clock.setFixedTime(new Date('2026-11-06T04:00:00Z')); await loadDaily(page, base + '/daily/?subject=1');
      const restored = await getDraft(page); assert.equal(restored.date, '2026-11-06'); assert.equal(restored.subject, 1); assert.equal(restored.questions.length, 50);
      assert.equal((await getAttempts(page)).length, 0); assert.equal(await page.locator('#daily-practice').isVisible(), true);
      report.cases.push({ name: 'zero-candidates-next-day-recovery', date: restored.date, total: 50, added: 0 }); await ctx.close();
    }
    // 舊版已保存的空草稿與空快取，重載時都不能阻擋今日抽題。
    {
      const ctx = await context(); const d = fixture(questions, 1); d.questions = []; d.position = 0; await seed(ctx, [d]);
      await ctx.addInitScript(() => { if (location.origin === 'http://127.0.0.1:4333' && !sessionStorage.getItem('empty-cache')) { localStorage.setItem('ipas-daily-v1', JSON.stringify({ version: 1, sets: [{ date: '2026-11-05', subject: 1, questions: [] }] })); sessionStorage.setItem('empty-cache', '1'); } });
      const page = await ctx.newPage(); await page.clock.install({ time: instant }); await loadDaily(page, base + '/daily/');
      const restored = await getDraft(page); assert.notEqual(restored.id, d.id); assert.equal(restored.date, date); assert.equal(restored.questions.length, 50); assert.ok(restored.seq > d.seq);
      await page.reload(); await page.locator('#daily-position').filter({ hasText: '第 1／50' }).waitFor(); assert.equal((await getDraft(page)).id, restored.id);
      assert.equal((await getAttempts(page)).length, 0); report.cases.push({ name: 'existing-empty-draft-reload-recovery', total: 50, added: 0 }); await ctx.close();
    }
    for (const invalid of ['removed', 'revision']) {
      const ctx = await context(); const d = fixture(questions, 1); await seed(ctx, [d]); const page = await ctx.newPage(); await page.clock.install({ time: instant });
      const ids = new Set(d.questions.map((q) => q.id));
      await changeCatalog(page, (catalog) => invalid === 'removed' ? catalog.filter((q) => !ids.has(q.id)) : catalog.map((q) => ids.has(q.id) ? { ...q, rev: q.rev + 1 } : q));
      await loadDaily(page, base + '/daily/'); const raw = await page.evaluate((key) => localStorage.getItem(key), DRAFT);
      assert.deepEqual(await getDraft(page), d); assert.match(await page.locator('#daily-today-note').innerText(), /這份題組已沒有可作答的題目/);
      assert.equal(await page.locator('#daily-submit').isDisabled(), true); assert.equal(await page.locator('#daily-today').isEnabled(), true);
      await page.locator('#daily-submit').evaluate((button) => button.click()); assert.equal(await page.locator('#daily-dialog[open]').count(), 0);
      await page.clock.runFor(16000); await page.reload(); await page.locator('#daily-today:visible').waitFor();
      assert.equal(await page.evaluate((key) => localStorage.getItem(key), DRAFT), raw); assert.equal((await getAttempts(page)).length, 0);
      await screenshot(page, `all-${invalid}-before-replacement`); await page.locator('#daily-today').click(); await page.waitForURL(base + '/daily/?subject=1'); await page.locator('#daily-position').filter({ hasText: '第 1／50' }).waitFor();
      const replaced = await getDraft(page); assert.notEqual(replaced.id, d.id); assert.equal(replaced.date, date); assert.equal(replaced.questions.length, 50);
      for (const q of replaced.questions) if (ids.has(q.id)) { assert.equal(invalid, 'revision'); assert.equal(q.rev, d.questions.find((old) => old.id === q.id).rev + 1); }
      assert.equal((await getAttempts(page)).length, 0); report.cases.push({ name: 'all-invalid-explicit-replacement', invalid, beforeUnchanged: true, total: 50, added: 0 }); await ctx.close();
    }
    // 阻擋 storage 通知，驗證失效草稿的今日入口仍比對 id 與 seq。
    for (const field of ['id', 'seq']) {
      const ctx = await context(); const d = fixture(questions, 1); await seed(ctx, [d]); const page = await ctx.newPage(); await page.clock.install({ time: instant });
      const ids = new Set(d.questions.map((q) => q.id)); await changeCatalog(page, (catalog) => catalog.filter((q) => !ids.has(q.id)));
      await loadDaily(page, base + '/daily/');
      const latest = await page.evaluate(({ key, field }) => { const value = JSON.parse(localStorage.getItem(key)); if (field === 'seq') value.drafts[0].seq++; else value.drafts[0].id = 'replacement-id'; const raw = JSON.stringify(value); localStorage.setItem(key, raw); return raw; }, { key: DRAFT, field });
      await page.locator('#daily-today').click(); await page.locator('#daily-error-message').filter({ hasText: '唯讀' }).waitFor();
      assert.equal(await page.evaluate((key) => localStorage.getItem(key), DRAFT), latest); assert.equal((await getAttempts(page)).length, 0);
      report.cases.push({ name: 'all-invalid-today-conflict', field, replacementProtected: true }); await ctx.close();
    }
    // 2 科 × 4 寬度 × 3 狀態 × 亮暗色，逐一量核可版面的全部門檻。
    for (const subject of [1, 3]) for (const width of [320, 375, 390, 1440]) for (const theme of ['light', 'dark']) for (const state of ['before', 'complete', 'submitted']) {
      const ctx = await context({ viewport: { width, height: width === 320 ? 700 : 1000 }, colorScheme: theme });
      const d = fixture(questions, subject, state === 'before' ? 31 : 50, state === 'submitted' ? 'submitted' : 'open'); await seed(ctx, [d], d.submission?.attempts ?? []);
      const page = await ctx.newPage(); await page.clock.install({ time: instant }); await loadDaily(page, `${base}/daily/?subject=${subject}`);
      await page.evaluate((theme) => { document.documentElement.dataset.theme = theme; }, theme);
      report.measurements.push(await measure(page, subject, width, theme, state));
      if (state !== 'submitted') await assertHiddenResults(page);
      assert.equal(await page.locator('#daily-numbers button').count(), state === 'before' ? 32 : 50);
      assert.ok((await page.locator('#daily-numbers button').allTextContents()).every((value) => /^\d+$/.test(value)));
      if ([390, 1440].includes(width) && subject === 3 && theme === 'light') {
        await screenshot(page, `${width}-${state}`);
        if (state === 'submitted') {
          const explanation = currentCard(page).locator('[data-explanation]');
          await explanation.evaluate((e) => window.scrollTo({ top: e.getBoundingClientRect().top + scrollY - 128, behavior: 'instant' }));
          const file = resolve(output, `${width}-review.png`); await page.screenshot({ path: file }); report.screenshots.push(file);
        }
        if (state === 'complete') { await page.locator('#daily-submit').click(); await checkDialog(page); await screenshot(page, `${width}-dialog`); await page.locator('#daily-cancel').click(); }
      }
      if (width === 390 && theme === 'dark' && state === 'before' && subject === 3) await screenshot(page, '390-dark');
      if (width === 320 && subject === 3 && state === 'complete' && theme === 'light') { await screenshot(page, '320-code'); }
      await ctx.close();
    }
    // 長題目、行內程式碼及鍵盤開關手機選單。
    {
      const ctx = await context({ viewport: { width: 320, height: 700 } }); const d = fixture(questions, 3, 50); const long = questions.find((q) => q.id === 'Z-L23302-004');
      d.questions[0] = { id: long.id, rev: long.rev, choice: 'A', unsure: false, ms: 0 }; await seed(ctx, [d]); const page = await ctx.newPage(); await page.clock.install({ time: instant }); await loadDaily(page, base + '/daily/?subject=3');
      await measure(page, 3, 320, 'light', 'long'); await screenshot(page, '320-long');
      const summary = page.locator('#daily-panel summary'); await summary.focus(); await page.keyboard.press('Enter'); await page.waitForFunction(() => document.querySelector('#daily-panel summary').getAttribute('aria-expanded') === 'true');
      await page.locator('#daily-next').click(); await page.locator('#daily-previous').focus(); await page.keyboard.press('Tab'); assert.equal(await page.locator('#daily-unsure').evaluate((e) => document.activeElement === e), true); await page.keyboard.press('Tab'); assert.equal(await page.locator('#daily-next').evaluate((e) => document.activeElement === e), true);
      report.cases.push({ name: 'long-code-keyboard-mobile', width: 320, overflow: 0 }); await ctx.close();
    }
    // 不連續舊作答只掃描一次，鎖定原答案但可標不確定。
    {
      const ctx = await context(); const page = await ctx.newPage(); await page.clock.install({ time: instant }); await loadDaily(page, base + '/daily/'); const original = await getDraft(page);
      const old = [0, 1, 4].map((i) => ({ id: `legacy-${i}`, qid: original.questions[i].id, rev: original.questions[i].rev, choice: 'A', correct: i !== 4, ts: instant.toISOString(), mode: `daily:${date}:S1`, ms: 500 }));
      await page.evaluate(({ old }) => { localStorage.removeItem('ipas-daily-draft-v1'); localStorage.setItem('ipas-attempts-v1', JSON.stringify({ version: 1, attempts: old })); }, { old });
      await page.goto(base + '/daily/?position=3'); await page.locator('#daily-legacy').waitFor(); assert.equal(await page.locator('#daily-numbers button').count(), 4);
      await page.locator('#daily-previous').click(); assert.equal(await currentCard(page).locator('input:enabled').count(), 0); await page.locator('#daily-unsure').click(); await assertHiddenResults(page);
      const migrated = await getDraft(page); assert.equal(migrated.questions[0].legacyAttemptId, 'legacy-0'); assert.deepEqual(await getAttempts(page), old);
      await page.goto(base + '/daily/?position=5'); await page.locator('#daily-position').filter({ hasText: '第 5／50' }).waitFor();
      await page.locator('#daily-next').click(); assert.equal(await page.locator('#daily-position').innerText(), '第 3／50 題');
      const panel = page.locator('#daily-panel'); if (!(await panel.getAttribute('open'))) await panel.evaluate((e) => { e.open = true; });
      await page.locator('#daily-numbers button').filter({ hasText: /^5$/ }).click(); assert.equal(await page.locator('#daily-position').innerText(), '第 3／50 題');
      await page.evaluate(() => { const root = JSON.parse(localStorage.getItem('ipas-daily-draft-v1')); root.drafts[0].seq++; root.drafts[0].questions.forEach((q) => { q.choice ??= 'A'; }); localStorage.setItem('ipas-daily-draft-v1', JSON.stringify(root)); });
      await page.reload(); await page.locator('#daily-submit:enabled').waitFor(); await page.locator('#daily-submit').click(); await page.locator('#daily-confirm').click(); await page.locator('#daily-score').waitFor();
      assert.equal((await getAttempts(page)).length, 50); assert.deepEqual((await getAttempts(page)).slice(0, 3), old);
      report.cases.push({ name: 'legacy-noncontinuous-mode-rev-lock', legacyCount: 3, added: 47, legacyAdded: 0 }); await ctx.close();
    }
    // 其他入口保留即時解析；同列上緣與手機溢出一併量。
    for (const width of [320, 375, 1440]) {
      const ctx = await context({ viewport: { width, height: 1000 } }); const page = await ctx.newPage();
      await page.goto(base + '/official/'); await page.locator('#official-catalog').waitFor({ state: 'attached' }); await screenshot(page, `official-index-${width}`);
      const qid = questions.find((q) => q.source === 'exam').id;
      for (const [name, path] of [['official', '/official/115-1-S3/'], ['quiz', '/quiz/'], ['question', `/questions/${qid}/`]]) {
        await page.goto(base + path); const card = page.locator('[data-question]:visible').first(); await card.waitFor();
        const before = await getAttempts(page); const expected = { qid: await card.getAttribute('data-qid'), choice: 'A', mode: name === 'official' ? 'official:115-1:S3' : name === 'quiz' ? 'quiz' : 'question' };
        if (process.env.DAILY_EXAM_FAULT_INSTANT === name) await page.evaluate(() => { const original = Storage.prototype.setItem; Storage.prototype.setItem = function(key, raw) { if (key === 'ipas-attempts-v1') return; return original.call(this, key, raw); }; });
        await card.locator('input[value="A"]').check(); await card.locator('button[type="submit"]').click(); await card.locator('[data-explanation]').waitFor();
        const after = await getAttempts(page); const previousIds = new Set(before.map((a) => a.id)); const added = after.filter((a) => !previousIds.has(a.id));
        report.instantSaves.push({ name, width, before: before.length, after: after.length, added: added.length, oldAssertionWouldPass: after.length > 0, expected });
        assert.equal(after.length - before.length, 1, `${name} 必須新增剛好 1 筆作答`); assert.equal(added.length, 1);
        assert.deepEqual(after.filter((a) => previousIds.has(a.id)), before, '既有作答保持不變');
        assert.deepEqual({ qid: added[0].qid, choice: added[0].choice, mode: added[0].mode }, expected);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        const alignment = await page.evaluate(() => {
          const row = document.querySelector('.daily-navigation, .official-navigation') ?? document.querySelector('#official-previous')?.parentElement;
          const controls = row ? [...row.querySelectorAll('button')].map((b) => b.getBoundingClientRect().top) : [];
          const action = document.querySelector('[data-question]:not([hidden]) .answer-actions');
          const rects = action ? [...action.children].map((e) => e.getBoundingClientRect()) : [];
          const centers = rects.map((r) => r.top + r.height / 2);
          return { delta: controls.length ? Math.max(...controls) - Math.min(...controls) : 0, actionCenterDelta: centers.length ? Math.max(...centers) - Math.min(...centers) : 0, childMargins: action ? [...action.children].map((e) => getComputedStyle(e).marginTop) : [] };
        });
        assert.ok(alignment.delta <= 1); assert.ok(alignment.actionCenterDelta <= 1); assert.ok(alignment.childMargins.every((margin) => margin === '0px'));
        if (width !== 375) await screenshot(page, `${name}-${width}`);
        report.cases.push({ name: `instant-${name}`, width, ...alignment });
      }
      await ctx.close();
    }
    assert.equal(report.measurements.length, 48); assert.equal(report.errors.length, 0);
    report.success = true; report.accessibleHiddenChecks = hiddenChecks; return report;
  } catch (error) { report.failure = String(error.stack ?? error); throw error; }
  finally {
    if (browser) await browser.close(); server.closeAllConnections(); await new Promise((done) => server.close(done));
    report.cleanup = { browserStopped: true, serverStopped: true, port: 4333 };
    await writeFile(resolve(output, 'browser-report.json'), JSON.stringify(report, null, 2));
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = await runDailyExamSmoke(); process.stdout.write(JSON.stringify({ success: report.success, cases: report.cases.length, measurements: report.measurements.length, screenshots: report.screenshots.length, faults: report.faults, errors: report.errors, cleanup: report.cleanup }, null, 2) + '\n');
}
