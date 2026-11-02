/** 用離線 HTTP／換頁事件替身重現回應失效；收據仍走真實 Git、檔案與 SHA 核驗。 */
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

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
import { distSnapshot, guardBuildContext, routeLocalOnly, sourceSnapshot, watchBuildResponses } from './rollout-smoke.mjs';

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
