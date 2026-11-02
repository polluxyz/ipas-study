/** 用離線 HTTP／換頁事件替身重現回應失效；收據仍走真實 Git、檔案與 SHA 核驗。 */
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

const disk = vi.hoisted(() => ({ repo: undefined, fixture: undefined }));
vi.mock('node:child_process', async (original) => {
  const actual = await original();
  return { ...actual, execFileSync: (command, args, options) => actual.execFileSync(command, args,
    options?.cwd === disk.repo ? { ...options, cwd: disk.fixture } : options) };
});
vi.mock('node:fs/promises', async (original) => {
  const actual = await original();
  const path = await import('node:path');
  const redirect = (file) => {
    if (!disk.repo || typeof file !== 'string') return file;
    const relative = path.relative(disk.repo, file).split(path.sep).join('/');
    // 只把被測模組的來源／dist 讀取導向真實 fixture；不替換雜湊或驗證函式。
    return /^(?:content\/|demo\/(?:src\/|dist(?:\/|$))|\.node-version$)/.test(relative)
      ? path.resolve(disk.fixture, relative) : file;
  };
  return { ...actual, ...Object.fromEntries(['readFile', 'readdir', 'stat'].map((name) =>
    [name, (file, ...args) => actual[name](redirect(file), ...args)])) };
});
import { distSnapshot, gotoSettled, guardBuildContext, routeLocalOnly, settlePage, sourceSnapshot, watchBuildResponses } from './rollout-smoke.mjs';

const base = 'http://127.0.0.1:4321';
const navigatedAway = 'response.body: Protocol error (Network.getResponseBody): No resource with given identifier found\nResponse body is not available for a response that was navigated away from.';
const html = '<!doctype html><title>離線換頁 fixture</title>';
let binding;
beforeAll(async () => {
  const directory = resolve(import.meta.dirname, '../../tmp/rollout/browser-response-race/fixtures');
  await mkdir(directory, { recursive: true });
  disk.fixture = await mkdtemp(resolve(directory, 'repo-'));
  for (const dir of ['content', 'demo/src', 'demo/dist']) await mkdir(resolve(disk.fixture, dir), { recursive: true });
  for (const [path, body] of Object.entries({ 'content/fixture.md': '來源 fixture', 'demo/src/entry.js': '// fixture', '.node-version': '22', 'demo/dist/index.html': html, 'demo/dist/asset.js': 'export default 1;' })) {
    await writeFile(resolve(disk.fixture, path), body);
  }
  const git = (...args) => execFileSync('git', args, { cwd: disk.fixture, encoding: 'utf8' });
  git('init', '-q'); git('add', '.');
  git('-c', 'user.name=Offline fixture', '-c', 'user.email=fixture@example.test', 'commit', '-qm', 'fixture');
  disk.repo = resolve(import.meta.dirname, '../..');
});
beforeEach(async () => {
  const { createHash } = await import('node:crypto');
  const receipt = { version: 1, ...await sourceSnapshot(), ...await distSnapshot(), started: '2026-01-01T00:00:00Z', finished: '2026-01-01T00:00:01Z' };
  binding = { receipt, receiptDigest: createHash('sha256').update(JSON.stringify(receipt)).digest('hex') };
});
afterEach(async () => {
  await writeFile(resolve(disk.fixture, 'content/fixture.md'), '來源 fixture');
  await writeFile(resolve(disk.fixture, 'demo/dist/index.html'), html);
});

