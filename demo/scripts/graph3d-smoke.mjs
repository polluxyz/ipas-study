/** 真HTTP操作正式路由；注入的Canvas觀測只存在隔離瀏覽器，不進產品。 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { auditGraph } from './graph3d-audit.mjs';
import { readBuildReceipt, watchBuildResponses, routeLocalOnly, freshOutput } from './rollout-smoke.mjs';
const root = resolve(import.meta.dirname, '../..');
const role = (name) => `[data-graph3d] [data-role="${name}"]`;
const graphUrl = (url) => new URL(url).pathname.startsWith('/graph/');
const frames = (page) => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
export function adjacent(data, selected, hops, body = false) {
  const ids = new Set([selected]); let frontier = [selected]; const edges = [...data.formalEdges, ...(body ? data.bodyEdges : [])];
  for (let i = 0; i < hops; i++) { const next = []; for (const e of edges) for (const [a, b] of [[e.source, e.target], [e.target, e.source]]) if (frontier.includes(a) && !ids.has(b)) { ids.add(b); next.push(b); } frontier = next; }
  return { ids: [...ids].sort(), edges: edges.filter((e) => ids.has(e.source) && ids.has(e.target)).map((e) => e.id).sort() };
}
function selectedProjection(data, ids, id, width, height, yaw) {
  const centers = new Map(), points = new Map();
  for (const subject of [1, 3]) { const units = data.units.filter((u) => u.subject === subject); units.forEach((u, i) => { const a = i / units.length * Math.PI * 2 - .9; centers.set(u.id, [(subject === 1 ? -355 : 355) + Math.cos(a * 2) * 90, Math.sin(a) * 360, Math.cos(a) * 360]); }); }
  for (const u of data.units) { const nodes = data.concepts.filter((n) => n.owner === u.id).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0); nodes.forEach((n, i) => { const z = 1 - 2 * ((i + .5) / nodes.length), r = Math.sqrt(1 - z * z), a = i * 2.399963229728653, radius = 70 + Math.sqrt(nodes.length) * 5, c = centers.get(u.id); points.set(n.id, [c[0] + radius * r * Math.cos(a), c[1] + radius * r * Math.sin(a), c[2] + radius * z]); }); }
  const list = ids.map((n) => points.get(n)), min = [0, 1, 2].map((i) => Math.min(...list.map((p) => p[i]))), max = [0, 1, 2].map((i) => Math.max(...list.map((p) => p[i]))), center = min.map((v, i) => (v + max[i]) / 2), extent = Math.max(220, ...max.map((v, i) => v - min[i])) * 1.26;
  const [x, y, z] = points.get(id).map((v, i) => v - center[i]), a = x * Math.cos(yaw) + z * Math.sin(yaw), b = -x * Math.sin(yaw) + z * Math.cos(yaw), c = y * Math.cos(-.13) - b * Math.sin(-.13), d = y * Math.sin(-.13) + b * Math.cos(-.13), scale = Math.min(width, height) * .84 / extent, perspective = extent * 2.5 / (extent * 2.5 + d);
  return { x: width / 2 + a * scale * perspective, y: height / 2 + c * scale * perspective };
}
export function instrument() {
  const trace = { draws: 0, frame: [], samples: [], persisted: [], failures: [], fetches: [], aborted: 0, dataStart: 0, firstInteractive: null, reopenStart: 0, reopens: [] }; window.__g3QA = trace;
  window.addEventListener('pageshow', (e) => trace.persisted.push(e.persisted));
  const originalFetch = window.fetch; window.fetch = function(input, init) { const graph = String(input).includes('/graph/'); if (graph) { trace.fetches.push(String(input)); init?.signal?.addEventListener('abort', () => trace.aborted++); } return originalFetch.call(this, input, init).then((response) => { if (graph) { response.json = async function() { const bytes = await this.arrayBuffer(); trace.dataStart = performance.now(); return JSON.parse(new TextDecoder().decode(bytes)); }; } return response; }); };
  document.addEventListener('click', (event) => { const summary = event.target.closest('[data-graph3d]>summary'); if (summary && !summary.parentElement.open && trace.draws) trace.reopenStart = performance.now(); }, true);
  const proto = CanvasRenderingContext2D.prototype, originals = {}; let path = [];
  for (const method of ['clearRect', 'beginPath', 'arc', 'moveTo', 'lineTo', 'fill', 'stroke']) {
    const original = proto[method]; originals[method] = original; proto[method] = function(...args) { if (this.canvas.matches('[data-role=canvas]')) { if (method === 'clearRect') { trace.draws++; trace.frame = []; } if (method === 'beginPath') path = []; if (['arc', 'moveTo', 'lineTo'].includes(method)) path.push([method, ...args]); if (method === 'fill' || method === 'stroke') trace.frame.push({ method, path: path.map((p) => [...p]), alpha: this.globalAlpha, color: method === 'fill' ? this.fillStyle : this.strokeStyle }); } return original.apply(this, args); };
  }
  window.__g3DisableCanvasCapture = () => { for (const [method, original] of Object.entries(originals)) proto[method] = original; };
  new PerformanceObserver((list) => { for (const e of list.getEntries()) if (e.name === 'graph3d-draw') { trace.samples.push(e.duration); if (trace.firstInteractive === null && trace.dataStart) trace.firstInteractive = e.startTime + e.duration - trace.dataStart; if (trace.reopenStart) { trace.reopens.push(e.startTime + e.duration - trace.reopenStart); trace.reopenStart = 0; } } }).observe({ entryTypes: ['measure'] });
}
async function ready(page) { await page.waitForFunction(() => !document.querySelector('[data-role=interactive]').hidden); await frames(page); }
async function visibleIds(page) { await page.locator(role('list')).evaluate((list) => list.closest('details').open = true); await frames(page); return (await page.locator(`${role('list')} li>a`).evaluateAll((links) => links.map((a) => new URL(a.href).pathname.split('/')[2]))).sort(); }
async function trace(page) { return page.evaluate(() => structuredClone(window.__g3QA)); }
async function nativeTabTo(page, target, max = 900) { await target.evaluate((el) => el.dataset.qaTarget = 'current'); for (let i = 0; i < max; i++) { await page.keyboard.press('Tab'); if (await page.evaluate(() => document.activeElement?.getAttribute('data-qa-target') === 'current')) { await target.evaluate((el) => delete el.dataset.qaTarget); return i + 1; } } throw new Error('原生Tab無法到達文字入口'); }
async function shot(page, output, name) { await page.screenshot({ path: resolve(output, name), fullPage: false }); }
async function historyBack(page, target) { await page.evaluate(() => history.back()); await page.waitForFunction((url) => location.href === url, target); await frames(page); }
export function bfcacheCompletion(cases) {
  const unverified = ['bfcache', 'bfcache-pending', 'bfcache-retryExhausted'].filter((name) => cases[name]?.persisted !== true).map((name) => ({ name, status: '未驗證', reason: '沒有實際pageshow.persisted=true證據' }));
  return { completed: unverified.length === 0, outcome: unverified.length ? 'partial-unverified' : 'passed', unverified };
}
export async function main() {
  const base = new URL(process.env.DEMO_URL ?? 'http://127.0.0.1:4336').origin; assert.equal(new URL(base).hostname, '127.0.0.1');
  assert.ok(process.env.SMOKE_OUTPUT, '請指定獨立SMOKE_OUTPUT'); const output = await freshOutput(resolve(process.env.SMOKE_OUTPUT));
  const { report: audit, data } = await auditGraph(output), binding = process.env.BUILD_RECEIPT ? await readBuildReceipt() : null;
  const report = { reportKind: 'full-site-3d-v1', sha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), buildSha: binding?.receipt.sha ?? data.head, receiptDigest: binding?.receiptDigest ?? null, head: data.head, sourceHash: data.sourceHash, assetSha256: '', conceptIds: data.concepts.map((n) => n.id).sort(), unitIds: data.units.map((u) => u.id).sort(), edgeIds: data.formalEdges.map((e) => e.id).sort(), formalByType: audit.formalByType, inlinePanels: audit.pages.length, browserErrors: [], externalRequests: [], assetFailures: [], cases: {}, widths: [], performance: [], budgets: audit.budgets, completed: false, buildResponses: [] };
  const browser = await chromium.launch({ headless: true, ignoreDefaultArgs: ['--disable-back-forward-cache'], ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
  report.browser = browser.version(); report.bfcacheLaunch = '移除Playwright的--disable-back-forward-cache；只以pageshow.persisted=true算命中';
  report.environment = { platform: process.platform, architecture: process.arch, node: process.version, dpr: 1, touch: 'Chromium/CDP模擬；不是實體手機' };
  report.measurement = '同主機新隔離context，冷共享URL；資產bytes到齊後開始計解碼/JSON解析/驗版/鄰接/DOM/首圖。draw以15暖機+120逐影格視角變化計p95，取樣前還原Canvas方法，保留PerformanceObserver。';
  const contexts = [], finishes = [];
  const context = async (options = {}, fault = false) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 1, serviceWorkers: 'block', ...options }); contexts.push(ctx);
    await ctx.addInitScript(instrument);
    ctx.on('page', (p) => p.on('pageerror', (e) => report.browserErrors.push(e.message)));
    ctx.on('request', (r) => { if (!r.url().startsWith(base) && !r.url().startsWith('data:')) report.externalRequests.push(r.url()); });
    if (binding && !fault) { await routeLocalOnly(ctx, base, report.externalRequests, report.assetFailures); finishes.push(watchBuildResponses(ctx, binding, base)); }
    return ctx;
  };
  try {
    assert.equal(report.browser, '156.0.8078.4', '正式r2量測須用固定Chromium156.0.8078.4');
    const ctx = await context(), page = await ctx.newPage();
    await page.goto(`${base}/concepts/cnn/`); await page.waitForTimeout(5000);
    assert.equal((await trace(page)).fetches.length, 0); assert.equal(await page.locator('[data-graph3d]').getAttribute('open'), null); report.cases.collapsedZeroFetch = true;
    await page.locator('[data-graph3d]>summary').click(); await ready(page); assert.equal((await trace(page)).fetches.length, 1);
    assert.deepEqual(await visibleIds(page), adjacent(data, 'cnn', 1).ids); assert.equal(await page.locator(role('body')).isChecked(), false); report.cases.bodyDefaultOff = true;
    await page.locator(`${role('detail')} > details`).first().locator('summary').first().click();
    const direct = data.formalEdges.filter((edge) => edge.source === 'cnn' || edge.target === 'cnn'); await page.waitForFunction((n) => document.querySelector('[data-role=detail]>details').querySelectorAll('article').length === n, direct.length); const cards = await page.locator(`${role('detail')} > details`).first().locator('article').allTextContents(); assert.equal(cards.length, direct.length);
    for (let i = 0; i < direct.length; i++) { assert.ok(cards[i].includes(data.concepts.find((n) => n.id === direct[i].source).title)); assert.ok(cards[i].includes(data.concepts.find((n) => n.id === direct[i].target).title)); if (direct[i].note) assert.ok(cards[i].includes(direct[i].note)); for (const source of direct[i].sources) assert.ok(cards[i].includes(source.replace(/^guide-(\d):/, '指引科$1 p.'))); }
    report.cases.exactRelationCards = true;
    await page.locator(role('hops')).selectOption('2'); await frames(page); assert.deepEqual(await visibleIds(page), adjacent(data, 'cnn', 2).ids); report.cases.exactNeighborhood = true;
    await page.locator(role('body')).check(); await frames(page); assert.deepEqual(await visibleIds(page), adjacent(data, 'cnn', 2, true).ids); assert.equal((await trace(page)).frame.filter((p) => p.method === 'fill' && p.color === '#849389' && p.path.some((v) => v[0] === 'lineTo')).length, 0); await page.locator(role('body')).uncheck(); report.cases.bodyOptIn = true;
    const centerBefore = await page.locator(role('center')).textContent();
    await page.locator(`${role('list')} li button`).first().evaluate((button) => button.closest('details').open = true);
    await page.locator(`${role('list')} li button`).first().click(); assert.equal(await page.locator(role('center')).textContent(), centerBefore); assert.equal(await page.locator(role('detail-title')).evaluate((h) => h === document.activeElement), true); report.cases.inspectionSeparate = true;
    const readingKeys = await page.evaluate(() => Object.keys(localStorage)); await page.locator('[data-reading-toggle=cnn] button').click(); assert.equal(await page.locator('[data-reading-toggle=cnn] button').getAttribute('aria-pressed'), 'true');
    await page.locator(role('canvas')).scrollIntoViewIfNeeded(); await frames(page); const readingBox = await page.locator(role('canvas')).boundingBox(), readingPoint = selectedProjection(data, adjacent(data, 'cnn', 2).ids, 'cnn', readingBox.width, readingBox.height, .3);
    const readingFrame = (await trace(page)).frame, readingArc = readingFrame.find((p) => p.method === 'fill' && p.path.length === 1 && p.path[0][0] === 'arc' && Math.abs(p.path[0][1] - readingPoint.x) < 1 && Math.abs(p.path[0][2] - readingPoint.y) < 1); assert.ok(readingArc); assert.ok(readingFrame.some((p) => p.method === 'stroke' && p.path.length === 1 && p.path[0][0] === 'arc' && Math.abs(p.path[0][1] - readingPoint.x) < 1 && Math.abs(p.path[0][2] - readingPoint.y) < 1 && p.path[0][3] > readingArc.path[0][3] + 2)); assert.deepEqual(await page.evaluate((before) => Object.keys(localStorage).filter((key) => !before.includes(key)), readingKeys), ['ipas-reading-v1']); report.cases.readingInterface = true;
    await page.locator(`${role('detail')} button`).filter({ hasText: '以此概念為中心' }).click(); assert.notEqual(await page.locator(role('center')).textContent(), centerBefore); await page.locator('[data-action=home]').click(); assert.match(await page.locator(role('center')).textContent(), /卷積神經網路/); report.cases.changeCenterAndHome = true;
    for (let i = 0; i < 10; i++) { await page.locator('[data-graph3d]>summary').click(); await frames(page); const draws = (await trace(page)).draws; await frames(page); assert.equal((await trace(page)).draws, draws); await page.locator('[data-graph3d]>summary').click(); await frames(page); }
    assert.equal((await trace(page)).fetches.length, 1); report.cases.cacheReopen = true; report.cacheReopenMs = (await trace(page)).reopens; assert.equal(report.cacheReopenMs.length, 10); assert.ok(Math.max(...report.cacheReopenMs) <= 100);
    const href = await page.locator(role('map-link')).getAttribute('href'); assert.equal(new URL(href, base).searchParams.get('selected'), 'cnn');
    await page.locator(role('map-link')).click(); await ready(page); assert.equal(new URL(page.url()).pathname, '/map/'); assert.deepEqual(await visibleIds(page), adjacent(data, 'cnn', 2).ids); report.cases.realMapLink = true;
    await page.locator(role('unit')).selectOption(data.concepts.find((n) => n.id === 'cnn').owner); assert.equal(new URL(page.url()).searchParams.has('selected'), false); report.cases.shareExit = true;
    const boundaryOn = await visibleIds(page); await page.locator(role('outside')).uncheck(); const boundaryOff = await visibleIds(page); assert.ok(boundaryOff.length < boundaryOn.length); assert.ok(boundaryOff.every((id) => data.concepts.find((n) => n.id === id).codes.includes(data.concepts.find((n) => n.id === 'cnn').owner))); report.cases.outsideBoundary = true;
    await page.locator(role('outside')).check(); await page.locator(role('hops')).selectOption('0'); await page.locator(role('unit')).selectOption('all');
    for (const subject of ['1', '3']) { await page.locator(role('subject')).selectOption(subject); assert.deepEqual(await visibleIds(page), data.concepts.filter((n) => n.subjects.includes(Number(subject))).map((n) => n.id).sort()); }
    await page.locator(role('subject')).selectOption('all');
    for (const unit of data.units) { await page.locator(role('unit')).selectOption(unit.id); assert.deepEqual(await visibleIds(page), data.concepts.filter((n) => n.codes.includes(unit.id)).map((n) => n.id).sort()); }
    await page.locator(role('unit')).selectOption('all'); report.cases.allScopes = true;
    for (const type of ['is_a', 'part_of', 'requires', 'mitigates', 'contrasts']) { const input = page.locator(`[data-type][value=${type}]`); await input.uncheck(); const number = Number((await page.locator(role('count')).textContent()).match(/· (\d+)條正式/)[1]); assert.equal(number, data.formalEdges.filter((e) => e.type !== type).length); await input.check(); }
    report.cases.fiveTypes = true;
    await page.locator(role('mode')).selectOption('unit'); await frames(page); assert.equal(await page.locator(role('body')).isDisabled(), true); await page.locator(role('mode')).selectOption('concept'); report.cases.aggregate = true;
    const assetResponse = await ctx.request.get(`${base}${await page.locator('[data-graph3d]').getAttribute('data-url')}`); const assetBytes = await assetResponse.body(); report.assetSha256 = createHash('sha256').update(assetBytes).digest('hex'); assert.deepEqual(JSON.parse(assetBytes), data);
    await page.locator(role('search')).fill('cnn'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); assert.match(await page.locator(role('detail-title')).textContent(), /卷積/); report.cases.searchKeyboard = true;
    await page.locator(role('hops')).selectOption('2');
    const canvas = page.locator(role('canvas')); await canvas.scrollIntoViewIfNeeded(); await frames(page); const box = await canvas.boundingBox();
    const before = await trace(page); await page.mouse.move(box.x + box.width * .45, box.y + box.height * .5); await page.mouse.down(); await page.mouse.move(box.x + box.width * .45 + 60, box.y + box.height * .5, { steps: 6 }); await page.mouse.up(); await frames(page); const after = await trace(page); assert.notDeepEqual(after.frame, before.frame);
    const selected = after.frame.find((p) => p.method === 'fill' && p.path.length === 1 && p.path[0][0] === 'arc' && p.path[0][3] === 7), expectedDrag = selectedProjection(data, adjacent(data, 'cnn', 2).ids, 'cnn', box.width, box.height, .3 - 60 * .008); assert.ok(selected); assert.ok(Math.abs(selected.path[0][1] - expectedDrag.x) < 1 && Math.abs(selected.path[0][2] - expectedDrag.y) < 1, '真右拖投影必須等於負yaw方向'); report.cases.rightDrag = true;
    await canvas.focus(); const keyboardBefore = (await trace(page)).draws; await page.keyboard.press('ArrowRight'); await frames(page); assert.ok((await trace(page)).draws > keyboardBefore); await page.keyboard.press('+'); await frames(page); await page.keyboard.press('Home'); await frames(page); report.cases.keyboardCamera = true;
    const hoverArcs = (await trace(page)).frame.filter((p) => p.method === 'fill' && p.path.length === 1 && p.path[0][0] === 'arc'); assert.ok(hoverArcs.length);
    let hit = false;
    for (const arc of hoverArcs) { const [, x, y] = arc.path[0]; if (x < 8 || x > box.width - 8 || y < 8 || y > box.height - 8) continue; await page.mouse.move(box.x + x, box.y + y); if (await page.locator(role('tooltip')).isVisible()) { const tooltip = await page.locator(role('tooltip')).textContent(); assert.match(tooltip, /直接正式關係/); if (!Number(tooltip.match(/(\d+) 條直接正式關係/)[1])) continue; hit = true; await frames(page); const painted = (await trace(page)).frame; assert.ok(painted.some((p) => p.alpha === 1 && p.method === 'stroke')); assert.ok(painted.some((p) => p.alpha === .12 && p.method === 'fill')); break; } }
    assert.ok(hit, '真滑鼠必須命中節點提示'); await page.mouse.move(box.x - 10, box.y - 10); assert.equal(await page.locator(role('tooltip')).isVisible(), false); report.cases.hoverRestoresSelection = true;
    const paints = (await trace(page)).frame; assert.ok(paints.some((p) => p.method === 'fill' && p.path.filter((v) => v[0] === 'lineTo').length === 2 && p.alpha === .35)); report.cases.faintArrows = true;
    const inspectScroll = await page.evaluate(() => scrollY); const nodeArc = paints.find((p) => p.method === 'fill' && p.path[0]?.[0] === 'arc'); await page.mouse.click(box.x + nodeArc.path[0][1], box.y + nodeArc.path[0][2]); assert.equal(await page.evaluate(() => scrollY), inspectScroll); report.cases.canvasNoScroll = true;
    await shot(page, output, 'map-1440.png');
    for (const width of [320, 375, 1440]) {
      await page.setViewportSize({ width, height: 950 }); await page.goto(`${base}/concepts/cnn/?selected=cnn&hops=2`); await ready(page); await page.locator(role('canvas')).scrollIntoViewIfNeeded(); await frames(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth); assert.equal(overflow, 0); report.widths.push({ width, overflow }); await shot(page, output, `cnn-${width}.png`);
    }
    await page.setViewportSize({ width: 320, height: 950 }); await page.goto(`${base}/concepts/cnn/?selected=cnn&hops=2`); await ready(page);
    await page.locator(role('list')).evaluate((list) => list.closest('details').open = true); const count = await page.locator(`${role('list')} li button`).count(); let tabs = 0;
    for (let i = 0; i < count; i++) { tabs += await nativeTabTo(page, page.locator(`${role('list')} li button`).nth(i)); await page.keyboard.press('Enter'); const focus = await page.locator(role('detail-title')).evaluate((h) => ({ focused: document.activeElement === h, top: h.getBoundingClientRect().top, bottom: h.getBoundingClientRect().bottom })); assert.equal(focus.focused, true); assert.ok(focus.top >= 0 && focus.bottom <= 950); }
    report.cases.visibleKeyboardFocus = { concepts: count, tabs }; await shot(page, output, 'keyboard-detail-320.png');
    // 故障案例各使用新文件，圖資產保持未快取。
    const moduleFault = await context({}, true), mf = await moduleFault.newPage(); let moduleFailed = true, moduleRequests = 0;
    await moduleFault.route('**/*graph3d-client*.js', (route) => { moduleRequests++; return moduleFailed ? route.abort('failed') : route.continue(); });
    await mf.goto(`${base}/concepts/cnn/`); await mf.locator('[data-graph3d]>summary').click(); await mf.waitForFunction(() => !document.querySelector('[data-role=reload]').hidden); assert.equal(await mf.locator(role('retry')).isVisible(), false); assert.ok(await mf.locator(`${role('fallback')} a`).count() > 0); const moduleBefore = moduleRequests; moduleFailed = false;
    await Promise.all([mf.waitForNavigation({ waitUntil: 'load' }), mf.locator(role('reload')).click()]); await mf.locator('[data-graph3d]>summary').click(); await ready(mf); assert.ok(moduleRequests > moduleBefore); report.cases.moduleReload = true; await moduleFault.close();
    for (const failure of ['404', 'offline', 'invalid-json', 'invalid-format', 'head', 'sourceHash', 'format']) {
      const fault = await context({}, true), p = await fault.newPage(); let requests = 0;
      if (failure !== 'offline') await fault.route('**/graph/*.json', async (route) => { requests++; if (failure === '404') return route.fulfill({ status: 404, body: 'missing' }); if (failure === 'invalid-json') return route.fulfill({ status: 200, contentType: 'application/json', body: '{' }); const bad = failure === 'invalid-format' ? {} : { ...data, [failure]: failure === 'format' ? 9 : 'wrong' }; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(bad) }); });
      p.on('request', (r) => { if (failure === 'offline' && graphUrl(r.url())) requests++; }); await p.goto(`${base}/concepts/cnn/`); assert.equal((await trace(p)).fetches.length, 0);
      if (failure === 'offline') {
        // Starlight在idle才匯入搜尋；依r3先等必要頁面資產，不能把搜尋失敗當圖失敗。
        await p.waitForFunction(() => !!document.querySelector('#starlight__search input'));
        await p.evaluate(async () => { await document.fonts.ready; });
        await p.evaluate((url) => import(url).then(() => undefined), Object.keys(audit.chunks).find((url) => url.includes('graph3d-client')));
        assert.equal((await trace(p)).fetches.length, 0); await fault.setOffline(true);
      }
      await p.locator('[data-graph3d]>summary').click(); await p.waitForFunction(() => !document.querySelector('[data-role=retry]').hidden); assert.equal(await p.locator(role('interactive')).isVisible(), false); assert.ok(await p.locator(`${role('fallback')} a`).count() > 0); assert.ok(await p.locator('#concept-body').count());
      await p.locator(role('retry')).click(); await p.waitForTimeout(150); assert.equal(await p.locator(role('retry')).isDisabled(), true); assert.equal(requests, 2); await p.locator('[data-graph3d]>summary').click(); await p.locator('[data-graph3d]>summary').click(); await p.waitForTimeout(100); assert.equal(requests, 2); report.cases[`failure-${failure}`] = { requests, fallback: true, retryLimit: true }; await fault.close();
    }
    const noCanvas = await context({}, true), nc = await noCanvas.newPage(); await nc.addInitScript(() => { const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function(...args) { return this.matches('[data-role=canvas]') ? null : original.apply(this, args); }; }); await nc.goto(`${base}/concepts/cnn/?selected=cnn&hops=2`); await ready(nc); assert.equal(await nc.locator(role('chart')).isVisible(), false); assert.ok((await visibleIds(nc)).length > 0); assert.equal(await nc.locator(role('detail-title')).textContent(), data.concepts.find((n) => n.id === 'cnn').title); report.cases.canvasFallback = true; await noCanvas.close();
    const noJs = await context({ javaScriptEnabled: false }, true), nj = await noJs.newPage(); await nj.goto(`${base}/map/`); assert.equal(await nj.locator('[data-catalog-id]').count(), data.concepts.length); await nj.goto(`${base}/concepts/cnn/`); assert.ok(await nj.locator('#concept-body').count()); assert.ok(await nj.locator(`${role('fallback')} a`).count()); report.cases.noJsFallback = true; await noJs.close();
    const clientModule = Object.keys(audit.chunks).find((url) => url.includes('graph3d-client')); assert.ok(clientModule);
    for (const scenario of ['twoConsumers', 'freshAfterAbort']) {
      const fixture = await context({}, true), p = await fixture.newPage(); let release; const gate = new Promise((done) => release = done); let requests = 0;
      await fixture.route('**/graph/*.json', async (route) => { const n = ++requests; if (n === 1) await gate; await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) }).catch(() => {}); });
      await p.goto(`${base}/concepts/cnn/`);
      await p.evaluate(async ({ clientModule, scenario }) => {
        const { mountGraph } = await import(clientModule), original = document.querySelector('[data-graph3d]'), one = original.cloneNode(true), two = original.cloneNode(true); original.remove(); document.body.append(one, two); one.open = true; two.open = true;
        const first = mountGraph(one); first.open(); window.__g3Fixture = { first, one, two, mountGraph };
        if (scenario === 'twoConsumers') { const second = mountGraph(two); second.open(); window.__g3Fixture.second = second; }
      }, { clientModule, scenario });
      await p.waitForFunction(() => window.__g3QA.fetches.length === 1); await p.evaluate(() => { window.__g3Fixture.first.destroy(); window.__g3Fixture.one.remove(); });
      if (scenario === 'twoConsumers') { assert.equal((await trace(p)).aborted, 0); release(); }
      else { assert.equal((await trace(p)).aborted, 1); await p.evaluate(() => { const f = window.__g3Fixture; f.second = f.mountGraph(f.two); f.second.open(); }); }
      await ready(p); assert.equal(requests, scenario === 'twoConsumers' ? 1 : 2); if (scenario === 'freshAfterAbort') release(); await frames(p); assert.equal(await p.locator('[data-graph3d]').count(), 1); report.cases[scenario] = { requests, aborted: (await trace(p)).aborted, remainingReady: true }; await fixture.close();
    }
    // 延遲回應：收合不可中止；卸載最後持有人必須中止。
    for (const action of ['collapse', 'unmount']) {
      const delayed = await context({}, true), p = await delayed.newPage(); let release; const gate = new Promise((r) => release = r); let requests = 0;
      await delayed.route('**/graph/*.json', async (route) => { requests++; await gate; await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) }).catch(() => {}); }); await p.goto(`${base}/concepts/cnn/`); await p.locator('[data-graph3d]>summary').click(); await p.waitForFunction(() => window.__g3QA.fetches.length === 1);
      if (action === 'collapse') await p.locator('[data-graph3d]>summary').click(); else await p.locator('[data-graph3d]').evaluate((node) => node.remove()); const before = await trace(p); release(); await p.waitForTimeout(250); const after = await trace(p); assert.equal(after.draws, before.draws); assert.equal(after.aborted, action === 'unmount' ? 1 : 0);
      if (action === 'collapse') { assert.equal(await p.locator('[data-graph3d]').getAttribute('open'), null); await p.locator('[data-graph3d]>summary').click(); await ready(p); assert.equal(requests, 1); }
      report.cases[action] = { aborted: after.aborted, lateDraws: after.draws - before.draws, requests }; await delayed.close();
    }
    // 觸控為Chromium模擬，不宣稱實體手機。
    const mobile = await context({ viewport: { width: 375, height: 950 }, hasTouch: true, isMobile: true }), mp = await mobile.newPage(); await mp.goto(`${base}/concepts/cnn/?selected=cnn&hops=2`); await ready(mp); await mp.locator(role('canvas')).scrollIntoViewIfNeeded();
    const cdp = await mobile.newCDPSession(mp), mb = await mp.locator(role('canvas')).boundingBox(); const start = { x: mb.x + mb.width * .4, y: mb.y + mb.height * .5 };
    assert.equal(await mp.locator(role('canvas')).evaluate((c) => getComputedStyle(c).touchAction), 'pan-y');
    const centerText = await mp.locator(role('center')).textContent(), firstTitle = await mp.locator(role('detail-title')).textContent(); let tapped = false;
    for (const p of (await trace(mp)).frame.filter((p) => p.method === 'fill' && p.path[0]?.[0] === 'arc' && p.path[0][3] < 7)) { const [, x, y] = p.path[0]; if (x < 10 || y < 10 || x > mb.width - 10 || y > mb.height - 10) continue; await mp.touchscreen.tap(mb.x + x, mb.y + y); if (await mp.locator(role('detail-title')).textContent() !== firstTitle) { tapped = true; break; } }
    assert.ok(tapped, '預設單指捲動模式仍可短點選'); assert.equal(await mp.locator(role('center')).textContent(), centerText); report.cases.touchShortTap = true;
    await mp.locator('[data-action=touch]').tap(); await mp.locator(role('canvas')).scrollIntoViewIfNeeded(); const gestureBox = await mp.locator(role('canvas')).boundingBox(); start.x = gestureBox.x + gestureBox.width * .4; start.y = gestureBox.y + gestureBox.height * .5;
    const touchBefore = (await trace(mp)).frame; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] }); for (let i = 1; i <= 5; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + i * 9, y: start.y + i * 3 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await frames(mp); assert.notDeepEqual((await trace(mp)).frame, touchBefore);
    const two = [{ x: start.x - 20, y: start.y }, { x: start.x + 20, y: start.y }], pinchBefore = (await trace(mp)).frame, detailBeforeCancel = await mp.locator(role('detail-title')).textContent(); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: two }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x - 50, y: start.y }, { x: start.x + 50, y: start.y }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await frames(mp); assert.notDeepEqual((await trace(mp)).frame, pinchBefore); assert.equal(await mp.locator(role('detail-title')).textContent(), detailBeforeCancel); assert.equal(await mp.locator(role('tooltip')).isVisible(), false); report.cases.touchEmulated = true; await shot(mp, output, 'touch-375.png');
    const scrollBefore = await mp.evaluate(() => scrollY); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 10, y: 650 }] }); for (let i = 1; i <= 5; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 10, y: 650 - i * 30 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await frames(mp); assert.ok(await mp.evaluate(() => scrollY) > scrollBefore); report.cases.touchOutsideScroll = true;
    // 實際返回；只有persisted=true才記BFCache通過。
    const backCtx = await context({}, true), bp = await backCtx.newPage(); await bp.goto(`${base}/concepts/cnn/?selected=cnn&hops=2`); await ready(bp); const restoreUrl = bp.url(); await bp.locator(`${role('detail')} > a`).click(); await bp.waitForLoadState(); await historyBack(bp, restoreUrl); await ready(bp); report.cases.bfcache = { persisted: (await trace(bp)).persisted.at(-1), fetchesInRestoredDocument: (await trace(bp)).fetches.length }; if (report.cases.bfcache.persisted) assert.equal(report.cases.bfcache.fetchesInRestoredDocument, 1); await backCtx.close();
    for (const scenario of ['pending', 'retryExhausted']) {
      const back = await context({}, true), p = await back.newPage(); let release; const gate = new Promise((done) => release = done); let requests = 0;
      await back.route('**/graph/*.json', async (route) => { requests++; if (scenario === 'pending' && requests === 1) await gate; await route.fulfill({ status: scenario === 'pending' ? 200 : 404, contentType: 'application/json', body: scenario === 'pending' ? JSON.stringify(data) : 'missing' }).catch(() => {}); });
      await p.goto(`${base}/concepts/cnn/?selected=cnn&hops=2`); await p.waitForFunction(() => window.__g3QA.fetches.length === 1); const restoreUrl = p.url();
      if (scenario === 'retryExhausted') { await p.waitForFunction(() => !document.querySelector('[data-role=retry]').hidden); await p.locator(role('retry')).click(); await p.waitForTimeout(100); }
      await p.locator('#concept-body a[href^="/concepts/"]').first().click(); await p.waitForLoadState(); release(); await historyBack(p, restoreUrl); await p.waitForTimeout(300);
      const proof = await trace(p), persisted = proof.persisted.at(-1); report.cases[`bfcache-${scenario}`] = { persisted, requests, aborted: proof.aborted, fetchesInDocument: proof.fetches.length };
      if (persisted) {
        assert.equal(proof.fetches.length, scenario === 'pending' ? 1 : 2); assert.ok(await p.locator(`${role('fallback')} a`).count() > 0);
        if (scenario === 'pending') { assert.equal(proof.aborted, 1); assert.equal(await p.locator(role('retry')).isDisabled(), false); await p.locator(role('retry')).click(); await ready(p); assert.equal(proof.fetches.length + 1, (await trace(p)).fetches.length); }
        else assert.equal(await p.locator(role('retry')).isDisabled(), true);
      }
      await back.close();
    }
    // 最大真2跳含正文，固定4倍CPU、15暖機與120個逐影格原生視角變化。
    const largest = data.concepts.map((n) => ({ id: n.id, count: adjacent(data, n.id, 2, true).ids.length })).sort((a, b) => b.count - a.count)[0];
    for (const width of [1440, 320]) {
      const perfCtx = await context({ viewport: { width, height: 950 } }, true), pp = await perfCtx.newPage(), session = await perfCtx.newCDPSession(pp); await session.send('Emulation.setCPUThrottlingRate', { rate: 4 }); await pp.goto(`${base}/concepts/${largest.id}/?selected=${largest.id}&hops=2&body=1`); await ready(pp); await pp.locator(role('canvas')).focus();
      await pp.evaluate(() => { window.__g3DisableCanvasCapture(); window.__g3QA.samples = []; }); for (let i = 0; i < 135; i++) { await pp.keyboard.press(i % 2 ? 'ArrowRight' : 'ArrowLeft'); await frames(pp); }
      const perfTrace = await trace(pp), values = perfTrace.samples.slice(15); assert.ok(values.length >= 120); const samples = values.slice(-120), sorted = [...samples].sort((a, b) => a - b), p95 = sorted[Math.ceil(sorted.length * .95) - 1]; report.performance.push({ width, cpuRate: 4, center: largest.id, nodes: largest.count, samples, p95, readyToInteractive: perfTrace.firstInteractive }); assert.ok(p95 <= 16, `draw p95=${p95}超過16ms`); assert.ok(perfTrace.firstInteractive <= 200, `首次可操作${perfTrace.firstInteractive}超過200ms`);
      await perfCtx.close();
    }
    report.globalPerformance = [];
    for (const width of [1440, 320]) {
      const perf = await context({ viewport: { width, height: 950 } }, true), p = await perf.newPage(), session = await perf.newCDPSession(p); await session.send('Emulation.setCPUThrottlingRate', { rate: 4 }); await p.goto(`${base}/map/`); await ready(p); await p.locator(role('canvas')).focus();
      await p.evaluate(() => { window.__g3DisableCanvasCapture(); window.__g3QA.samples = []; }); for (let i = 0; i < 135; i++) { await p.keyboard.press(i % 2 ? 'ArrowRight' : 'ArrowLeft'); await frames(p); }
      const samples = (await trace(p)).samples.slice(-120); assert.equal(samples.length, 120); const sorted = [...samples].sort((a, b) => a - b), p95 = sorted[Math.ceil(samples.length * .95) - 1]; report.globalPerformance.push({ width, cpuRate: 4, concepts: data.concepts.length, samples, p95 }); assert.ok(p95 <= 16, `全站draw p95=${p95}超過16ms`); await perf.close();
    }
    assert.deepEqual(report.browserErrors, []); assert.deepEqual(report.externalRequests, []); assert.deepEqual(report.assetFailures, []); Object.assign(report, bfcacheCompletion(report.cases));
  } catch (error) { report.failure = String(error); throw error; }
  finally {
    for (const finish of finishes) { try { await finish(); } catch (error) { report.completed = false; report.assetFailures.push(String(error)); } report.buildResponses.push(finish.evidence()); }
    try { await browser.close(); } catch (error) { report.completed = false; report.failure = `瀏覽器收尾失敗：${error}`; }
    await writeFile(resolve(output, 'map-verification.json'), JSON.stringify(report, null, 2));
  }
  assert.equal(report.completed, true, '驗證尚未完整；請讀取報告中的unverified，不將未命中誤報為產品失敗'); return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) console.log(JSON.stringify(await main(), null, 2));
