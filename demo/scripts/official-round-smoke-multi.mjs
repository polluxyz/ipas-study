/** 考古題多分頁與指引練習的隔離驗收；匯入本模組不啟動服務或瀏覽器。 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';

const BASE = 'http://127.0.0.1:4363';
const ROUND = 'ipas-official-rounds-v1';
const ATTEMPTS = 'ipas-attempts-v1';
const INSTANT = '2026-11-12T04:00:00.000Z';
const DEFAULT_DIST = 'E:/orca/workspaces/ipas-study/official-verify/demo/dist';
const OUTPUT = fileURLToPath(new URL('../../tmp/demo-shots/t2/', import.meta.url));
const card = (page) => page.locator('#official-cards [data-question]:visible');
const raw = (page, key = ROUND) => page.evaluate((key) => localStorage.getItem(key), key);
const store = async (page) => JSON.parse(await raw(page));
const attempts = async (page) => JSON.parse(await raw(page, ATTEMPTS) ?? '{"attempts":[]}').attempts;
// 比較整份 localStorage，包括無關鍵與空白，避免只比較解析後的資料。
const snapshot = (page) => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map((key) => [key, localStorage.getItem(key)])));
const numbers = (page) => page.locator('#official-numbers button').allTextContents();

async function waitDirectory(page) {
  await page.waitForFunction(() => !document.querySelector('#official-status')?.textContent.includes('正在'));
  assert.equal(await page.locator('[data-official-set]').count(), 6);
}
async function waitPractice(page) {
  await page.locator('#official-practice:visible').waitFor();
  await card(page).waitFor();
  await page.waitForFunction(() => document.querySelector('#official-numbers button') !== null);
}
async function choose(page, choice) {
  await card(page).locator(`input[value="${choice}"]`).check();
}
async function readonly(page) {
  await page.locator('#official-save-error:visible').waitFor();
  assert.match(await page.locator('#official-error-message').innerText(), /唯讀/);
  assert.equal(await page.locator('#official-cards input:not(:disabled)').count(), 0);
  assert.equal(await page.locator('#official-retry').isVisible(), false);
  assert.equal(await page.locator('#official-reload').isVisible(), true);
  assert.equal(await page.locator('#official-restart').isDisabled(), true);
}
async function enter(page, round) {
  await page.goto(`${BASE}/official/${round.setId}/?round=${round.id}`);
  await waitPractice(page);
}
async function restart(page, oldId) {
  await page.locator('#official-restart').click();
  await page.locator('#official-restart-dialog[open]').waitFor();
  await Promise.all([
    page.waitForURL((url) => Boolean(url.searchParams.get('round')) && url.searchParams.get('round') !== oldId),
    page.locator('#official-restart-confirm').click(),
  ]);
  await waitPractice(page);
  const current = (await store(page)).rounds;
  assert.equal(current.length, 1);
  assert.notEqual(current[0].id, oldId);
  assert.equal(current[0].number, 1);
  assert.ok(current[0].questions.every((q) => q.choice === null && !q.unsure));
  return current[0];
}
async function forceOldSave(page) {
  // 送出已停用輸入與離頁事件，驗證舊生命週期也不能復活資料。
  await page.evaluate(() => {
    const input = document.querySelector('#official-cards input');
    if (input) { input.checked = true; input.dispatchEvent(new Event('change', { bubbles: true })); }
    window.dispatchEvent(new Event('pagehide'));
  });
}

export async function runOfficialRoundMultiSmoke() {
  const dist = resolve(process.env.OFFICIAL_ROUND_DIST ?? DEFAULT_DIST);
  assert.notEqual(dist.toLowerCase().replaceAll('\\', '/'), 'd:/ipas-study/demo/dist');
  const output = resolve(OUTPUT);
  await mkdir(output, { recursive: true });
  const report = { dist, output, origin: BASE, cases: [], screenshots: [], errors: [], exitCode: 1,
    deviations: ['網站目前沒有清除入口，經協調者核可以分頁 B 呼叫產品 clearStudyData()。'] };
  const parseCatalog = (html) => JSON.parse(html.match(/<script[^>]*id="official-catalog"[^>]*>([\s\S]*?)<\/script>/)[1]);
  const directory = parseCatalog(await readFile(resolve(dist, 'official/index.html'), 'utf8'));
  const exams = directory.filter((set) => set.session !== 'guide');
  assert.equal(exams.length, 4);
  const guide = directory.find((set) => set.id === 'guide-S3');
  assert.ok(guide?.questions.length >= 7);
  const answers = new Map();
  for (const set of [...exams, guide]) {
    const html = await readFile(resolve(dist, `official/${set.id}/index.html`), 'utf8');
    for (const match of html.matchAll(/<article\b[^>]*data-qid="([^"]+)"[^>]*data-rev="(\d+)"[^>]*data-answer="([ABCD])"/g)) answers.set(match[1], match[3]);
  }
  function fixture(status = 'open', set = exams[0]) {
    const id = `t2-${status}-${set.id}`;
    const mode = `official-round:${id}:S${set.subject}`;
    const questions = set.questions.map((q, index) => {
      assert.ok(answers.has(q.id), `缺少答案：${q.id}`);
      return { id: q.id, rev: q.rev, choice: status !== 'open' || index === 0 ? answers.get(q.id) : null, unsure: false, ms: 1000,
        ...(status === 'open' ? {} : { correct: true }) };
    });
    const batch = status === 'open' ? [] : questions.map((q, index) => ({ id: `${id}-attempt-${index}`, qid: q.id, rev: q.rev, choice: q.choice, correct: true, ts: INSTANT, mode, ms: q.ms }));
    const round = { id, seq: 7, setId: set.id, subject: set.subject, number: 1, createdAt: INSTANT, attemptMode: mode, status, position: 0, questions,
      ...(status === 'open' ? {} : { submission: { ts: INSTANT, total: questions.length, correct: questions.length, attempts: batch } }) };
    return { round, batch, data: { version: 1, rounds: [round] } };
  }
  const guideAttempt = (position, correct) => {
    const q = guide.questions[position]; const answer = answers.get(q.id);
    return { id: `t2-guide-${position}`, qid: q.id, rev: q.rev, choice: correct ? answer : answer === 'A' ? 'B' : 'A', correct, ts: INSTANT, mode: 'official:guide:S3', ms: 1000 };
  };
  // 只提供清除函式的產品模組；不複製清除行為，也不修改建置產物。
  const modules = new Map();
  const revisions = await readFile(new URL('../src/data/revisions.json', import.meta.url), 'utf8');
  for (const name of ['attempts', 'daily-exam', 'daily']) {
    const source = (await readFile(new URL(`../src/lib/${name}.ts`, import.meta.url), 'utf8')).replace(/import revisionIndex from .*?;/, `const revisionIndex = ${revisions};`);
    const compiled = transpileModule(source, { compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'");
    modules.set(`/__test/${name}.js`, compiled);
  }
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.ico': 'image/x-icon' };
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, BASE).pathname);
      if (pathname === '/__test/blank.html') { response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><title>隔離驗收</title>'); return; }
      if (modules.has(pathname)) { response.setHeader('Content-Type', 'text/javascript'); response.end(modules.get(pathname)); return; }
      const file = resolve(dist, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
      if (!file.startsWith(dist + sep)) { response.writeHead(403).end(); return; }
      response.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream'); response.end(await readFile(file));
    } catch { response.writeHead(404).end(); }
  });
  let browser;
  async function seed(ctx, entries = {}) {
    const page = await ctx.newPage(); await page.goto(BASE + '/__test/blank.html');
    await page.evaluate((entries) => {
      for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    }, entries);
    return page;
  }
  async function screenshots(page, name, panel = false) {
    for (const width of [1440, 390, 320]) for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ colorScheme: theme });
      await page.evaluate((theme) => { document.documentElement.dataset.theme = theme; }, theme);
      // 等寬度切換事件先收合行動版選單，再展開截圖，避免事件順序互相覆蓋。
      await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
      if (panel) {
        await page.locator('#official-panel').evaluate((element) => { element.open = true; });
        await page.waitForFunction(() => document.querySelector('#official-panel')?.open === true);
        await page.locator('#official-panel').scrollIntoViewIfNeeded();
      } else await page.evaluate(() => window.scrollTo(0, 0));
      await page.evaluate(async () => { await document.fonts.ready; await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))); });
      const dimensions = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }));
      assert.ok(dimensions.content <= dimensions.viewport, `${name}-${width}-${theme} 水平捲動：${JSON.stringify(dimensions)}`);
      if (panel) {
        const states = await page.locator('#official-numbers button[data-status]').evaluateAll((buttons) => buttons.map((button) => ({ state: button.dataset.status, background: getComputedStyle(button).backgroundColor, color: getComputedStyle(button).color })));
        const correct = states.find((item) => item.state === 'correct'); const wrong = states.find((item) => item.state === 'wrong');
        if (correct && wrong) assert.notEqual(correct.background + correct.color, wrong.background + wrong.color, '答對與答錯的實際顏色須不同');
      }
      const path = resolve(output, `${name}-${width}-${theme}.png`);
      await page.screenshot({ path, fullPage: true }); report.screenshots.push(path);
    }
  }
  async function run(name, execute) {
    const id = report.cases.length + 1;
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Taipei', reducedMotion: 'reduce' });
    const result = { id, name, success: false, actual: {} };
    const errorsBefore = report.errors.length;
    await ctx.route('**/*', (route) => route.request().url().startsWith(BASE + '/') ? route.continue() : route.abort());
    ctx.on('page', (page) => {
      page.setDefaultTimeout(10_000);
      page.on('pageerror', (error) => report.errors.push({ case: name, message: String(error) }));
      page.on('console', (message) => { if (message.type() === 'error') report.errors.push({ case: name, message: message.text() }); });
    });
    try {
      await execute(ctx, result.actual);
      assert.equal(report.errors.length, errorsBefore, '瀏覽器不可出現程式或主控台錯誤'); result.success = true;
    } catch (error) {
      result.failure = String(error.stack ?? error);
      console.error(`${name}：${result.failure}`);
      for (const [index, page] of ctx.pages().entries()) {
        const path = resolve(output, `failure-${id}-page-${index + 1}.png`);
        try { await page.screenshot({ path, fullPage: true }); report.screenshots.push(path); } catch { /* 截圖失敗仍保留原始錯誤。 */ }
      }
    } finally { await ctx.close(); report.cases.push(result); console.log(`${id}. ${name}：${result.success ? '通過' : '失敗'} ${JSON.stringify(result.actual)}`); }
  }
  try {
    await new Promise((done, reject) => { server.once('error', reject); server.listen(4363, '127.0.0.1', done); });
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
    for (const state of ['empty', 'open', 'submitted']) await run(`目錄只讀：${{ empty: '空資料', open: '作答中', submitted: '已交卷' }[state]}`, async (ctx, actual) => {
      const fixtures = state === 'empty' ? [] : exams.map((set) => fixture(state, set));
      const page = await seed(ctx, fixtures.length ? {
        [ROUND]: JSON.stringify({ version: 1, rounds: fixtures.map((f) => f.round) }, null, 2),
        [ATTEMPTS]: { version: 1, attempts: fixtures.flatMap((f) => f.batch) },
      } : {});
      const before = await snapshot(page);
      await page.goto(BASE + '/official/'); await waitDirectory(page);
      for (const f of fixtures) {
        if (state === 'open') assert.match(await page.locator(`#progress-${f.round.setId}`).innerText(), /已答 1／50/);
        if (state === 'submitted') assert.match(await page.locator(`#history-${f.round.setId}`).innerText(), /100/);
      }
      assert.deepEqual(await snapshot(page), before);
      await screenshots(page, `directory-${state}`);
      assert.deepEqual(await snapshot(page), before);
      for (const set of exams) {
        await page.goto(`${BASE}/official/${set.id}/`); await page.locator('#official-round-list:visible').waitFor();
        assert.deepEqual(await snapshot(page), before, `${set.id} 不得寫入`);
      }
      Object.assign(actual, { directory: 1, setPages: 4, rawUnchanged: true, screenshots: 6 });
    });
    await run('讀目錄不恢復 submitting，進入該輪才交卷', async (ctx, actual) => {
      const f = fixture('submitting');
      const page = await seed(ctx, { [ROUND]: JSON.stringify(f.data, null, 2), [ATTEMPTS]: '{ "version": 1, "attempts": [] }' });
      const before = await snapshot(page);
      await page.goto(BASE + '/official/'); await waitDirectory(page); assert.deepEqual(await snapshot(page), before);
      for (const set of exams) { await page.goto(`${BASE}/official/${set.id}/`); await page.locator('#official-round-list:visible').waitFor(); assert.deepEqual(await snapshot(page), before); }
      await enter(page, f.round); await page.locator('#official-score:visible').waitFor();
      assert.equal((await store(page)).rounds[0].status, 'submitted');
      assert.deepEqual(await attempts(page), f.batch);
      const submitted = await snapshot(page); await page.reload(); await waitPractice(page); assert.deepEqual(await snapshot(page), submitted);
      Object.assign(actual, { recoveryOnDirectory: 0, submittedAttempts: f.batch.length, duplicateAttempts: 0 });
    });
    await run('損壞輪次 JSON：考古題顯示錯誤，指引正常', async (ctx, actual) => {
      const damaged = '{"version":1,"rounds":[';
      const page = await seed(ctx, { [ROUND]: damaged }); const before = await snapshot(page);
      await page.goto(BASE + '/official/'); await waitDirectory(page);
      for (const set of exams) {
        assert.match(await page.locator(`#error-${set.id}`).innerText(), /無法讀取輪次/);
        assert.equal(await page.locator(`#action-${set.id}`).isVisible(), false);
      }
      for (const id of ['guide-S1', 'guide-S3']) {
        assert.equal(await page.locator(`#error-${id}`).isVisible(), false);
        assert.equal(await page.locator(`#action-${id}`).innerText(), '開啟題組 →');
      }
      assert.deepEqual(await snapshot(page), before); Object.assign(actual, { examErrors: 4, guideActions: 2, rawUnchanged: true });
    });
    for (const delayed of [false, true]) await run(`2 分頁重新考：${delayed ? '延後通知後保存拒絕' : 'storage 通知改唯讀'}`, async (ctx, actual) => {
      const f = fixture(); const a = await seed(ctx, { [ROUND]: f.data }); await enter(a, f.round);
      const b = await ctx.newPage();
      if (delayed) await b.addInitScript(() => window.addEventListener('storage', (event) => event.stopImmediatePropagation(), true));
      await enter(b, f.round);
      const next = await restart(a, f.round.id);
      if (delayed) await choose(b, f.round.questions[0].choice === 'A' ? 'B' : 'A');
      await readonly(b);
      const before = await snapshot(a); await forceOldSave(b);
      assert.deepEqual(await snapshot(a), before); assert.ok(!(await store(a)).rounds.some((round) => round.id === f.round.id));
      assert.equal((await store(a)).rounds[0].id, next.id);
      Object.assign(actual, { tabs: 2, readonly: true, resurrectedRounds: 0, delayedStorage: delayed });
    });
    await run('清除後舊頁唯讀：網站無入口，改呼叫產品清除函式', async (ctx, actual) => {
      const f = fixture(); const a = await seed(ctx, { [ROUND]: f.data, [ATTEMPTS]: { version: 1, attempts: [] } });
      await a.addInitScript(() => window.addEventListener('storage', (event) => event.stopImmediatePropagation(), true));
      await enter(a, f.round);
      const b = await ctx.newPage(); await b.goto(BASE + '/__test/blank.html');
      await b.evaluate(async () => (await import('/__test/attempts.js')).clearStudyData());
      assert.equal(await raw(b), null);
      await choose(a, f.round.questions[0].choice === 'A' ? 'B' : 'A'); await readonly(a);
      const before = await snapshot(b); await forceOldSave(a); assert.deepEqual(await snapshot(b), before); assert.equal(await raw(b), null);
      Object.assign(actual, { tabs: 2, clearFunction: '產品 clearStudyData()', readonly: true, recreatedKey: false });
    });
    await run('重新考後 goBack 不復活舊輪', async (ctx, actual) => {
      const f = fixture(); const page = await seed(ctx, { [ROUND]: f.data }); await enter(page, f.round);
      const next = await restart(page, f.round.id); const attemptsBefore = await raw(page, ATTEMPTS);
      await page.goBack(); await page.waitForURL((url) => url.searchParams.get('round') === f.round.id);
      await page.locator('#official-status').filter({ hasText: '找不到這一輪' }).waitFor();
      // 新輪離頁可正常保存用時；抵達舊網址後，才凍結逐字比較基準。
      const before = await snapshot(page); await forceOldSave(page); assert.deepEqual(await snapshot(page), before);
      assert.equal(await raw(page, ATTEMPTS), attemptsBefore);
      assert.equal((await store(page)).rounds[0].id, next.id); assert.equal((await store(page)).rounds.length, 1);
      Object.assign(actual, { browserBack: true, missingOldRound: true, resurrectedRounds: 0 });
    });
    // 缺少輪次鍵及既有輪次鍵各測一次，整段指引操作都監測該鍵不得寫入。
    for (const existing of [false, true]) {
      for (const sparse of [false, true]) await run(`指引${sparse ? '不連續紀錄與網址還原' : '確認、解析與題號顏色'}：輪次鍵${existing ? '既有' : '不存在'}`, async (ctx, actual) => {
        const data = sparse ? [guideAttempt(0, true), guideAttempt(2, false), guideAttempt(6, true)] : [];
        const entries = { [ATTEMPTS]: { version: 1, attempts: data }, ...(existing ? { [ROUND]: JSON.stringify(fixture('submitted').data, null, 2) } : {}) };
        const page = await seed(ctx, entries); const roundBefore = await raw(page);
        // 純讀取比較之外也記錄每次嘗試寫入，避免先寫後還原蒙混通過。
        await page.addInitScript((key) => {
          window.__t2RoundWrites = [];
          for (const method of ['setItem', 'removeItem', 'clear']) {
            const original = Storage.prototype[method];
            Storage.prototype[method] = function (...args) {
              if (this === localStorage && (method === 'clear' || args[0] === key)) window.__t2RoundWrites.push(method);
              return original.apply(this, args);
            };
          }
        }, ROUND);
        const unchanged = async () => { assert.equal(await raw(page), roundBefore); assert.deepEqual(await page.evaluate(() => window.__t2RoundWrites), []); };
        const open = async (query = '') => { await page.goto(`${BASE}/official/guide-S3/${query}`); await waitPractice(page); await unchanged(); };
        await open();
        if (!sparse) {
          assert.deepEqual(await numbers(page), ['1']); assert.equal(await page.locator('#official-next').isDisabled(), true);
          const firstId = await card(page).getAttribute('data-qid'); const answer = await card(page).getAttribute('data-answer');
          await choose(page, answer); assert.equal(await card(page).locator('[data-explanation]').isVisible(), false);
          assert.equal(await page.locator('#official-next').isDisabled(), true); assert.deepEqual(await numbers(page), ['1']);
          assert.equal((await attempts(page)).length, 0); await unchanged();
          await card(page).getByRole('button', { name: '確認作答' }).click();
          await card(page).locator('[data-explanation]:visible').waitFor();
          const saved = await attempts(page); assert.equal(saved.length, 1); assert.equal(saved[0].mode, 'official:guide:S3'); assert.equal(saved[0].qid, firstId); assert.equal(saved[0].correct, true);
          assert.deepEqual(await numbers(page), ['1', '2']); await unchanged();
          await screenshots(page, `guide-correct-${existing ? 'existing' : 'absent'}`, true);
          await page.locator('#official-next').click();
          const secondAnswer = await card(page).getAttribute('data-answer'); await choose(page, secondAnswer === 'A' ? 'B' : 'A');
          assert.equal(await page.locator('#official-next').isDisabled(), true); assert.deepEqual(await numbers(page), ['1', '2']);
          await card(page).getByRole('button', { name: '確認作答' }).click(); await card(page).locator('[data-explanation]:visible').waitFor();
          assert.equal((await attempts(page)).length, 2); assert.equal((await attempts(page))[1].correct, false);
          assert.deepEqual(await numbers(page), ['1', '2', '3']);
          assert.equal(await page.locator('#official-numbers button').nth(0).getAttribute('data-status'), 'correct');
          assert.equal(await page.locator('#official-numbers button').nth(1).getAttribute('data-status'), 'wrong');
          await unchanged(); await screenshots(page, `guide-correct-wrong-${existing ? 'existing' : 'absent'}`, true);
          await page.reload(); await waitPractice(page); assert.equal(new URL(page.url()).searchParams.get('position'), '2'); await unchanged();
          Object.assign(actual, { addedAttempts: 2, mode: 'official:guide:S3', immediateExplanation: true, gatedBeforeConfirmation: true, distinctColors: true });
        } else {
          assert.deepEqual(await numbers(page), ['1', '2', '3', '7']); assert.equal(new URL(page.url()).searchParams.get('position'), '2');
          assert.match(await page.locator('#official-question-heading').innerText(), /第 2 題/);
          await screenshots(page, `guide-sparse-${existing ? 'existing' : 'absent'}`, true); await unchanged();
          for (const query of ['?position=999', '?position=5']) {
            await open(query); assert.equal(new URL(page.url()).searchParams.get('position'), '2'); assert.deepEqual(await numbers(page), ['1', '2', '3', '7']);
          }
          await page.locator('#official-panel').evaluate((element) => { element.open = true; });
          await page.locator('#official-numbers button').filter({ hasText: /^7$/ }).click();
          assert.equal(new URL(page.url()).searchParams.get('position'), '7'); await page.reload(); await waitPractice(page);
          assert.equal(new URL(page.url()).searchParams.get('position'), '7'); assert.match(await page.locator('#official-question-heading').innerText(), /第 7 題/);
          assert.deepEqual(await attempts(page), data); await unchanged();
          Object.assign(actual, { seededPositions: [1, 3, 7], menu: [1, 2, 3, 7], firstUnanswered: 2, invalidPositions: [999, 5], restoredPosition: 7 });
        }
        for (const suffix of ['submit', 'score', 'restart', 'unsure']) assert.equal(await page.locator(`#official-${suffix}`).count(), 0);
        await unchanged(); Object.assign(actual, { roundKeyUnchanged: true, roundWriteAttempts: 0 });
      });
    }
  } catch (error) { report.fatal = String(error.stack ?? error); console.error(report.fatal); }
  finally {
    if (browser) await browser.close();
    if (server.listening) await new Promise((done, reject) => server.close((error) => error ? reject(error) : done()));
    report.passed = report.cases.filter((item) => item.success).length;
    report.total = report.cases.length;
    report.exitCode = !report.fatal && report.total === 13 && report.passed === report.total && report.errors.length === 0 ? 0 : 1;
    await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runOfficialRoundMultiSmoke().then((report) => {
    console.log(`通過 ${report.passed}／${report.total}；截圖 ${report.screenshots.length}；報告 ${resolve(report.output, 'report.json')}`);
    process.exitCode = report.exitCode;
  }).catch((error) => { console.error(error); process.exitCode = 1; });
}
