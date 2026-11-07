/** 建置產物的離線瀏覽器驗收；僅建立全新瀏覽器資料與 4333 暫時服務，結束一律關閉。 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';
import { parse } from 'yaml';
import assert from 'node:assert/strict';

const DRAFT = 'ipas-daily-draft-v2';
const ATTEMPTS = 'ipas-attempts-v1';
const date = '2026-11-05';
const instant = new Date('2026-11-05T04:00:00Z');
let hiddenChecks = 0;
const output = process.env.DAILY_EXAM_OUTPUT ?? fileURLToPath(new URL('../../tmp/demo-shots/booklet-i7a/', import.meta.url));
const dist = process.env.DAILY_EXAM_DIST ? resolve(process.env.DAILY_EXAM_DIST) : fileURLToPath(new URL('../dist/', import.meta.url));
// 名稱片段可用逗號並列，讓舊建置與故障注入只跑需要證明的案例。
const only = process.env.DAILY_EXAM_ONLY?.split(',').map((name) => name.trim()).filter(Boolean);
const selected = (...names) => !only || names.some((name) => only.some((part) => name.includes(part)));
const dataRoot = fileURLToPath(new URL('../../content/questions/', import.meta.url));
const currentCard = (page) => page.locator('#daily-cards [data-question]:visible');
const getStore = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), DRAFT);
// 交卷會清空 current；檢討時仍須取得最後一本，而不是誤判成沒有資料。
const getDraft = (page, subject = 1) => page.evaluate(({ key, subject }) => {
  const store = JSON.parse(localStorage.getItem(key));
  return store?.booklets.find((b) => b.id === store.current[subject]) ?? store?.booklets.filter((b) => b.subject === subject).sort((a, b) => b.number - a.number)[0];
}, { key: DRAFT, subject });
const getAttempts = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{"attempts":[]}').attempts, ATTEMPTS);
const loadDaily = async (page, url) => {
  await page.goto(url);
  await page.waitForFunction(() => !document.querySelector('#daily-metrics').hidden || !document.querySelector('#daily-save-error').hidden);
  assert.equal(await page.locator('#daily-metrics').isVisible(), true, await page.locator('#daily-status').innerText());
};
const openFirst = async (page) => { await page.locator('#daily-open-first').click(); await page.locator('#daily-current:not([hidden])').waitFor(); };
const openNext = async (page) => { await page.locator('#daily-open-next').click(); await page.locator('#daily-current:not([hidden])').waitFor(); };
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
  const id = `fixture-${subject}`; const attemptMode = `booklet:${id}:S${subject}`;
  const attempts = items.filter((q) => q.choice).map((q, index) => ({ id: `fixture-${subject}-${index}`, qid: q.id, rev: q.rev, choice: q.choice, correct: Boolean(q.correct), ts: instant.toISOString(), mode: attemptMode, ms: q.ms }));
  return { id, seq: 1, subject, number: 1, createdDate: date, attemptMode, origin: 'new', status, position: answered === 50 ? 0 : answered, assignedQids: items.map((q) => q.id), questions: items,
    ...(status === 'open' ? {} : { submission: { ts: instant.toISOString(), attempts, total: 50, correct: items.filter((q) => q.correct).length } }) };
}
async function seed(context, booklets, attempts = []) {
  await context.addInitScript(({ booklets, attempts }) => {
    if (location.origin !== 'http://127.0.0.1:4333') return;
    if (sessionStorage.getItem('daily-exam-fixture')) return;
    const current = { 1: null, 3: null };
    for (const b of booklets) if (b.status === 'open' || b.status === 'submitting') current[b.subject] ??= b.id;
    localStorage.setItem('ipas-daily-draft-v2', JSON.stringify({ version: 2, migratedAt: null, current, booklets }));
    localStorage.setItem('ipas-attempts-v1', JSON.stringify({ version: 1, attempts }));
    sessionStorage.setItem('daily-exam-fixture', 'seeded');
  }, { booklets, attempts });
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
  const report = { success: false, cases: [], measurements: [], extraMeasurements: [], dialogs: [], screenshots: [], errors: [], faults: [], instantSaves: [], newCases: [], dist, only };
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
  // 新案例各自清理並收集失敗，舊建置一次即可留下每項退步的證據。
  const regression = async (name, run) => {
    if (!selected(name)) return;
    const ctx = await context();
    try {
      const result = await run(ctx);
      report.cases.push({ name, ...result }); report.newCases.push({ name, success: true });
    } catch (error) { report.newCases.push({ name, success: false, failure: String(error.stack ?? error) }); }
    finally { await ctx.close(); }
  };
  // 從實際樣式逐層合成透明背景，避免只比對色碼卻漏掉背景造成的低對比。
  const contrast = async (locator) => locator.evaluate((element) => {
    const rgba = (value) => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data; return [r / 255, g / 255, b / 255, a / 255];
    };
    const over = (front, back) => { const alpha = front[3] + back[3] * (1 - front[3]); return [...front.slice(0, 3).map((v, i) => (v * front[3] + back[i] * back[3] * (1 - front[3])) / alpha), alpha]; };
    const ancestors = []; for (let node = element; node; node = node.parentElement) ancestors.unshift(node);
    let background = [1, 1, 1, 1];
    for (const node of ancestors) { const style = getComputedStyle(node); if (style.backgroundImage !== 'none' || Number(style.opacity) !== 1) throw new Error('對比案例需純色背景且無群組透明度'); background = over(rgba(style.backgroundColor), background); }
    const style = getComputedStyle(element); const foreground = over(rgba(style.color), background);
    const luminance = (rgb) => rgb.slice(0, 3).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    const light = luminance(foreground); const dark = luminance(background);
    return { color: style.color, background: background.slice(0, 3), ratio: (Math.max(light, dark) + .05) / (Math.min(light, dark) + .05) };
  });
  try {
    browser = await chromium.launch({ headless: true, channel: 'chrome' }); report.browser = browser.version();
    // 第 1 版快取失效案例改驗題本保留、明確結束與按鈕開本；不再讀舊鍵。
    for (const invalid of ['removed', 'revision']) for (const draftState of ['absent', 'empty']) {
      await regression(`regression-stale-booklet-${invalid}-${draftState}`, async (ctx) => {
        const stale = fixture(questions, 1); const other = fixture(questions, 3, 4);
        stale.status = draftState === 'absent' ? 'retired' : 'open';
        if (draftState === 'empty') stale.questions = [];
        await seed(ctx, [stale, other]);
        const ids = new Set(stale.assignedQids); const page = await ctx.newPage(); await page.clock.install({ time: instant });
        const catalog = questions.filter((q) => invalid !== 'removed' || !ids.has(q.id)).map((q) => invalid === 'revision' && ids.has(q.id) ? { ...q, rev: q.rev + 1 } : q);
        await changeCatalog(page, () => catalog); await loadDaily(page, base + '/daily/');
        assert.equal((await getStore(page)).booklets.length, 2, '開頁不新增題本');
        if (draftState === 'empty') {
          assert.equal(await page.locator('#daily-retire').isVisible(), true);
          await page.locator('#daily-retire-book').click(); await page.locator('#daily-open-next:visible').waitFor();
        }
        assert.equal((await getDraft(page)).status, 'retired');
        await openNext(page); const opened = await getDraft(page);
        assert.notEqual(opened.id, stale.id); assert.equal(opened.number, 2); assert.equal(opened.questions.length, 50);
        assert.equal(new Set(opened.questions.map((q) => q.id)).size, 50);
        for (const q of opened.questions) {
          assert.equal(ids.has(q.id), false, '已分配題即使改版仍不重抽');
          assert.ok(catalog.some((item) => item.id === q.id && item.rev === q.rev && item.subject === 1 && item.source === 'mock' && item.review.status === 'verified'));
        }
        const before = (await getStore(page)).booklets.find((b) => b.id === stale.id);
        assert.deepEqual(before.assignedQids, stale.assignedQids);
        assert.deepEqual(await getDraft(page, 3), other); assert.equal((await getAttempts(page)).length, 0);
        await page.reload(); await page.locator('#daily-position').filter({ hasText: '第 1／50' }).waitFor();
        assert.equal((await getDraft(page)).id, opened.id); assert.equal((await getStore(page)).booklets.length, 3);
        assert.deepEqual(await getDraft(page, 3), other); assert.equal((await getAttempts(page)).length, 0);
        return { total: 50, added: 0, reloadIdStable: true, historyPreserved: true, otherSubjectPreserved: true };
      });
    }
    for (const invalid of ['removed', 'revision']) {
      await regression(`regression-partial-booklet-${invalid}`, async (ctx) => {
        const stale = fixture(questions, 1); const other = fixture(questions, 3, 4); const ids = new Set(stale.questions.slice(0, 3).map((q) => q.id));
        await seed(ctx, [stale, other]);
        // 模擬錯誤補題，證明保留原順序及不補題的斷言會失敗。
        if (process.env.DAILY_EXAM_FAULT_REGRESSION === 'partial-refill') await ctx.addInitScript(() => {
          const original = Storage.prototype.setItem;
          Storage.prototype.setItem = function(key, raw) {
            if (key === 'ipas-daily-draft-v2') {
              const root = JSON.parse(raw); const b = root.booklets.find((b) => b.subject === 1);
              if (b?.questions.length === 47) {
                // 用已分配但剛略過的題注入補題，避免先被資料格式驗證擋下。
                const id = b.assignedQids.find((id) => !b.questions.some((q) => q.id === id));
                b.questions.push({ ...b.questions[0], id }); raw = JSON.stringify(root);
              }
            }
            return original.call(this, key, raw);
          };
        });
        const page = await ctx.newPage(); await page.clock.install({ time: instant });
        await changeCatalog(page, (catalog) => invalid === 'removed' ? catalog.filter((q) => !ids.has(q.id)) : catalog.map((q) => ids.has(q.id) ? { ...q, rev: q.rev + 1 } : q));
        await loadDaily(page, base + '/daily/'); const b = await getDraft(page);
        assert.equal(b.questions.length, 47, '部分失效只扣 3 題，不補題');
        assert.deepEqual(b.questions, stale.questions.slice(3)); assert.deepEqual(b.assignedQids, stale.assignedQids);
        assert.match(await page.locator('#daily-status').innerText(), /3 題已移除或改版/);
        await page.reload(); await page.locator('#daily-position').filter({ hasText: '第 1／47' }).waitFor();
        assert.equal((await getDraft(page)).id, stale.id); assert.deepEqual((await getDraft(page)).assignedQids, stale.assignedQids);
        assert.deepEqual(await getDraft(page, 3), other); assert.equal((await getAttempts(page)).length, 0);
        return { total: 47, skipped: 3, refill: 0, assignedPreserved: true };
      });
      await regression(`regression-stale-booklet-zero-${invalid}`, async (ctx) => {
        const stale = fixture(questions, 1); stale.status = 'retired'; const other = fixture(questions, 3, 4);
        await seed(ctx, [stale, other]); const page = await ctx.newPage(); await page.clock.install({ time: instant });
        await changeCatalog(page, (catalog) => catalog.flatMap((q) => q.subject !== 1 || q.source !== 'mock' ? [q] : invalid === 'removed' ? [] : [{ ...q, rev: q.rev + 1, review: { status: 'draft' } }]));
        if (process.env.DAILY_EXAM_FAULT_REGRESSION === 'empty-draft-save') await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
          const root = JSON.parse(localStorage.getItem('ipas-daily-draft-v2')); root.booklets.push({ ...root.booklets[0], id: 'injected-empty', attemptMode: 'booklet:injected-empty:S1', number: 2, status: 'open', questions: [] }); localStorage.setItem('ipas-daily-draft-v2', JSON.stringify(root));
        }));
        await loadDaily(page, base + '/daily/'); const before = await getStore(page);
        assert.equal(await page.locator('#daily-stock').isVisible(), true); assert.equal(await page.locator('#daily-practice').isVisible(), false);
        assert.equal(await page.locator('#daily-open-first:visible, #daily-open-next:visible').count(), 0);
        assert.equal(before.booklets.length, 2, '零候選不得保存空題本'); assert.deepEqual(await getDraft(page), stale);
        await page.clock.runFor(16000); await page.reload(); await page.locator('#daily-stock:visible').waitFor();
        assert.deepEqual(await getStore(page), before); assert.deepEqual(await getDraft(page, 3), other); assert.equal((await getAttempts(page)).length, 0);
        return { total: 0, bookletCreated: false, historyPreserved: true };
      });
    }
    await regression('regression-subject-card-live-progress', async (ctx) => {
      const d = fixture(questions, 1, 49); d.position = 49; const other = fixture(questions, 3, 4); await seed(ctx, [d, other]);
      const page = await ctx.newPage(); await page.clock.install({ time: instant }); await loadDaily(page, base + '/daily/');
      const card = page.locator('[data-daily-subject="1"] [data-subject-progress]'); const otherCard = page.locator('[data-daily-subject="3"]'); const before = await otherCard.innerHTML();
      assert.equal(await card.innerText(), '第 1 本作答中\n已答 49／50'); await currentCard(page).locator('input[value="A"]').check(); assert.equal(await card.innerText(), '第 1 本作答中\n已答 50／50', '選答當下科目卡須同步'); assert.equal(await otherCard.innerHTML(), before);
      await page.locator('#daily-submit').click(); await page.locator('#daily-confirm').click(); await page.locator('#daily-score').waitFor(); assert.equal(await card.innerText(), '第 1 本已交卷');
      assert.equal(await otherCard.innerHTML(), before); assert.deepEqual(await getDraft(page, 3), other); return { answered: 50, submitted: true, otherSubjectPreserved: true };
    });
    for (const width of [375, 1440]) await regression(`regression-number-panel-${width}`, async (ctx) => {
      // 桌面維持展開屬既有行為，故障注入用來證明桌面斷言能抓到誤收合。
      if (process.env.DAILY_EXAM_FAULT_REGRESSION === 'desktop-panel-close') await ctx.addInitScript(() => document.addEventListener('click', (event) => {
        if (innerWidth >= 1100 && event.target instanceof Element && event.target.closest('#daily-numbers button')) document.querySelector('#daily-panel').open = false;
      }, true));
      const d = fixture(questions, 1, 2); d.position = 1; await seed(ctx, [d]); const page = await ctx.newPage(); await page.setViewportSize({ width, height: 1000 }); await page.clock.install({ time: instant }); await loadDaily(page, base + '/daily/');
      const panel = page.locator('#daily-panel'); const summary = panel.locator('summary');
      if (width === 375) { assert.equal(await panel.evaluate((e) => e.open), false); await summary.click(); }
      await page.waitForFunction(() => document.querySelector('#daily-panel summary').getAttribute('aria-expanded') === 'true'); assert.equal(await page.locator('#daily-panel-toggle').innerText(), '收合');
      await page.locator('#daily-numbers button').filter({ hasText: /^1$/ }).click(); assert.equal(await page.locator('#daily-question-heading').innerText(), '第 1 題');
      assert.equal(await panel.evaluate((e) => e.open), width === 1440, '跳題後手機收合、桌面維持展開');
      await page.waitForFunction((expanded) => document.querySelector('#daily-panel summary').getAttribute('aria-expanded') === String(expanded), width === 1440, { timeout: 3000 });
      assert.equal(await panel.evaluate((e) => e.open), width === 1440); assert.equal(await summary.getAttribute('aria-expanded'), String(width === 1440)); assert.equal(await page.locator('#daily-panel-toggle').innerText(), width === 1440 ? '收合' : '展開');
      assert.equal(await page.locator('#daily-question-heading').evaluate((e) => document.activeElement === e), true); return { width, expandedAfterJump: width === 1440, headingFocused: true };
    });
    for (const width of [320, 375, 1440]) await regression(`regression-submit-width-${width}`, async (ctx) => {
      const d = fixture(questions, 1, 49); d.position = 49; await seed(ctx, [d]); const page = await ctx.newPage(); await page.setViewportSize({ width, height: 1000 }); await page.clock.install({ time: instant }); await loadDaily(page, base + '/daily/');
      const geometry = () => page.evaluate(() => { const button = document.querySelector('#daily-submit').getBoundingClientRect(); const paper = document.querySelector('.daily-paper'); const style = getComputedStyle(paper); return { width: button.width, edge: button.right - (paper.getBoundingClientRect().right - parseFloat(style.paddingRight) - parseFloat(style.borderRightWidth)), overflow: document.documentElement.scrollWidth - innerWidth }; });
      assert.equal(await page.locator('#daily-submit').isDisabled(), true); const before = await geometry(); await currentCard(page).locator('input[value="A"]').check(); assert.equal(await page.locator('#daily-submit').isEnabled(), true); const complete = await geometry();
      assert.equal(complete.width - before.width, 0, `交卷按鈕寬度差須為 0px：${JSON.stringify({ width, before, complete })}`);
      for (const item of [before, complete]) { assert.ok(Math.abs(item.edge) <= 2, `交卷右緣差 ${item.edge}px`); assert.ok(item.overflow <= 0, `水平溢出 ${item.overflow}px`); }
      return { width, before, complete, widthDelta: complete.width - before.width };
    });
    await regression('regression-header-copy', async (ctx) => {
      const page = await ctx.newPage(); await page.clock.install({ time: instant }); await loadDaily(page, base + '/daily/'); assert.equal(await page.locator('.daily-exam > .lead').innerText(), '每天每科建議 50 題，完成後一起檢討。'); assert.doesNotMatch(await page.locator('#daily-status').innerText(), /每天每科最多|明天才/); assert.equal((await getStore(page)).booklets.length, 0); return { lead: '每天每科建議 50 題，完成後一起檢討。' };
    });
    await regression('regression-light-progress-contrast', async (ctx) => {
      const d = fixture(questions, 1, 49); await seed(ctx, [d]); const page = await ctx.newPage(); await page.clock.install({ time: instant }); await loadDaily(page, base + '/daily/'); await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
      const results = [];
      for (const selector of ['#daily-time', '#daily-progress', '#daily-unsure-count', '[data-daily-subject="1"] [data-subject-progress]', '[data-daily-subject="3"] [data-subject-progress]']) { const result = await contrast(page.locator(selector)); results.push({ selector, ...result }); assert.ok(result.ratio >= 4.5, `${selector} 對比 ${result.ratio.toFixed(3)}:1，需至少 4.5:1`); }
      return { theme: 'light', contrasts: results };
    });
    for (const state of ['default', 'hover']) await regression(`regression-dark-concept-contrast-${state}`, async (ctx) => {
      const d = fixture(questions, 1, 50, 'submitted'); await seed(ctx, [d], d.submission.attempts); const page = await ctx.newPage(); await page.clock.install({ time: instant }); await loadDaily(page, base + '/daily/'); await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
      const chips = currentCard(page).locator('[data-explanation] .link-chips a'); assert.ok(await chips.count() > 0, '解析區須有概念按鈕'); const results = [];
      for (const chip of await chips.all()) { await chip.scrollIntoViewIfNeeded(); if (state === 'hover') await chip.hover(); else await page.mouse.move(0, 0); await page.waitForTimeout(200); assert.equal(await chip.evaluate((e) => e.matches(':hover')), state === 'hover'); const result = await contrast(chip); results.push({ text: await chip.innerText(), ...result }); assert.ok(result.ratio >= 4.5, `暗色概念按鈕 ${state} 對比 ${result.ratio.toFixed(3)}:1，需至少 4.5:1`); }
      return { theme: 'dark', state, contrasts: results };
    });
    // 在另一科讀取草稿，才不會由目前題組的還原流程先濾掉空題與部分失效題。
    for (const state of ['absent', 'empty', 'submitted', 'invalid-removed', 'invalid-revision', 'open', 'partial-removed', 'partial-revision']) await regression(`regression-round3-subject-copy-${state}`, async (ctx) => {
      const active = fixture(questions, 1, 2); const other = fixture(questions, 3, state === 'submitted' ? 50 : 4, state === 'submitted' ? 'submitted' : 'open');
      await seed(ctx, state === 'empty' ? [] : state === 'absent' ? [active] : [active, other], other.submission?.attempts ?? []);
      const page = await ctx.newPage(); await page.clock.install({ time: instant });
      const invalid = new Set(other.questions.slice(0, state.startsWith('partial') ? 1 : 50).map((q) => q.id));
      if (state === 'empty') await changeCatalog(page, (catalog) => catalog.filter((q) => q.subject !== 1 || q.source !== 'mock'));
      else if (state.includes('removed') || state === 'submitted') await changeCatalog(page, (catalog) => catalog.filter((q) => !invalid.has(q.id)));
      else if (state.includes('revision')) await changeCatalog(page, (catalog) => catalog.map((q) => invalid.has(q.id) ? { ...q, rev: q.rev + 1 } : q));
      await loadDaily(page, base + '/daily/');
      const subject = state === 'empty' ? 1 : 3; const card = page.locator(`[data-daily-subject="${subject}"] [data-subject-progress]`);
      const expected = state === 'absent' ? '尚未開本' : state === 'empty' ? '未做題已用完' : state === 'submitted' ? '第 1 本已交卷' : state.startsWith('invalid') ? '題目已失效・需結束題本' : state.startsWith('partial') ? '第 1 本作答中\n已答 3／49' : '第 1 本作答中\n已答 4／50';
      // 舊版已具備的文案也要證明斷言有效，故意破壞顯示結果即可重現退步。
      if (process.env.DAILY_EXAM_FAULT_ROUND3 === 'subject-copy') await card.evaluate((e) => { e.textContent = '故障注入：錯誤科目狀態'; });
      assert.equal(await card.innerText(), expected, `科目卡 ${state} 須精確符合狀態文字`);
      if (!['absent', 'empty'].includes(state)) { const restored = await getDraft(page, 3); assert.equal(restored.id, other.id); assert.deepEqual(restored.assignedQids, other.assignedQids); assert.deepEqual(restored.questions, state.startsWith('invalid') ? [] : state.startsWith('partial') ? other.questions.slice(1) : other.questions, '兩科都略過失效題，但不補題'); }
      if (state === 'empty') assert.deepEqual((await getStore(page)).booklets, []);
      return { state, subject, text: expected, total: state === 'empty' ? 0 : other.questions.length };
    });
    const subjectCardText = (page, subject) => page.locator(`[data-daily-subject="${subject}"] [data-subject-progress]`);
    const waitSubjectCard = async (page, subject, expected) => {
      // 等待跨分頁事件完成，再保留實際文字供舊建置的失敗報告比對。
      const card = subjectCardText(page, subject);
      try { await card.filter({ hasText: expected }).waitFor({ timeout: 3000 }); } catch { /* 下方斷言會列出預期值與實際值。 */ }
      assert.equal(await card.innerText(), expected, `科目 ${subject} 卡須不重載即更新`);
    };
    const currentSnapshot = async (page) => ({ draft: await getDraft(page), qid: await currentCard(page).getAttribute('data-qid'), position: await page.locator('#daily-position').innerText(), url: page.url(), document: await page.evaluate(() => window.round3Document) });
    await regression('regression-round3-other-tab-storage', async (ctx) => {
      const first = await ctx.newPage(); await first.clock.install({ time: instant }); await first.clock.pauseAt(new Date(instant.getTime() + 1000));
      if (process.env.DAILY_EXAM_FAULT_ROUND3 === 'storage-sync') await first.addInitScript(() => window.addEventListener('storage', (event) => event.stopImmediatePropagation(), true));
      const three = fixture(questions, 3).questions.slice(0, 3); const ids = new Set(three.map((q) => q.id));
      const smallCatalog = (catalog) => catalog.filter((q) => q.subject !== 3 || ids.has(q.id));
      await changeCatalog(first, smallCatalog); await loadDaily(first, base + '/daily/?subject=1'); await openFirst(first);
      await currentCard(first).locator('input[value="A"]').check(); await first.locator('#daily-next').click(); await currentCard(first).locator('input[value="B"]').check();
      await first.evaluate(() => { window.round3Document = 'original-subject-1-document'; });
      const before = await currentSnapshot(first); let navigations = 0; first.on('framenavigated', (frame) => { if (frame === first.mainFrame()) navigations++; });
      const second = await ctx.newPage(); await second.clock.install({ time: instant }); await second.clock.pauseAt(new Date(instant.getTime() + 1000)); await changeCatalog(second, smallCatalog);
      await loadDaily(second, base + '/daily/?subject=3'); await openFirst(second); await waitSubjectCard(first, 3, '第 1 本作答中\n已答 0／3');
      await currentCard(second).locator('input[value="A"]').check(); await waitSubjectCard(first, 3, '第 1 本作答中\n已答 1／3');
      assert.deepEqual(await currentSnapshot(first), before, '另一科選答不得改目前題目、位置、科目 1 seq 或頁面');
      for (let index = 1; index < 3; index++) { await second.locator('#daily-next').click(); await currentCard(second).locator('input[value="A"]').check(); }
      await waitSubjectCard(first, 3, '第 1 本作答中\n已答 3／3'); await second.locator('#daily-submit').click(); await second.locator('#daily-confirm').click(); await second.locator('#daily-score').waitFor();
      await waitSubjectCard(first, 3, '第 1 本已交卷'); assert.deepEqual(await currentSnapshot(first), before, '另一科交卷不得改目前題目、位置、科目 1 seq 或頁面');
      assert.equal(navigations, 0, '科目卡同步不得重新載入'); assert.equal((await getAttempts(first)).length, 3);
      return { tabs: 2, updates: ['第 1 本作答中\n已答 0／3', '第 1 本作答中\n已答 1／3', '第 1 本作答中\n已答 3／3', '第 1 本已交卷'], subject1Seq: before.draft.seq, subject1Preserved: true, navigations };
    });
    await regression('regression-round3-other-tab-visibility', async (ctx) => {
      // 已交卷的目前題組不會在可見事件保存計時，因此可精確驗證 seq 不變。
      const active = fixture(questions, 1, 50, 'submitted'); const other = fixture(questions, 3, 4); await seed(ctx, [active, other], active.submission.attempts);
      const page = await ctx.newPage(); await page.clock.install({ time: instant }); await page.clock.pauseAt(new Date(instant.getTime() + 1000));
      if (process.env.DAILY_EXAM_FAULT_ROUND3 === 'visibility-sync') await page.addInitScript(() => document.addEventListener('visibilitychange', (event) => event.stopImmediatePropagation(), true));
      await loadDaily(page, base + '/daily/?subject=1'); await page.evaluate(() => { window.round3Document = 'visibility-document'; }); const before = await currentSnapshot(page);
      assert.equal(await subjectCardText(page, 3).innerText(), '第 1 本作答中\n已答 4／50');
      // 同頁改儲存區不會收到 storage，能單獨證明 visibilitychange 的刷新路徑。
      await page.evaluate((key) => { const root = JSON.parse(localStorage.getItem(key)); const other = root.booklets.find((d) => d.subject === 3); other.seq++; other.questions.slice(0, 9).forEach((q) => { q.choice = 'A'; }); localStorage.setItem(key, JSON.stringify(root)); }, DRAFT);
      assert.equal(await subjectCardText(page, 3).innerText(), '第 1 本作答中\n已答 4／50', '派發事件前尚未刷新');
      await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
      await waitSubjectCard(page, 3, '第 1 本作答中\n已答 9／50'); assert.equal(await subjectCardText(page, 1).innerText(), '第 1 本已交卷'); assert.deepEqual(await currentSnapshot(page), before, '回到分頁只刷新科目卡，不換目前題組');
      return { before: '第 1 本作答中\n已答 4／50', after: '第 1 本作答中\n已答 9／50', subject1Seq: before.draft.seq, subject1Preserved: true, event: 'visibilitychange' };
    });
    for (const direction of ['shrink', 'grow']) await regression(`regression-round3-resize-focus-${direction}`, async (ctx) => {
      const d = fixture(questions, 1, 2); d.position = 1; await seed(ctx, [d]); const page = await ctx.newPage(); const shrink = direction === 'shrink';
      await page.setViewportSize({ width: shrink ? 1440 : 375, height: 1000 }); await page.clock.install({ time: instant }); await loadDaily(page, base + '/daily/');
      const number = page.locator('#daily-numbers [aria-current="step"]'); const summary = page.locator('#daily-panel summary'); const initial = shrink ? number : summary;
      await initial.focus(); assert.equal(await initial.evaluate((e) => document.activeElement === e), true, '寬度變動前先確認焦點');
      await page.setViewportSize({ width: shrink ? 375 : 1440, height: 1000 });
      const selector = shrink ? '#daily-panel summary' : '#daily-numbers [aria-current="step"]';
      try { await page.waitForFunction((selector) => document.activeElement === document.querySelector(selector), selector, { timeout: 3000 }); } catch { /* 下方列出實際焦點，不能只檢查面板開合。 */ }
      if (process.env.DAILY_EXAM_FAULT_ROUND3 === 'resize-focus') await page.evaluate(() => document.activeElement.blur());
      const focus = await page.evaluate((selector) => ({ matches: document.activeElement === document.querySelector(selector), tag: document.activeElement.tagName, id: document.activeElement.id, text: document.activeElement.textContent?.trim().slice(0, 40) }), selector);
      assert.equal(focus.matches, true, `寬度 ${direction} 焦點須到 ${selector}，實際 ${JSON.stringify(focus)}`); assert.notEqual(focus.tag, 'BODY');
      assert.equal(await page.locator('#daily-panel').evaluate((e) => e.open), !shrink); assert.equal(await page.locator('#daily-position').innerText(), '第 2／50 題');
      return { from: shrink ? 1440 : 375, to: shrink ? 375 : 1440, focus };
    });
    await regression('regression-round3-rejected-number-pending', async (ctx) => {
      const d = fixture(questions, 1, 50); await seed(ctx, [d]); const page = await ctx.newPage(); await page.setViewportSize({ width: 375, height: 1000 }); await page.clock.install({ time: instant }); await loadDaily(page, base + '/daily/');
      // 讓正式作答已寫入、草稿結案失敗，重試才能同時驗證防重複與固定 ID。
      await page.evaluate(() => {
        const original = Storage.prototype.setItem; window.restoreRound3Storage = () => { Storage.prototype.setItem = original; };
        window.round3GeneratedIds = []; const uuid = crypto.randomUUID.bind(crypto); crypto.randomUUID = () => { const id = uuid(); window.round3GeneratedIds.push(id); return id; };
        Storage.prototype.setItem = function(key, raw) { if (key === 'ipas-daily-draft-v2' && JSON.parse(raw).booklets.some((d) => d.subject === 1 && d.status === 'submitted')) throw new Error('round3 final draft quota'); return original.call(this, key, raw); };
      });
      await page.locator('#daily-submit').click(); await page.locator('#daily-confirm').click(); await page.locator('#daily-save-error').waitFor(); await assertHiddenResults(page);
      const pending = await getDraft(page); assert.equal(pending.status, 'submitting'); const ids = pending.submission.attempts.map((a) => a.id); const attemptsBefore = await getAttempts(page);
      assert.equal(attemptsBefore.length, 50); assert.equal(await page.locator('#daily-numbers button:disabled').count(), 50, '真實交卷中斷時所有題號停用');
      await page.locator('#daily-panel summary').click(); const panel = page.locator('#daily-panel'); const target = page.locator('#daily-numbers button').filter({ hasText: /^2$/ });
      assert.equal(await panel.evaluate((e) => e.open), true); const before = { position: await page.locator('#daily-position').innerText(), qid: await currentCard(page).getAttribute('data-qid') };
      await target.scrollIntoViewIfNeeded(); const box = await target.boundingBox(); assert.ok(box); await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      assert.equal(await target.isDisabled(), true); assert.equal(await panel.evaluate((e) => e.open), true, '滑鼠點停用題號不收合');
      assert.deepEqual({ position: await page.locator('#daily-position').innerText(), qid: await currentCard(page).getAttribute('data-qid') }, before, '滑鼠點停用題號不跳題');
      // 協調者核可：只解除目標停用，觸發目前真實介面走不到的拒絕防禦路徑。
      await target.evaluate((button) => { button.disabled = false; });
      if (process.env.DAILY_EXAM_FAULT_ROUND3 === 'rejected-close') await target.evaluate((button) => button.addEventListener('click', () => { document.querySelector('#daily-panel').open = false; }, true));
      await target.click(); assert.equal(await panel.evaluate((e) => e.open), true, 'pending 拒絕跳題時不可收合');
      assert.deepEqual({ position: await page.locator('#daily-position').innerText(), qid: await currentCard(page).getAttribute('data-qid') }, before, 'pending 拒絕跳題時目前題目不變');
      assert.equal(await target.evaluate((button) => document.activeElement === button), true, '拒絕後焦點留在被點的題號'); assert.deepEqual(await getDraft(page), pending); assert.deepEqual(await getAttempts(page), attemptsBefore);
      await page.evaluate(() => window.restoreRound3Storage()); await page.locator('#daily-retry').click(); await page.locator('#daily-score').waitFor(); const attempts = await getAttempts(page);
      assert.equal((await getDraft(page)).status, 'submitted'); assert.equal(attempts.length, 50); assert.equal(new Set(attempts.map((a) => a.id)).size, 50); assert.deepEqual(attempts.map((a) => a.id), ids); assert.deepEqual(await page.evaluate(() => window.round3GeneratedIds), ids); assert.deepEqual(attempts, attemptsBefore);
      await page.reload(); await page.locator('#daily-score').waitFor(); assert.deepEqual(await getAttempts(page), attempts, '重載後仍只有原來 50 筆作答');
      return { width: 375, realDisabledClick: true, defensivePath: 'only target disabled removed, then native click', rejectedFocusPreserved: true, beforeRetry: 50, afterRetry: attempts.length, uniqueIds: 50, idsStable: true };
    });
    const round4SummaryBounds = (page) => page.evaluate(() => {
      const summary = document.querySelector('#daily-panel summary').getBoundingClientRect();
      const toolbar = document.querySelector('.daily-toolbar').getBoundingClientRect(); const actions = document.querySelector('.daily-actions').getBoundingClientRect();
      return { summary: { top: summary.top, bottom: summary.bottom }, toolbarBottom: toolbar.bottom, actionsTop: actions.top, scrollY, height: innerHeight };
    });
    const round4Visible = (bounds) => bounds.summary.top >= Math.max(0, bounds.toolbarBottom) && bounds.summary.bottom <= Math.min(bounds.height, bounds.actionsTop);
    const round4Focus = async (page, selector) => {
      try { await page.waitForFunction((selector) => document.activeElement === document.querySelector(selector), selector, { timeout: 3000 }); } catch { /* 保留實際焦點，讓修正前建置也有明確失敗訊息。 */ }
      if (process.env.DAILY_EXAM_FAULT_ROUND4 === 'resize-focus') await page.evaluate(() => document.activeElement.blur());
      const focus = await page.evaluate((selector) => ({ matches: document.activeElement === document.querySelector(selector), tag: document.activeElement.tagName, id: document.activeElement.id, text: document.activeElement.textContent?.trim().slice(0, 40) }), selector);
      assert.equal(focus.matches, true, `第 4 輪焦點須到 ${selector}，實際 ${JSON.stringify(focus)}`); assert.notEqual(focus.tag, 'BODY'); return focus;
    };
    const round4Screenshot = async (page, name) => {
      // 一般截圖工具會先捲到題幹；這裡保留縮放後的位置，才能檢查固定列遮擋。
      const file = resolve(output, `${name}.png`); await page.screenshot({ path: file }); report.screenshots.push(file);
    };
    for (const fault of ['attempts', 'first-draft']) await regression(`regression-round4-grow-pending-${fault}`, async (ctx) => {
      const d = fixture(questions, 1, 50); await seed(ctx, [d]); const page = await ctx.newPage(); await page.setViewportSize({ width: 375, height: 1000 }); await page.clock.install({ time: instant }); await loadDaily(page, base + '/daily/');
      await page.evaluate((fault) => {
        const original = Storage.prototype.setItem; window.restoreRound4Storage = () => { Storage.prototype.setItem = original; };
        window.round4GeneratedIds = []; const uuid = crypto.randomUUID.bind(crypto); crypto.randomUUID = () => { const id = uuid(); window.round4GeneratedIds.push(id); return id; };
        Storage.prototype.setItem = function(key, raw) {
          if (fault === 'attempts' && key === 'ipas-attempts-v1') throw new Error('round4 attempts quota');
          if (fault === 'first-draft' && key === 'ipas-daily-draft-v2' && JSON.parse(raw).booklets.some((d) => d.subject === 1 && d.status === 'submitting')) throw new Error('round4 first submission draft quota');
          return original.call(this, key, raw);
        };
      }, fault);
      await page.locator('#daily-submit').click(); await page.locator('#daily-confirm').click(); await page.locator('#daily-save-error').waitFor(); await assertHiddenResults(page);
      const failedDraft = await getDraft(page); const ids = await page.evaluate(() => window.round4GeneratedIds);
      assert.equal(failedDraft.status, fault === 'attempts' ? 'submitting' : 'open'); assert.equal(ids.length, 50); assert.equal((await getAttempts(page)).length, 0);
      if (fault === 'attempts') assert.deepEqual(failedDraft.submission.attempts.map((a) => a.id), ids);
      else assert.equal(failedDraft.submission, undefined, '首次寫入失敗時 pending 只在記憶體中，不能假設草稿已保存');
      assert.equal(await page.locator('#daily-numbers button:disabled').count(), 50, '有 pending 時所有題號停用'); assert.equal(await page.locator('#daily-numbers [aria-current="step"]').isDisabled(), true);
      const summary = page.locator('#daily-panel summary'); await summary.focus(); assert.equal(await summary.evaluate((e) => document.activeElement === e), true);
      await page.setViewportSize({ width: 1440, height: 1000 }); await round4Screenshot(page, `regression-round4-grow-pending-${fault}`); const focus = await round4Focus(page, '#daily-retry');
      assert.equal(await page.locator('#daily-retry').innerText(), '重試保存'); assert.equal(await page.locator('#daily-panel').evaluate((e) => e.open), true);
      await page.evaluate(() => window.restoreRound4Storage()); await page.locator('#daily-retry').click(); await page.locator('#daily-score').waitFor(); const attempts = await getAttempts(page);
      assert.equal((await getDraft(page)).status, 'submitted'); assert.equal(attempts.length, 50); assert.equal(new Set(attempts.map((a) => a.id)).size, 50); assert.deepEqual(attempts.map((a) => a.id), ids); assert.deepEqual(await page.evaluate(() => window.round4GeneratedIds), ids);
      await page.reload(); await page.locator('#daily-score').waitFor(); assert.deepEqual(await getAttempts(page), attempts, '重試及重載後每題只有 1 筆正式作答');
      return { fault, from: 375, to: 1440, failedDraftStatus: failedDraft.status, focus, beforeRetry: 0, afterRetry: attempts.length, uniqueIds: 50, idsStable: true };
    });
    await regression('regression-round4-grow-current-number', async (ctx) => {
      const d = fixture(questions, 1, 2); d.position = 1; await seed(ctx, [d]); const page = await ctx.newPage(); await page.setViewportSize({ width: 375, height: 1000 }); await page.clock.install({ time: instant }); await loadDaily(page, base + '/daily/');
      const summary = page.locator('#daily-panel summary'); await summary.focus(); assert.equal(await summary.evaluate((e) => document.activeElement === e), true);
      await page.setViewportSize({ width: 1440, height: 1000 }); const focus = await round4Focus(page, '#daily-numbers [aria-current="step"]');
      assert.equal(await page.locator('#daily-numbers [aria-current="step"]').isEnabled(), true); assert.equal(await page.locator('#daily-position').innerText(), '第 2／50 題');
      await round4Screenshot(page, 'regression-round4-grow-current-number'); return { from: 375, to: 1440, focus };
    });
    for (const width of [375, 320]) await regression(`regression-round4-shrink-footer-${width}`, async (ctx) => {
      const d = fixture(questions, 1, 2); d.position = 1; await seed(ctx, [d]); const page = await ctx.newPage(); await page.setViewportSize({ width: 1440, height: 1000 }); await page.clock.install({ time: instant }); await loadDaily(page, base + '/daily/');
      await page.locator('#daily-numbers [aria-current="step"]').evaluate((e) => e.focus({ preventScroll: true }));
      await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
      const before = await page.evaluate(() => ({ scrollY, bottom: scrollY + innerHeight, height: document.documentElement.scrollHeight }));
      assert.ok(before.scrollY > 0 && Math.abs(before.bottom - before.height) <= 1, `前提：已捲到頁尾 ${JSON.stringify(before)}`);
      assert.equal(await page.locator('#daily-numbers [aria-current="step"]').evaluate((e) => document.activeElement === e), true);
      await page.setViewportSize({ width, height: 1000 }); const focus = await round4Focus(page, '#daily-panel summary'); await page.waitForTimeout(100);
      if (process.env.DAILY_EXAM_FAULT_ROUND4 === 'summary-visibility') await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
      const bounds = await round4SummaryBounds(page); await round4Screenshot(page, `regression-round4-shrink-footer-${width}`);
      assert.ok(round4Visible(bounds), `縮到 ${width} 後 summary 須完整位於固定列之間：${JSON.stringify(bounds)}`);
      assert.equal(await page.locator('#daily-panel').evaluate((e) => e.open), false); return { from: 1440, to: width, before, focus, bounds };
    });
    await regression('regression-round4-shrink-visible-no-scroll', async (ctx) => {
      const d = fixture(questions, 1, 2); d.position = 1; await seed(ctx, [d]); const page = await ctx.newPage(); await page.setViewportSize({ width: 1440, height: 1000 }); await page.clock.install({ time: instant }); await loadDaily(page, base + '/daily/');
      // 避免測試工具自動捲到題號，才能驗證原本可見的開關不會造成額外捲動。
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.locator('#daily-numbers [aria-current="step"]').evaluate((e) => e.focus({ preventScroll: true })); const before = await page.evaluate(() => scrollY); assert.equal(before, 0);
      assert.equal(await page.locator('#daily-numbers [aria-current="step"]').evaluate((e) => document.activeElement === e), true);
      await page.setViewportSize({ width: 375, height: 1000 }); const focus = await round4Focus(page, '#daily-panel summary'); await page.waitForTimeout(100);
      if (process.env.DAILY_EXAM_FAULT_ROUND4 === 'visible-scroll') await page.evaluate(() => window.scrollBy({ top: 1, behavior: 'instant' }));
      const bounds = await round4SummaryBounds(page); await round4Screenshot(page, 'regression-round4-shrink-visible-no-scroll');
      assert.ok(round4Visible(bounds), `縮窄後 summary 仍在固定列之間：${JSON.stringify(bounds)}`); assert.equal(bounds.scrollY, before, `summary 已可見時不可捲動：${JSON.stringify({ before, bounds })}`);
      return { from: 1440, to: 375, beforeScrollY: before, afterScrollY: bounds.scrollY, focus, bounds };
    });
    await regression('regression-round4-rejected-noncontinuous-number', async (ctx) => {
      const d = fixture(questions, 1, 1); d.questions = d.questions.slice(0, 5); d.questions[3].choice = 'A'; d.position = 1; await seed(ctx, [d]);
      const page = await ctx.newPage(); await page.setViewportSize({ width: 375, height: 1000 }); await page.clock.install({ time: instant }); await loadDaily(page, base + '/daily/');
      assert.deepEqual((await getDraft(page)).questions.map((q) => Boolean(q.choice)), [true, false, false, true, false]);
      assert.equal(await page.locator('#daily-position').innerText(), '第 2／5 題'); assert.equal(await currentCard(page).locator('input:checked').count(), 0);
      const before = { position: await page.locator('#daily-position').innerText(), qid: await currentCard(page).getAttribute('data-qid') };
      const panel = page.locator('#daily-panel'); await panel.locator('summary').click(); assert.equal(await panel.evaluate((e) => e.open), true);
      const target = page.locator('#daily-numbers button').filter({ hasText: /^4$/ }); assert.equal(await target.isEnabled(), true);
      // 注入誤收合，單獨證明選單斷言不只檢查目前題目。
      if (process.env.DAILY_EXAM_FAULT_ROUND4 === 'rejected-close') await target.evaluate((button) => button.addEventListener('click', () => { document.querySelector('#daily-panel').open = false; }, true));
      await target.click(); assert.deepEqual({ position: await page.locator('#daily-position').innerText(), qid: await currentCard(page).getAttribute('data-qid') }, before, '被拒絕的第 4 題不可改變目前第 2 題');
      assert.equal(await panel.evaluate((e) => e.open), true, '被拒絕的第 4 題不可收合選單'); assert.equal(await panel.locator('summary').getAttribute('aria-expanded'), 'true');
      assert.equal(await target.evaluate((e) => document.activeElement === e), true, '拒絕跳題後焦點留在第 4 題按鈕'); assert.equal((await getAttempts(page)).length, 0);
      await round4Screenshot(page, 'regression-round4-rejected-noncontinuous-number'); return { width: 375, answered: [1, 4], current: 2, clicked: 4, expanded: true, clickedNumberFocused: true };
    });
    // 真實逐題操作、Enter、取消交卷、改答與關閉後重開。
    if (selected("sequential-enter-edit-reopen-backup-back")) {
      const ctx = await context(); const page = await ctx.newPage(); await page.clock.install({ time: instant });
      await loadDaily(page, base + '/daily/?subject=1&position=50'); assert.equal((await getStore(page)).booklets.length, 0); await openFirst(page);
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
    if (selected("small-set-submit-cancel-review-reload")) {
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
    if (selected("submission-storage-fault")) for (const step of [1, 2, 3]) {
      const ctx = await context(); const d = fixture(questions, 1, 50); await seed(ctx, [d]); const page = await ctx.newPage(); await page.clock.install({ time: instant }); await loadDaily(page, base + '/daily/');
      await page.evaluate((step) => {
        const original = Storage.prototype.setItem; let writes = 0;
        window.dailyGeneratedIds = []; const uuid = crypto.randomUUID.bind(crypto); crypto.randomUUID = () => { const id = uuid(); window.dailyGeneratedIds.push(id); return id; };
        Storage.prototype.setItem = function(key, value) { if (key === 'ipas-daily-draft-v2' || key === 'ipas-attempts-v1') { writes++; if (writes === step) throw new Error('test quota'); } return original.call(this, key, value); };
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
    if (selected("submitting-auto-retry")) for (const alreadyWritten of [false, true]) {
      const ctx = await context(); const d = fixture(questions, 1, 50, 'submitting'); await seed(ctx, [d], alreadyWritten ? d.submission.attempts : []);
      const page = await ctx.newPage(); await page.clock.install({ time: instant }); await loadDaily(page, base + '/daily/'); await page.locator('#daily-score').waitFor();
      assert.equal((await getDraft(page)).status, 'submitted'); assert.equal((await getAttempts(page)).length, 50); assert.deepEqual((await getAttempts(page)).map((a) => a.id), d.submission.attempts.map((a) => a.id));
      report.cases.push({ name: 'submitting-auto-retry', alreadyWritten, count: 50, idsStable: true }); await ctx.close();
    }
    // 跨日只續作同一本；交卷後當天可開下一本，另一科保持原資料。
    if (selected('cross-day-subject-explicit-next')) {
      const ctx = await context(); const page = await ctx.newPage(); await page.clock.install({ time: instant }); await loadDaily(page, base + '/daily/'); await openFirst(page);
      await currentCard(page).locator('input[value="B"]').check(); await page.locator('#daily-unsure').click();
      const one = await getDraft(page); await page.clock.setSystemTime(new Date('2026-11-06T04:00:00Z')); await page.reload(); await page.locator('#daily-current:visible').waitFor();
      assert.equal(await page.locator('#daily-open-next').isVisible(), false); assert.equal((await getDraft(page)).id, one.id); assert.deepEqual((await getDraft(page)).assignedQids, one.assignedQids);
      await page.locator('[data-daily-subject="3"]').click(); await page.locator('#daily-empty:visible').waitFor(); assert.equal((await getStore(page)).booklets.length, 1); await openFirst(page);
      const three = await getDraft(page, 3); assert.equal(three.createdDate, '2026-11-06');
      await page.locator('[data-daily-subject="1"]').click(); await page.locator('#daily-date').filter({ hasText: '科目 1' }).waitFor(); assert.equal((await getDraft(page)).id, one.id); assert.equal((await getDraft(page)).questions[0].choice, 'B'); assert.equal((await getDraft(page)).questions[0].unsure, true);
      await page.evaluate(() => { const root = JSON.parse(localStorage.getItem('ipas-daily-draft-v2')); const b = root.booklets.find((b) => b.subject === 1); b.seq++; b.questions.forEach((q) => { q.choice ??= 'A'; }); localStorage.setItem('ipas-daily-draft-v2', JSON.stringify(root)); });
      await page.reload(); await page.locator('#daily-submit:enabled').waitFor(); await page.locator('#daily-submit').click(); await page.locator('#daily-confirm').click(); await page.locator('#daily-score').waitFor();
      await openNext(page); const next = await getDraft(page); assert.notEqual(next.id, one.id); assert.equal(next.createdDate, '2026-11-06'); assert.equal(next.number, 2); assert.equal(next.assignedQids.some((id) => one.assignedQids.includes(id)), false);
      assert.equal((await getDraft(page, 3)).id, three.id); assert.equal((await getStore(page)).booklets.length, 3);
      report.cases.push({ name: 'cross-day-subject-explicit-next', dates: [one.createdDate, three.createdDate], sameDayNext: true, subject3Preserved: true }); await ctx.close();
    }
    // 多頁競爭、匯入不掃描、清除後拒絕舊頁續寫，包括清除後同 seq 新建。
    if (selected("two-tabs-import-clear-recreate")) {
      const ctx = await context(); const first = await ctx.newPage(); await loadDaily(first, base + '/daily/'); await openFirst(first); const second = await ctx.newPage(); await loadDaily(second, base + '/daily/');
      await currentCard(second).locator('input[value="A"]').check(); await first.locator('#daily-error-message').filter({ hasText: '唯讀' }).waitFor();
      assert.equal(await currentCard(first).locator('input:enabled').count(), 0);
      const d = await getDraft(second); const legacy = { id: 'imported', qid: d.questions[1].id, rev: d.questions[1].rev, choice: 'B', correct: true, ts: instant.toISOString(), mode: d.attemptMode, ms: 9 };
      const backupPage = await ctx.newPage(); await backupPage.goto(base + '/wrong-book/'); await backupPage.locator('#import-attempts').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, attempts: [legacy] })) });
      await backupPage.locator('#import-status').filter({ hasText: '新增' }).waitFor();
      const exported = await backupPage.evaluate(async () => (await import('/__test/attempts.js')).exportAttempts());
      await second.locator('#daily-next').click(); assert.equal(await currentCard(second).locator('input:enabled').count(), 4); await currentCard(second).locator('input[value="C"]').check();
      assert.equal((await getDraft(second)).questions[1].legacyAttemptId, undefined);
      await backupPage.evaluate(async () => (await import('/__test/attempts.js')).clearStudyData()); await second.locator('#daily-error-message').filter({ hasText: '唯讀' }).waitFor();
      assert.equal(await second.evaluate(() => localStorage.getItem('ipas-daily-draft-v2')), null);
      const third = await ctx.newPage(); await loadDaily(third, base + '/daily/'); assert.equal((await getStore(third)).booklets.length, 0); await openFirst(third); const replacement = await getDraft(third); assert.notEqual(replacement.id, d.id);
      await second.evaluate(() => document.querySelector('#daily-unsure').click()); assert.equal((await getDraft(third)).id, replacement.id); assert.equal((await getDraft(third)).questions.filter((q) => q.choice).length, 0);
      await backupPage.locator('#import-status').evaluate((e) => { e.textContent = ''; });
      await backupPage.locator('#import-attempts').setInputFiles({ name: 'restored.json', mimeType: 'application/json', buffer: Buffer.from(exported) });
      await backupPage.locator('#import-status').filter({ hasText: '新增' }).waitFor(); assert.equal((await getAttempts(backupPage)).length, 1);
      assert.equal((await getDraft(third)).id, replacement.id); assert.equal((await getDraft(third)).questions.filter((q) => q.choice).length, 0);
      report.cases.push({ name: 'two-tabs-import-clear-recreate', staleReadOnly: true, importedLegacyLocked: false, replacementProtected: true }); await ctx.close();
    }
    // 草稿儲存失敗保留畫面；背景停表與恢復只計可見區段。
    if (selected("save-failure-background-15s")) {
      const ctx = await context(); const page = await ctx.newPage(); await page.clock.install({ time: instant }); await loadDaily(page, base + '/daily/'); await openFirst(page);
      await page.evaluate(() => { const original = Storage.prototype.setItem; window.restoreDailyStorage = () => { Storage.prototype.setItem = original; }; Storage.prototype.setItem = function(key, raw) { if (key === 'ipas-daily-draft-v2') throw new Error('test quota'); return original.call(this, key, raw); }; });
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
    if (selected("conflict-without-storage-event")) {
      const ctx = await context(); const first = await ctx.newPage();
      await first.addInitScript(() => window.addEventListener('storage', (event) => event.stopImmediatePropagation()));
      await loadDaily(first, base + '/daily/'); await openFirst(first); const second = await ctx.newPage(); await loadDaily(second, base + '/daily/');
      const latest = await getDraft(second); await currentCard(first).locator('input[value="A"]').check(); await first.locator('#daily-error-message').filter({ hasText: '唯讀' }).waitFor();
      assert.deepEqual(await getDraft(second), latest); report.cases.push({ name: 'conflict-without-storage-event', rejectedBeforeWrite: true }); await ctx.close();
    }
    // 損壞與未知版本不覆寫、不抽新題；交卷前改版略過，檢討時保持分數。
    if (selected("corrupt-draft-preserved")) for (const raw of ['{', '{"version":9,"booklets":[]}']) {
      const ctx = await context(); await ctx.addInitScript((raw) => { if (location.origin === 'http://127.0.0.1:4333') localStorage.setItem('ipas-daily-draft-v2', raw); }, raw); const page = await ctx.newPage();
      await page.goto(base + '/daily/'); await page.locator('#daily-status').filter({ hasText: '題本損壞或版本未知' }).waitFor(); assert.equal(await page.evaluate(() => localStorage.getItem('ipas-daily-draft-v2')), raw);
      assert.equal(await page.locator('#daily-practice').isVisible(), false); report.cases.push({ name: 'corrupt-draft-preserved', raw }); await ctx.close();
    }
    if (selected("review-revision-score-fixed", "open-revision-skip-no-refill")) for (const submitted of [false, true]) {
      if (!selected(submitted ? 'review-revision-score-fixed' : 'open-revision-skip-no-refill')) continue;
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
    for (const status of ['open', 'submitted']) await regression(`restore-only-from-draft-${status}`, async (ctx) => {
      const d = fixture(questions, 1, status === 'submitted' ? 50 : 0, status); await seed(ctx, [d]);
      await ctx.addInitScript(() => { if (location.origin === 'http://127.0.0.1:4333') localStorage.setItem('ipas-attempts-v1', '{"version":9,"attempts":[]}'); });
      const page = await ctx.newPage(); await page.clock.install({ time: instant }); await loadDaily(page, base + '/daily/');
      assert.equal((await getDraft(page)).id, d.id); assert.equal(await page.locator('#daily-practice').isVisible(), true, '作答紀錄損壞仍可還原既有題本');
      assert.match(await page.locator('#daily-metric-free').innerText(), /無法更新/);
      if (status === 'submitted') await page.locator('#daily-score').waitFor();
      else { await currentCard(page).locator('input[value="D"]').check(); assert.equal((await getDraft(page)).questions[0].choice, 'D'); await assertHiddenResults(page); }
      assert.equal(await page.evaluate(() => localStorage.getItem('ipas-attempts-v1')), '{"version":9,"attempts":[]}');
      return { status, attemptsPreserved: true };
    });
    // 沒有目前題本時，既有歷史不因跨日自動建立新本。
    if (selected('retired-history-explicit-next')) {
      const ctx = await context(); const d = fixture(questions, 1); d.createdDate = '2026-11-01'; d.status = 'retired'; await seed(ctx, [d]);
      const page = await ctx.newPage(); await page.clock.install({ time: instant }); await loadDaily(page, base + '/daily/');
      assert.equal((await getStore(page)).booklets.length, 1); assert.equal((await getDraft(page)).id, d.id); await openNext(page);
      const b = await getDraft(page); assert.equal(b.createdDate, date); assert.equal(b.questions.length, 50); assert.equal(b.number, 2);
      report.cases.push({ name: 'retired-history-explicit-next', total: 50, historyPreserved: true }); await ctx.close();
    }
    if (selected('zero-questions-no-submission', 'zero-candidates-next-day-recovery')) {
      const ctx = await context(); const page = await ctx.newPage(); await page.clock.install({ time: instant });
      let empty = true; await changeCatalog(page, (catalog) => empty ? catalog.filter((q) => q.subject !== 1 || q.source !== 'mock') : catalog);
      await loadDaily(page, base + '/daily/');
      assert.equal(await page.locator('#daily-practice').isVisible(), false); assert.equal(await page.locator('#daily-submit:visible').count(), 0); assert.equal((await getAttempts(page)).length, 0);
      assert.equal(await page.locator('#daily-stock').isVisible(), true); assert.equal(await page.locator('#daily-open-first:visible').count(), 0);
      await page.clock.runFor(16000); await page.reload(); await page.locator('#daily-stock:visible').waitFor(); assert.equal((await getStore(page)).booklets.length, 0);
      if (selected('zero-questions-no-submission')) report.cases.push({ name: 'zero-questions-no-submission', total: 0, bookletCreated: false });
      if (selected('zero-candidates-next-day-recovery')) {
        empty = false; await page.clock.setFixedTime(new Date('2026-11-06T04:00:00Z')); await loadDaily(page, base + '/daily/?subject=1');
        assert.equal((await getStore(page)).booklets.length, 0, '題庫恢復後仍須按鈕開本'); await openFirst(page);
        const restored = await getDraft(page); assert.equal(restored.createdDate, '2026-11-06'); assert.equal(restored.subject, 1); assert.equal(restored.questions.length, 50);
        assert.equal((await getAttempts(page)).length, 0); assert.equal(await page.locator('#daily-practice').isVisible(), true);
        report.cases.push({ name: 'zero-candidates-next-day-recovery', date: restored.createdDate, total: 50, added: 0, explicitOpen: true });
      }
      await ctx.close();
    }
    // 第 2 版空題本保留原本編號，先結束才可開下一本。
    if (selected('existing-empty-booklet-retire-reload')) {
      const ctx = await context(); const d = fixture(questions, 1); d.questions = []; d.position = 0; await seed(ctx, [d]);
      const page = await ctx.newPage(); await page.clock.install({ time: instant }); await loadDaily(page, base + '/daily/');
      assert.equal((await getStore(page)).booklets.length, 1); assert.equal((await getDraft(page)).id, d.id); assert.equal(await page.locator('#daily-retire').isVisible(), true);
      await page.reload(); await page.locator('#daily-retire:visible').waitFor(); assert.equal((await getDraft(page)).id, d.id);
      await page.locator('#daily-retire-book').click(); await page.locator('#daily-open-next:visible').waitFor(); assert.equal((await getStore(page)).booklets.length, 1); assert.equal((await getDraft(page)).status, 'retired');
      await openNext(page); const restored = await getDraft(page); assert.notEqual(restored.id, d.id); assert.equal(restored.createdDate, date); assert.equal(restored.questions.length, 50); assert.equal(restored.number, 2);
      await page.reload(); await page.locator('#daily-position').filter({ hasText: '第 1／50' }).waitFor(); assert.equal((await getDraft(page)).id, restored.id);
      assert.equal((await getAttempts(page)).length, 0); report.cases.push({ name: 'existing-empty-booklet-retire-reload', total: 50, added: 0, historyPreserved: true }); await ctx.close();
    }
    if (selected('all-invalid-explicit-retire-next')) for (const invalid of ['removed', 'revision']) {
      const ctx = await context(); const d = fixture(questions, 1); await seed(ctx, [d]); const page = await ctx.newPage(); await page.clock.install({ time: instant });
      const ids = new Set(d.assignedQids); await changeCatalog(page, (catalog) => invalid === 'removed' ? catalog.filter((q) => !ids.has(q.id)) : catalog.map((q) => ids.has(q.id) ? { ...q, rev: q.rev + 1 } : q));
      await loadDaily(page, base + '/daily/'); const skipped = await getDraft(page);
      assert.equal(skipped.id, d.id); assert.deepEqual(skipped.assignedQids, d.assignedQids); assert.equal(skipped.questions.length, 0); assert.equal(skipped.status, 'open');
      assert.equal(await page.locator('#daily-retire').isVisible(), true); assert.equal(await page.locator('#daily-submit').isDisabled(), true); assert.equal(await page.locator('#daily-open-next:visible').count(), 0);
      await page.locator('#daily-submit').evaluate((button) => button.click()); assert.equal(await page.locator('#daily-dialog[open]').count(), 0);
      await page.clock.runFor(16000); await page.reload(); await page.locator('#daily-retire:visible').waitFor(); assert.equal((await getStore(page)).booklets.length, 1); assert.equal((await getAttempts(page)).length, 0);
      await screenshot(page, `all-${invalid}-before-retire`); await page.locator('#daily-retire-book').click(); await page.locator('#daily-open-next:visible').waitFor();
      const retired = await getDraft(page); assert.equal(retired.id, d.id); assert.equal(retired.status, 'retired'); assert.deepEqual(retired.assignedQids, d.assignedQids); assert.equal((await getAttempts(page)).length, 0);
      await openNext(page); const replaced = await getDraft(page); assert.notEqual(replaced.id, d.id); assert.equal(replaced.createdDate, date); assert.equal(replaced.questions.length, 50);
      assert.equal(replaced.assignedQids.some((id) => ids.has(id)), false, '改版也不能重抽已分配題'); assert.equal((await getStore(page)).booklets.length, 2);
      assert.equal((await getAttempts(page)).length, 0); report.cases.push({ name: 'all-invalid-explicit-retire-next', invalid, assignedPreserved: true, total: 50, added: 0 }); await ctx.close();
    }
    // 同頁修改不會收到 storage，能獨立驗證結束題本前的身份與序號檢查。
    if (selected('all-invalid-retire-conflict')) for (const field of ['id', 'seq']) {
      const ctx = await context(); const d = fixture(questions, 1); await seed(ctx, [d]); const page = await ctx.newPage(); await page.clock.install({ time: instant });
      const ids = new Set(d.assignedQids); await changeCatalog(page, (catalog) => catalog.filter((q) => !ids.has(q.id))); await loadDaily(page, base + '/daily/');
      const latest = await page.evaluate(({ key, field }) => {
        const value = JSON.parse(localStorage.getItem(key)); const b = value.booklets[0];
        if (field === 'seq') b.seq++;
        else { b.id = 'replacement-id'; b.attemptMode = 'booklet:replacement-id:S1'; value.current[1] = b.id; }
        const raw = JSON.stringify(value); localStorage.setItem(key, raw); return raw;
      }, { key: DRAFT, field });
      await page.locator('#daily-retire-book').click(); await page.locator('#daily-error-message').filter({ hasText: '唯讀' }).waitFor();
      assert.equal(await page.evaluate((key) => localStorage.getItem(key), DRAFT), latest); assert.equal((await getAttempts(page)).length, 0);
      report.cases.push({ name: 'all-invalid-retire-conflict', field, replacementProtected: true }); await ctx.close();
    }
    // 2 科 × 4 寬度 × 3 狀態 × 亮暗色，逐一量核可版面的全部門檻。
    if (selected("layout-matrix")) for (const subject of [1, 3]) for (const width of [320, 375, 390, 1440]) for (const theme of ['light', 'dark']) for (const state of ['before', 'complete', 'submitted']) {
      const ctx = await context({ viewport: { width, height: width === 320 ? 700 : 1000 }, colorScheme: theme });
      const d = fixture(questions, subject, state === 'before' ? 31 : 50, state === 'submitted' ? 'submitted' : 'open'); await seed(ctx, [d], d.submission?.attempts ?? []);
      const page = await ctx.newPage(); await page.clock.install({ time: instant }); await loadDaily(page, `${base}/daily/?subject=${subject}`);
      await page.evaluate((theme) => { document.documentElement.dataset.theme = theme; }, theme);
      report.measurements.push(await measure(page, subject, width, theme, state));
      if (state !== 'submitted') await assertHiddenResults(page);
      assert.equal(await page.locator('#daily-numbers button').count(), state === 'before' ? 32 : 50);
      assert.ok((await page.locator('#daily-numbers button').allTextContents()).every((value) => /^\d+$/.test(value)));
      assert.deepEqual(await page.locator('#daily-legend > span').allTextContents(), state === 'submitted' ? ['答對', '答錯', '曾標不確定', '解析不可用'] : ['未答', '已答', '不確定']);
      assert.deepEqual(await page.locator('#daily-numbers button').evaluateAll((buttons) => buttons.map((b) => Number(b.textContent))), Array.from({ length: state === 'before' ? 32 : 50 }, (_, i) => i + 1));
      const states = await page.locator('#daily-numbers button').evaluateAll((buttons) => buttons.map((b) => b.dataset.status));
      if (state === 'before') { assert.equal(states.filter((s) => s === 'unanswered').length, 1); assert.equal(states.at(-1), 'unanswered'); }
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
    if (selected("long-code-keyboard-mobile")) {
      const ctx = await context({ viewport: { width: 320, height: 700 } }); const d = fixture(questions, 3, 50); const long = questions.find((q) => q.id === 'Z-L23302-004');
      d.questions[0] = { id: long.id, rev: long.rev, choice: 'A', unsure: false, ms: 0 }; d.assignedQids = d.questions.map((q) => q.id); await seed(ctx, [d]); const page = await ctx.newPage(); await page.clock.install({ time: instant }); await loadDaily(page, base + '/daily/?subject=3');
      report.extraMeasurements.push(await measure(page, 3, 320, 'light', 'long')); await screenshot(page, '320-long');
      const summary = page.locator('#daily-panel summary'); await summary.focus(); await page.keyboard.press('Enter'); await page.waitForFunction(() => document.querySelector('#daily-panel summary').getAttribute('aria-expanded') === 'true');
      await page.locator('#daily-next').click(); await page.locator('#daily-previous').focus(); await page.keyboard.press('Tab'); assert.equal(await page.locator('#daily-unsure').evaluate((e) => document.activeElement === e), true); await page.keyboard.press('Tab'); assert.equal(await page.locator('#daily-next').evaluate((e) => document.activeElement === e), true);
      report.cases.push({ name: 'long-code-keyboard-mobile', width: 320, overflow: 0 }); await ctx.close();
    }
    // 已遷移題本的不連續作答保留原 ID，交卷只新增未鎖定的 47 題。
    if (selected('legacy-noncontinuous-mode-rev-lock')) {
      const ctx = await context(); const d = fixture(questions, 1); d.origin = 'v1-set'; d.attemptMode = `daily:${date}:S1`;
      const old = [0, 1, 4].map((i) => ({ id: `legacy-${i}`, qid: d.questions[i].id, rev: d.questions[i].rev, choice: 'A', correct: i !== 4, ts: instant.toISOString(), mode: d.attemptMode, ms: 500 }));
      for (const [index, i] of [0, 1, 4].entries()) Object.assign(d.questions[i], { choice: 'A', correct: old[index].correct, ms: 500, legacyAttemptId: old[index].id });
      d.position = 2; await seed(ctx, [d], old); const page = await ctx.newPage(); await page.clock.install({ time: instant });
      await loadDaily(page, base + '/daily/?position=3'); await page.locator('#daily-legacy').waitFor(); assert.equal(await page.locator('#daily-numbers button').count(), 4);
      await page.locator('#daily-previous').click(); assert.equal(await currentCard(page).locator('input:enabled').count(), 0); await page.locator('#daily-unsure').click(); await assertHiddenResults(page);
      assert.equal((await getDraft(page)).questions[0].legacyAttemptId, 'legacy-0'); assert.deepEqual(await getAttempts(page), old);
      await loadDaily(page, base + '/daily/?position=5'); assert.equal(await page.locator('#daily-position').innerText(), '第 5／50 題');
      await page.locator('#daily-next').click(); assert.equal(await page.locator('#daily-position').innerText(), '第 3／50 題');
      const panel = page.locator('#daily-panel'); if (!(await panel.evaluate((e) => e.open))) await panel.evaluate((e) => { e.open = true; });
      await page.locator('#daily-numbers button').filter({ hasText: /^5$/ }).click(); assert.equal(await page.locator('#daily-position').innerText(), '第 3／50 題');
      await page.evaluate(() => { const root = JSON.parse(localStorage.getItem('ipas-daily-draft-v2')); root.booklets[0].seq++; root.booklets[0].questions.forEach((q) => { q.choice ??= 'A'; }); localStorage.setItem('ipas-daily-draft-v2', JSON.stringify(root)); });
      await page.reload(); await page.locator('#daily-submit:enabled').waitFor(); await page.locator('#daily-submit').click(); await page.locator('#daily-confirm').click(); await page.locator('#daily-score').waitFor();
      assert.equal((await getAttempts(page)).length, 50); assert.deepEqual((await getAttempts(page)).slice(0, 3), old);
      report.cases.push({ name: 'legacy-noncontinuous-mode-rev-lock', legacyCount: 3, added: 47, legacyAdded: 0 }); await ctx.close();
    }
    // 其他入口保留即時解析；同列上緣與手機溢出一併量。
    if (selected("instant-official", "instant-quiz", "instant-question")) for (const width of [320, 375, 1440]) {
      const ctx = await context({ viewport: { width, height: 1000 } }); const page = await ctx.newPage();
      await page.goto(base + '/official/'); await page.locator('#official-catalog').waitFor({ state: 'attached' }); await screenshot(page, `official-index-${width}`);
      const qid = questions.find((q) => q.source === 'exam').id;
      for (const [name, path] of [['official', '/official/115-1-S3/'], ['quiz', '/quiz/'], ['question', `/questions/${qid}/`]]) {
        if (!selected(`instant-${name}`)) continue;
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
    if (selected('layout-matrix')) assert.equal(report.measurements.length, 48); assert.equal(report.errors.length, 0);
    assert.ok(report.cases.length + report.faults.length + report.measurements.length + report.newCases.length > 0, 'DAILY_EXAM_ONLY 未符合任何案例');
    const failures = report.newCases.filter((item) => !item.success);
    assert.equal(failures.length, 0, failures.map((item) => `${item.name}: ${item.failure}`).join('\n'));
    report.success = true; report.accessibleHiddenChecks = hiddenChecks; return report;
  } catch (error) { report.failure = String(error.stack ?? error); throw error; }
  finally {
    report.accessibleHiddenChecks = hiddenChecks;
    if (browser) await browser.close(); server.closeAllConnections(); await new Promise((done) => server.close(done));
    report.cleanup = { browserStopped: true, serverStopped: true, port: 4333 };
    await writeFile(resolve(output, 'browser-report.json'), JSON.stringify(report, null, 2));
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = await runDailyExamSmoke(); process.stdout.write(JSON.stringify({ success: report.success, cases: report.cases.length, totalCases: report.cases.length + report.measurements.length + report.faults.length, newCaseNames: report.newCases.map((item) => item.name), round3CaseNames: report.newCases.filter((item) => item.name.startsWith('regression-round3-')).map((item) => item.name), round4CaseNames: report.newCases.filter((item) => item.name.startsWith('regression-round4-')).map((item) => item.name), measurements: report.measurements.length, screenshots: report.screenshots.length, faults: report.faults, errors: report.errors, cleanup: report.cleanup }, null, 2) + '\n');
}