async function harness(options = {}) {
  const context = new EventEmitter(), external = [], failures = [], report = { buildResponses: [], assetFailures: [] };
  context.route = async (_pattern, handler) => { context.handler = handler; };
  context.close = vi.fn(async () => { await options.close?.(context); });
  const finish = options.guard ? guardBuildContext(context, binding, base, report)
    : watchBuildResponses(context, binding, base, { allowTextbook404: options.allowTextbook404 });
  await routeLocalOnly(context, base, external, failures);
  return { context, external, failures, report, finish };
}
function delivery(context, options = {}) {
  const url = options.url ?? `${base}/`, status = options.status ?? 200;
  const request = options.request ?? { url: () => url };
  const body = options.body ?? Buffer.from(html);
  const api = { url: () => options.fetchUrl ?? url, status: () => status, headers: () => ({ location: '/redirect' }),
    body: vi.fn(async () => { if (options.bodyError) throw new Error('producer body failed'); return body; }),
    dispose: vi.fn(async () => { if (options.disposeError) throw new Error('producer dispose failed'); }) };
  const browser = { url: () => options.browserUrl ?? url, status: () => options.browserStatus ?? status,
    request: () => options.browserRequest ?? request,
    body: vi.fn(async () => { throw new Error(navigatedAway); }) };
  const route = { request: () => request, fetch: vi.fn(async () => { await options.fetchGate; return api; }),
    abort: vi.fn(async () => {}), continue: vi.fn(async () => {}),
    fulfill: vi.fn(async (payload) => {
      await options.fulfill?.(payload);
      if (options.emit !== false) context.emit('response', browser);
      if (options.fulfillError) throw new Error('producer fulfill failed');
    }) };
  return { route, api, browser, request, run: () => context.handler(route) };
}
async function rejected(h, pattern) {
  await expect(h.finish()).rejects.toThrow();
  const evidence = h.finish.evidence?.() ?? h.report.buildResponses[0];
  expect(evidence.pending).toBe(0); expect(evidence.routes).toBe(0);
  expect(evidence.failures.join('\n')).toMatch(pattern);
  return evidence;
}

function gate() { let release; const promise = new Promise((resolveGate) => { release = resolveGate; }); return { promise, release }; }
function testPage(context, options = {}) {
  return {
    context: () => context, url: () => `${base}/`, isClosed: () => false,
    waitForLoadState: vi.fn(async () => { await options.load; }),
    waitForFunction: vi.fn(async () => { await options.search; }),
    evaluate: vi.fn(async () => { await options.fonts; options.fontsDone?.(); }),
  };
}

