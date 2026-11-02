/** 以明示替身驗證 figures 收尾接線；不啟動瀏覽器或連線。 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const fake = vi.hoisted(() => ({ launch: vi.fn(), read: vi.fn(), verify: vi.fn(), guard: vi.fn(), route: vi.fn(), gotoSettled: vi.fn() }));
vi.mock('playwright', () => ({ chromium: { launch: fake.launch } }));
vi.mock('../rollout-smoke.mjs', async (importOriginal) => ({
  ...await importOriginal(), readBuildReceipt: fake.read, verifyBuildReceipt: fake.verify,
  guardBuildContext: fake.guard, routeLocalOnly: fake.route, gotoSettled: fake.gotoSettled,
}));
import { verify } from './verify.mjs';
import { assertCompanion } from '../rollout-smoke.mjs';

const binding = { receipt: { sha: 'test-sha' }, receiptDigest: 'test-digest' };
let baseDir, serial = 0, contexts, settings;
const originalSentence = '精確率 與召回率 的調和平均稱為 F1 分數。';
function witnessResult(kind = '正例') {
  const text = `公式與搜尋. ${originalSentence}公式前後的中文說明可以搜尋。`;
  const start = text.indexOf('召回率');
  const section = { title: '公式與搜尋', url: '/dev/figures/#%E5%85%AC%E5%BC%8F%E8%88%87%E6%90%9C%E5%B0%8B', anchor: { id: '公式與搜尋' }, text, marked: Array.from(text, (_, i) => i >= start && i < start + 3), excerpt: '精確率 與<mark>召回</mark><mark>率 </mark>的調和平均稱為 F1 分數。', locations: [44, 46, 47] };
  const figure = { url: '/dev/figures/', content: `公式與搜尋. ${originalSentence}`, sub_results: [section] };
  if (kind === '只有頁名') figure.sub_results = [];
  if (kind === '只有圖表') { section.title = 'PR 曲線'; section.anchor.id = 'pr-曲線'; section.url = '/dev/figures/#pr-曲線'; }
  if (kind === '原句缺失') section.text = section.text.replace('調和平均', '平均');
  if (kind === '內容原句缺失') figure.content = '公式與搜尋';
  if (kind === '命中詞缺失') section.marked.fill(false);
  if (kind === '命中詞不完整') section.marked[start + 2] = false;
  if (kind === '錯誤路徑') figure.url = '/dev/figures/other/';
  return { total: 1, urls: [figure.url], figures: [figure] };
}
class FakeContext extends EventEmitter {
  constructor(options) { super(); this.options = options; }
  async newPage() {
    const page = new EventEmitter();
    this.emit('page', page);
    page.goto = async () => {
      if (this.options.javaScriptEnabled === false && settings.noJsFailure) {
        this.emit('requestfailed', { url: () => 'http://127.0.0.1:4321/nojs', failure: () => ({ errorText: 'failed' }) });
        page.emit('pageerror', new Error('no-js pageerror'));
      }
      if (!this.options.javaScriptEnabled && this.options.javaScriptEnabled !== false) this.emit('request', { url: () => 'http://127.0.0.1:4321/KaTeX.woff2' });
    };
    page.locator = (selector) => ({
      count: async () => settings.badFigures && selector === '.textbook-figure' ? 4 : selector.includes('math') || selector.includes('katex') ? 3 : 5,
      evaluate: async () => selector === '.textbook-advanced' ? true : selector.includes('figure-scroll') ? true : 5,
      click: async () => {}, first() { return this; }, isVisible: async () => true,
    });
    page.getByText = () => ({ isVisible: async () => true });
    page.evaluate = async (fn, query) => {
      const body = String(fn);
      if (body.includes('pagefind.search')) {
        settings.queries.push(query);
        if (query === '精確率') {
          if (settings.precisionError) throw new Error('precision query failed');
          return { total: 3, urls: ['/a/', '/b/', '/c/'], figures: [], pages: [{ url: '/a/' }, { url: '/b/' }, { url: '/c/' }] };
        }
        return witnessResult(settings.witness);
      }
      if (body.includes('document.documentElement.scrollWidth')) return 375;
      return undefined;
    };
    page.waitForFunction = async () => {};
    page.screenshot = async () => {};
    page.setViewportSize = async () => {};
    return page;
  }
  async close() {}
}
async function run(options = {}) {
  settings = { ...options, queries: [] }; contexts = [];
  process.env.FIGURES_OUTPUT = resolve(baseDir, `case-${serial++}`);
  fake.launch.mockImplementation(async () => ({
    newContext: async (options) => { const context = new FakeContext(options); contexts.push(context); return context; },
    close: async () => {},
  }));
  return verify();
}
beforeEach(async () => {
  await mkdir(resolve('..', 'tmp/rollout/figure-search-witness/tests'), { recursive: true });
  baseDir = await mkdtemp(resolve('..', 'tmp/rollout/figure-search-witness/tests/test-'));
  process.env.DEMO_URL = 'http://127.0.0.1:4321'; process.env.BUILD_RECEIPT = 'fake-receipt';
  fake.read.mockReset().mockResolvedValue(binding); fake.verify.mockReset().mockResolvedValue();
  fake.route.mockReset().mockResolvedValue();
  // 本測試以替身模擬導航；真實屏障由共用 helper 的測試及瀏覽器驗收負責。
  fake.gotoSettled.mockReset().mockImplementation((page, url, options) => page.goto(url, options));
  fake.guard.mockReset().mockImplementation((context, _binding, _base, report) => {
    const entry = { context: report.buildResponses.length, seen: [], failures: [], pending: 0 }; report.buildResponses.push(entry);
    let closed = false;
    const finish = async () => {
      if (!closed) {
        closed = true;
        if (settings.closeFailure && context.options.javaScriptEnabled === false) { entry.failures.push('close race'); report.assetFailures.push({ error: 'close race' }); throw new Error('close race'); }
        Object.assign(entry, { sealed: true, seen: ['dev/figures/index.html'] });
      }
      if (entry.failures.length) throw new Error('close race');
    };
    context.close = finish; return finish;
  });
});
afterEach(() => { delete process.env.FIGURES_OUTPUT; delete process.env.DEMO_URL; delete process.env.BUILD_RECEIPT; });
async function recorded() { return JSON.parse(await readFile(resolve(process.env.FIGURES_OUTPUT, 's1-verification.json'), 'utf8')); }

describe('figures 收件接線（替身，非真 UI）', () => {
  it('重新 import 不讀收據也不啟動瀏覽器', async () => {
    fake.launch.mockClear(); fake.read.mockClear(); vi.resetModules();
    await import('./verify.mjs'); expect(fake.launch).not.toHaveBeenCalled(); expect(fake.read).not.toHaveBeenCalled();
  });
  it('成功需兩個 context 安裝 guard 和 route、封口後符合收件契約', async () => {
    const report = await run();
    expect(contexts).toHaveLength(2); expect(contexts[1].options.javaScriptEnabled).toBe(false);
    expect(fake.guard).toHaveBeenCalledTimes(2); expect(fake.route).toHaveBeenCalledTimes(2);
    expect(fake.gotoSettled).toHaveBeenCalledTimes(2);
    expect(report.buildResponses.every((x) => x.sealed)).toBe(true);
    expect(settings.queries).toEqual(['精確率', '召回率']);
    expect(report.searchable).toBe(true);
    expect(report.generalChineseSearchPrecision.status).toBe('未找到展示頁');
    expect(report.generalChineseSearchPrecision.result).toEqual({ total: 3, urls: ['/a/', '/b/', '/c/'], figures: [], pages: [{ url: '/a/' }, { url: '/b/' }, { url: '/c/' }] });
    expect(() => assertCompanion('figures', report, binding, {})).not.toThrow();
    expect(await recorded()).toEqual(report);
  });
  it.each(['只有頁名', '只有圖表', '原句缺失', '內容原句缺失', '命中詞缺失', '命中詞不完整', '錯誤路徑'])('%s 不得當成公式見證', async (witness) => {
    await expect(run({ witness })).rejects.toThrow('Pagefind 的公式小節須命中原句中的召回率');
    const report = await recorded();
    expect(report.searchable).toBe(false); expect(report.completed).toBe(false);
    expect(report.generalChineseSearchPrecision.status).toBe('未找到展示頁');
    expect(settings.queries).toEqual(['精確率', '召回率']);
  });
  it('精確率查詢錯誤仍執行公式見證並如實保存錯誤', async () => {
    await expect(run({ precisionError: true })).rejects.toThrow('precision query failed');
    const report = await recorded();
    expect(settings.queries).toEqual(['精確率', '召回率']);
    expect(report.searchable).toBe(true); expect(report.completed).toBe(false);
    expect(report.generalChineseSearchPrecision.status).toBe('查詢錯誤');
    expect(report.generalChineseSearchPrecision.error).toContain('precision query failed');
  });
  it('no-JS 的 pageerror 與 requestfailed 均阻止完成', async () => {
    await expect(run({ noJsFailure: true })).rejects.toThrow();
    const r = await recorded(); expect(r.completed).toBe(false); expect(r.browserErrors).toContain('no-js pageerror'); expect(r.assetFailures).toHaveLength(1);
  });
  it('context 收尾競態失敗不得完成', async () => {
    await expect(run({ closeFailure: true })).rejects.toThrow();
    const r = await recorded(); expect(r.completed).toBe(false); expect(r.failure).toContain('close race');
  });
  it('原本圖表斷言失敗仍保存量測且不得完成', async () => {
    await expect(run({ badFigures: true })).rejects.toThrow();
    const r = await recorded(); expect(r.completed).toBe(false); expect(r.figures).toBe(4); expect(r.failure).toBeTruthy();
  });
  it('缺收據或收據錯誤保留失敗紀錄', async () => {
    delete process.env.BUILD_RECEIPT; await expect(run()).rejects.toThrow(); expect((await recorded()).completed).toBe(false);
    process.env.BUILD_RECEIPT = 'bad'; fake.read.mockRejectedValueOnce(new Error('bad receipt'));
    await expect(run()).rejects.toThrow('bad receipt'); expect((await recorded()).failure).toContain('bad receipt');
  });
  it('錯誤 origin 與收尾複驗失敗不得完成', async () => {
    process.env.DEMO_URL = 'http://localhost:4321'; await expect(run()).rejects.toThrow(); expect((await recorded()).completed).toBe(false);
    process.env.DEMO_URL = 'http://127.0.0.1:4321'; fake.verify.mockRejectedValueOnce(new Error('receipt changed'));
    await expect(run()).rejects.toThrow(); expect((await recorded()).failure).toContain('receipt changed');
  });
  it('現有輸出目錄不可覆寫', async () => {
    await run(); const output = process.env.FIGURES_OUTPUT; const before = await recorded();
    await expect(verify()).rejects.toThrow(); expect(process.env.FIGURES_OUTPUT).toBe(output); expect(await recorded()).toEqual(before);
  });
});

describe('共用路由 guard 的離線替身', () => {
  it.each([
    ['錯誤 origin', 'http://localhost:4321/a', 200, 'ok'],
    ['redirect', 'http://127.0.0.1:4321/a', 302, 'ok'],
    ['非 200', 'http://127.0.0.1:4321/a', 404, 'ok'],
    ['bytes 不符', 'http://127.0.0.1:4321/a', 200, 'wrong'],
  ])('%s 被拒絕', async (_name, url, status, body) => {
    const actual = await vi.importActual('../rollout-smoke.mjs');
    const ctx = new EventEmitter(); ctx.route = async (_pattern, fn) => { ctx.handler = fn; }; ctx.close = async () => {};
    const receipt = { receipt: { inventory: [{ path: 'a', sha256: createHash('sha256').update('ok').digest('hex') }] } };
    actual.watchBuildResponses(ctx, receipt, 'http://127.0.0.1:4321');
    const external = [], failures = []; await actual.routeLocalOnly(ctx, 'http://127.0.0.1:4321', external, failures);
    let aborted = false, fulfilled = false;
    await ctx.handler({ request: () => ({ url: () => url }), fetch: async () => ({ url: () => url, status: () => status, headers: () => ({ location: '/other' }), body: async () => Buffer.from(body), dispose: async () => {} }), abort: async () => { aborted = true; }, fulfill: async () => { fulfilled = true; } });
    expect(aborted).toBe(true); expect(fulfilled).toBe(false); expect(failures.length).toBeGreaterThan(0);
  });
  it('close 期間晚到的 response 仍排空並納入收尾證據', async () => {
    const actual = await vi.importActual('../rollout-smoke.mjs'); const ctx = new EventEmitter();
    const body = Buffer.from('html'); const url = 'http://127.0.0.1:4321/dev/figures/';
    const request = { url: () => url };
    ctx.route = async (_pattern, handler) => { ctx.handler = handler; };
    ctx.close = async () => { ctx.emit('response', { request: () => request, url: () => url, status: () => 200, body: async () => { await Promise.resolve(); return body; } }); };
    const finish = actual.watchBuildResponses(ctx, { receipt: { inventory: [{ path: 'dev/figures/index.html', sha256: createHash('sha256').update(body).digest('hex') }] }, receiptDigest: 'fake' }, 'http://127.0.0.1:4321');
    // 真 browser 回應必定有先前的 route；保留 close 才交付事件的原時序與全部斷言。
    await actual.routeLocalOnly(ctx, 'http://127.0.0.1:4321', [], []);
    await ctx.handler({ request: () => request, fetch: async () => ({ url: () => url, status: () => 200, headers: () => ({}), body: async () => body, dispose: async () => {} }), fulfill: async () => {}, abort: async () => {} });
    await expect(finish()).rejects.toThrow(); // 替身收據刻意不符真實工作樹。
    expect(finish.evidence().seen).toContain('dev/figures/index.html'); expect(finish.evidence().pending).toBe(0); expect(finish.evidence().sealed).toBe(true);
  });
  it('正確 bytes 通過 route', async () => {
    const actual = await vi.importActual('../rollout-smoke.mjs'); const ctx = new EventEmitter(); ctx.route = async (_, fn) => { ctx.handler = fn; }; ctx.close = async () => {};
    actual.watchBuildResponses(ctx, { receipt: { inventory: [{ path: 'a', sha256: createHash('sha256').update('ok').digest('hex') }] } }, 'http://127.0.0.1:4321');
    const failures = []; await actual.routeLocalOnly(ctx, 'http://127.0.0.1:4321', [], failures); let fulfilled = false;
    await ctx.handler({ request: () => ({ url: () => 'http://127.0.0.1:4321/a' }), fetch: async () => ({ url: () => 'http://127.0.0.1:4321/a', status: () => 200, headers: () => ({}), body: async () => Buffer.from('ok'), dispose: async () => {} }), abort: async () => {}, fulfill: async () => { fulfilled = true; } });
    expect(fulfilled).toBe(true); expect(failures).toEqual([]);
  });
});