describe('真 bytes 證據的離線換頁回歸（不執行 browser／server／build）', () => {
  it('快換頁正例：原 API response 已 dispose，browser body 已失效，close 才交付仍精確核對', async () => {
    const responses = [];
    const h = await harness({ close: async (context) => { for (const response of responses.reverse()) context.emit('response', response); } });
    const source = Buffer.from(html);
    const first = delivery(h.context, { body: source, emit: false });
    const second = delivery(h.context, { url: `${base}/asset.js`, body: Buffer.from('export default 1;'), emit: false });
    await first.run(); await second.run();
    expect(first.api.dispose).toHaveBeenCalledOnce(); expect(second.api.dispose).toHaveBeenCalledOnce();
    source.fill(0); responses.push(first.browser, second.browser);
    const evidence = await h.finish();
    expect(first.route.fulfill.mock.calls[0][0].body).toEqual(Buffer.from(html));
    expect(evidence.seen).toEqual(['asset.js', 'index.html']); expect(evidence.failures).toEqual([]); expect(evidence.sealed).toBe(true);
    expect(first.browser.body).not.toHaveBeenCalled(); expect(second.browser.body).not.toHaveBeenCalled();
    expect(first.api.body).toHaveBeenCalledOnce(); expect(first.route.fetch).toHaveBeenCalledWith({ maxRedirects: 0 });
  });
  it('正常即時回應也用同一 request 與真 bytes 完成', async () => {
    const h = await harness(); await delivery(h.context).run();
    expect((await h.finish()).seen).toEqual(['index.html']); expect(h.failures).toEqual([]);
  });
  it('同 URL 的另一個 request 不得借用已保存 bytes', async () => {
    const h = await harness(); const d = delivery(h.context, { browserRequest: { url: () => `${base}/` } });
    await d.run(); await rejected(h, /對應|request|請求/);
  });
  it('未經 producer 的回應即使 body 正確也失敗', async () => {
    const h = await harness(); h.context.emit('response', delivery(h.context).browser);
    await rejected(h, /對應|request|請求/);
  });
  it('producer 已 fulfill 卻沒有 browser 回應不得完成', async () => {
    const h = await harness(); await delivery(h.context, { emit: false }).run();
    await rejected(h, /回應|消費/);
  });
  it('同一 request 重複回應不得重用 bytes', async () => {
    const h = await harness(); const d = delivery(h.context); await d.run(); h.context.emit('response', d.browser);
    await rejected(h, /對應|request|請求/);
  });
  it.each([
    ['非同源請求', { url: 'https://example.com/' }, /同源/],
    ['fetch 跨來源', { fetchUrl: 'https://example.com/' }, /同源/],
    ['fetch URL 被替換', { fetchUrl: `${base}/asset.js` }, /URL|網址|請求/],
    ['不在收據的資產', { url: `${base}/missing.js` }, /不在 dist 收據/],
    ['redirect', { status: 302 }, /redirect/],
    ['非 200', { status: 503 }, /非 200/],
    ['錯 bytes', { body: Buffer.from('wrong') }, /收據產物/],
    ['producer body 失敗', { bodyError: true }, /producer body failed/],
    ['producer dispose 失敗', { disposeError: true }, /producer dispose failed/],
    ['producer fulfill 失敗', { fulfillError: true }, /producer fulfill failed/],
    ['browser 跨來源', { browserUrl: 'http://localhost:4321/' }, /同源/],
    ['browser URL 改變', { browserUrl: `${base}/asset.js` }, /URL|網址|請求/],
    ['browser status 改變', { browserStatus: 201 }, /status|狀態/],
    ['browser redirect', { browserStatus: 302 }, /status|狀態|redirect/],
  ])('%s 保留失敗且不可冒稱完成', async (_name, options, pattern) => {
    const h = await harness(); await delivery(h.context, options).run(); await rejected(h, pattern);
  });
  it('只保留既有明示教材 404 例外，其他 404 仍失敗', async () => {
    const h = await harness({ allowTextbook404: true }); await delivery(h.context).run();
    await delivery(h.context, { url: `${base}/test-fixtures/textbook/`, status: 404, body: Buffer.from('Not found') }).run();
    expect((await h.finish()).expectedNon200.map((x) => x.phase)).toEqual(['route', 'response']);
    const invalid = await harness({ allowTextbook404: true });
    await delivery(invalid.context, { url: `${base}/other/`, status: 404 }).run(); await rejected(invalid, /非 200/);
  });
  it('收尾排空已開始的 producer，封口後不再 fetch', async () => {
    let release, started;
    const gate = new Promise((resolveGate) => { release = resolveGate; });
    const observed = new Promise((resolveStarted) => { started = resolveStarted; });
    const h = await harness(); const d = delivery(h.context, { fulfill: started, fetchGate: gate });
    const running = d.run(); await Promise.resolve();
    const finishing = h.finish(); release(); await observed; await running;
    expect((await finishing).failures).toEqual([]);
    const blocked = delivery(h.context); await blocked.run();
    expect(blocked.route.fetch).not.toHaveBeenCalled(); expect(blocked.route.abort).toHaveBeenCalledOnce();
  });
  it('close 期間的晚到錯誤必敗且完整寫入 guard report', async () => {
    const h = await harness({ guard: true, close: async (ctx) => ctx.emit('response', delivery(ctx).browser) });
    await delivery(h.context).run(); await rejected(h, /對應|request|請求/);
    expect(h.report.assetFailures).toHaveLength(1); expect(h.report.buildResponses[0].sealed).toBe(true);
  });
  it('close 失敗保留失敗證據', async () => {
    const h = await harness({ close: async () => { throw new Error('close failed'); } }); await delivery(h.context).run();
    expect((await rejected(h, /close failed/)).sealed).toBe(false);
  });
  it('關閉期間來源異動仍被真正來源核驗拒絕', async () => {
    const h = await harness({ close: async () => writeFile(resolve(disk.fixture, 'content/fixture.md'), 'changed') });
    await delivery(h.context).run(); await rejected(h, /未提交變動/);
  });
  it('關閉期間收據被改仍失敗', async () => {
    const h = await harness({ close: async () => { binding.receipt.distDigest = 'tampered'; } });
    await delivery(h.context).run(); await rejected(h, /AssertionError/);
  });
  it('關閉期間真 dist bytes 異動仍被真正 SHA 核驗拒絕', async () => {
    const h = await harness({ close: async () => writeFile(resolve(disk.fixture, 'demo/dist/index.html'), 'tampered dist') });
    await delivery(h.context).run(); await rejected(h, /dist 與建置收據不符/);
  });
  it('同 URL 多請求的回應倒序交付仍各自配對，不能用 URL 當身份', async () => {
    const h = await harness();
    const first = delivery(h.context, { emit: false }), second = delivery(h.context, { emit: false });
    await Promise.all([first.run(), second.run()]);
    h.context.emit('response', second.browser); h.context.emit('response', first.browser);
    expect((await h.finish()).failures).toEqual([]);
    expect(first.browser.body).not.toHaveBeenCalled(); expect(second.browser.body).not.toHaveBeenCalled();
  });
  it('成功後再收到晚到回應，重複 close 不得沿用舊成功或漏記新失敗', async () => {
    const h = await harness({ guard: true }); await delivery(h.context).run(); await h.finish();
    h.context.emit('response', delivery(h.context).browser);
    await rejected(h, /封口後出現回應/);
    expect(h.report.buildResponses[0].failures.join('\n')).toContain('封口後出現回應');
  });
});

describe('導航前的頁面與精確 Request 排空', () => {
  it('gotoSettled 在前後排空，保留 goto options 與原 Response 身份', async () => {
    const h = await harness(), search = gate(), page = testPage(h.context, { search: search.promise });
    const response = {}, options = { waitUntil: 'domcontentloaded', timeout: 1234 };
    page.goto = vi.fn(async () => {
      const d = delivery(h.context); h.context.emit('request', d.request); await d.run(); h.context.emit('requestfinished', d.request);
      return response;
    });
    const navigating = gotoSettled(page, `${base}/`, options);
    expect(page.goto).not.toHaveBeenCalled(); search.release();
    expect(await navigating).toBe(response); expect(page.goto).toHaveBeenCalledExactlyOnceWith(`${base}/`, options);
    expect(page.waitForLoadState).toHaveBeenCalledTimes(2); expect(page.evaluate).toHaveBeenCalledTimes(2);
    await h.finish();
  });
  it('未排空缺回應時 gotoSettled 不得發出下一個 goto', async () => {
    const h = await harness(), page = testPage(h.context, { search: Promise.reject(new Error('readiness failed')) });
    page.goto = vi.fn();
    await expect(gotoSettled(page, `${base}/next/`)).rejects.toThrow('readiness failed');
    expect(page.goto).not.toHaveBeenCalled(); await rejected(h, /readiness failed/);
  });
  it('等待 load、搜尋 input、字體、producer 與原 Request finished 才完成', async () => {
    const h = await harness(), load = gate(), search = gate(), fonts = gate(), fetched = gate(), fontWaited = gate();
    const page = testPage(h.context, { load: load.promise, search: search.promise, fonts: fonts.promise, fontsDone: fontWaited.release });
    const d = delivery(h.context, { fetchGate: fetched.promise });
    h.context.emit('request', d.request); const running = d.run();
    let settled = false; const settling = settlePage(page).then(() => { settled = true; });
    expect(page.waitForFunction).not.toHaveBeenCalled(); load.release();
    await vi.waitFor(() => expect(page.waitForFunction).toHaveBeenCalledOnce());
    expect(page.evaluate).not.toHaveBeenCalled(); search.release();
    await vi.waitFor(() => expect(page.evaluate).toHaveBeenCalledOnce());
    fonts.release(); await fontWaited.promise; expect(settled).toBe(false);
    fetched.release(); await running; expect(settled).toBe(false);
    h.context.emit('requestfinished', d.request); await settling;
    expect(settled).toBe(true); expect((await h.finish()).failures).toEqual([]);
  });
  it('搜尋 readiness 根據真正 DOM：啟用按鈕必須等 input，無搜尋與停用 JS 可完成', async () => {
    const h = await harness(), page = testPage(h.context);
    await settlePage(page);
    const predicate = page.waitForFunction.mock.calls[0][0];
    const ready = (enabled, input) => runInNewContext(`(${predicate})()`, { document: { querySelector: (selector) => selector.includes('button') ? enabled : input } });
    expect(ready(true, false)).toBe(false); expect(ready(true, true)).toBe(true);
    expect(ready(false, false)).toBe(true);
    await delivery(h.context).run(); await h.finish();
  });
  it('已 fulfill 且 finished，缺少 response 仍逾時失敗並保留原門檻', async () => {
    const h = await harness(), d = delivery(h.context, { emit: false });
    h.context.emit('request', d.request); await d.run(); h.context.emit('requestfinished', d.request);
    await expect(settlePage(testPage(h.context), { timeout: 25 })).rejects.toThrow(/逾時|尚未排空/);
    const evidence = await rejected(h, /缺少 browser 回應|排空/);
    expect(evidence.responses).toBe(1); expect(evidence.requests).toBe(0);
  });
  it('同 URL 別的 Request finished 不能替代原請求的終態', async () => {
    const h = await harness(), d = delivery(h.context);
    h.context.emit('request', d.request); await d.run();
    h.context.emit('requestfinished', { url: () => d.request.url() });
    await expect(settlePage(testPage(h.context), { timeout: 25 })).rejects.toThrow(/逾時|尚未排空/);
    expect((await rejected(h, /終態|排空/)).requests).toBe(1);
  });
  it.each(['net::ERR_ABORTED', 'net::ERR_FAILED'])('%s 不建立取消例外，原 Request 失敗必敗', async (errorText) => {
    const h = await harness(), d = delivery(h.context);
    d.request.failure = () => ({ errorText }); h.context.emit('request', d.request); await d.run();
    h.context.emit('requestfailed', d.request);
    await expect(settlePage(testPage(h.context))).rejects.toThrow(errorText);
    await rejected(h, new RegExp(errorText));
  });
  it.each(['search', 'fonts'])('%s readiness 卡住不得換頁或冒稱完成', async (kind) => {
    const h = await harness(), blocked = gate(), page = testPage(h.context, { [kind]: blocked.promise });
    await delivery(h.context).run();
    await expect(settlePage(page, { timeout: 25 })).rejects.toThrow(/排空逾時/);
    blocked.release(); await rejected(h, /頁面排空失敗/);
  });
  it('finish 先完成頁面延後請求才封口，不由工具自己取消正當載入', async () => {
    const h = await harness(), ready = gate(), page = testPage(h.context, { search: ready.promise });
    h.context.pages = () => [page];
    const finishing = h.finish(), d = delivery(h.context);
    h.context.emit('request', d.request); await d.run(); h.context.emit('requestfinished', d.request); ready.release();
    expect(d.route.fetch).toHaveBeenCalledOnce(); expect(d.route.abort).not.toHaveBeenCalled();
    const evidence = await finishing; expect(evidence.failures).toEqual([]); expect(evidence.requests).toBe(0); expect(evidence.responses).toBe(0);
  });
  it('finish 的 readiness 失敗仍關 context 並保存失敗', async () => {
    const h = await harness(), page = testPage(h.context, { search: Promise.reject(new Error('search init failed')) });
    h.context.pages = () => [page]; await delivery(h.context).run();
    await rejected(h, /search init failed/); expect(h.context.close).toHaveBeenCalledOnce();
  });
});
